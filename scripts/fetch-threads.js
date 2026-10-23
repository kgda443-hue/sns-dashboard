// Threadsのトレンドと競合を取得してSupabaseに保存するスクリプトです。
// GitHub Actionsから毎日自動で実行されます。Threads公式API(無料)だけを使います。
//
// やっていること:
//   1. キーワード(research_targets に登録したもの)で人気投稿を検索して trend_posts に保存
//   2. 競合アカウント(research_targets に登録したもの)のフォロワー数などを competitor_metrics に保存
//   3. アクセストークンを週1回自動で延長して、期限切れで止まらないようにする
//
// 注意: 他の人の投稿を検索する(1)と他アカウントを調べる(2)は、Metaのアプリ審査
//       (threads_keyword_search / threads_profile_discovery の権限)が通るまでは
//       自分の投稿しか返ってこない、または権限エラーになります。審査は無料です。
//
// 必要な環境変数(GitHubの「Secrets」に登録します):
//   SUPABASE_URL / SUPABASE_SERVICE_KEY
//   THREADS_ACCESS_TOKEN … Threads APIの長期アクセストークン(最初の1回だけ。以降は自動で延長)

const { sbGet, sbUpsert, getJson, todayJst, report, warn, finish, requireEnv } = require('./lib');

const API = 'https://graph.threads.net/v1.0/';
const today = todayJst();
let token = null;

function th(path, params) {
  const qs = new URLSearchParams(Object.assign({}, params, { access_token: token }));
  return getJson(API + path + '?' + qs.toString(), 'Threads API');
}

// 保存済みのトークン(自動延長したもの)と、Secretに登録したトークンのうち、使える方を選ぶ
async function prepareToken() {
  const saved = await sbGet('api_tokens?name=eq.threads');
  const savedRow = saved[0];
  const candidates = [];
  if (savedRow && savedRow.token) candidates.push(savedRow.token);
  if (process.env.THREADS_ACCESS_TOKEN && candidates.indexOf(process.env.THREADS_ACCESS_TOKEN) === -1) {
    candidates.push(process.env.THREADS_ACCESS_TOKEN);
  }
  if (candidates.length === 0) throw new Error('GitHubのSecretが未登録です: THREADS_ACCESS_TOKEN');

  let lastErr = null;
  for (const c of candidates) {
    token = c;
    try {
      const me = await th('me', { fields: 'id,username' });
      console.log('Threadsにログインしました: @' + me.username);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    throw new Error('Threadsのトークンが使えません(期限切れの可能性)。新しいトークンをSecretに登録し直してください。' + lastErr.message);
  }

  // 前回の延長から6日以上たっていたら延長する(60日→また60日)
  const last = savedRow && savedRow.token === token ? new Date(savedRow.refreshed_at).getTime() : 0;
  if (Date.now() - last > 6 * 86400000) {
    try {
      const qs = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: token });
      const r = await getJson('https://graph.threads.net/refresh_access_token?' + qs.toString(), 'トークン延長');
      token = r.access_token;
      await sbUpsert('api_tokens', { name: 'threads', token: token, refreshed_at: new Date().toISOString() }, 'name');
      console.log('トークンを延長しました(あと約' + Math.round(r.expires_in / 86400) + '日有効)');
    } catch (err) {
      // 発行から24時間たっていないトークンは延長できないので、次回に回す
      warn('トークン延長', '今回は延長できませんでした(次回また試します): ' + err.message);
    }
  }
}

function toPost(p, source, query) {
  return {
    platform: 'threads',
    source: source,
    query: query,
    post_id: p.id,
    author: p.username || null,
    caption: p.text ? p.text.slice(0, 1000) : null,
    url: p.permalink || null,
    media_type: p.media_type || null,
    like_count: typeof p.like_count === 'number' ? p.like_count : null,
    comment_count: null,
    posted_at: p.timestamp || null,
    collected_on: today,
  };
}

async function fetchKeyword(keyword) {
  const res = await th('keyword_search', {
    q: keyword,
    search_type: 'TOP',
    fields: 'id,text,media_type,permalink,timestamp,username',
    limit: 25,
  });
  const posts = (res.data || []).map(function (p) { return toPost(p, 'keyword', keyword); });
  await sbUpsert('trend_posts', posts, 'platform,post_id');
  console.log('「' + keyword + '」: 人気投稿 ' + posts.length + '件');
}

async function fetchCompetitor(handle) {
  const username = handle.replace(/^@/, '');
  const p = await th('profile_lookup', { username: username });
  await sbUpsert('competitor_metrics', {
    platform: 'threads',
    handle: username,
    date: today,
    followers_count: typeof p.follower_count === 'number' ? p.follower_count : null,
    media_count: null,
    avg_likes: null,
    avg_comments: null,
  }, 'platform,handle,date');

  try {
    const posts = await th('profile_posts', {
      username: username,
      fields: 'id,text,media_type,permalink,timestamp,username',
      limit: 12,
    });
    await sbUpsert('trend_posts', (posts.data || []).map(function (x) { return toPost(x, 'competitor', username); }), 'platform,post_id');
  } catch (err) {
    warn('競合 ' + username + ' の投稿', err.message);
  }
  console.log('競合 @' + username + ': フォロワー ' + p.follower_count + '人');
}

async function main() {
  try {
    requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
    await prepareToken();
  } catch (err) {
    report('Threadsの準備', err);
    return finish();
  }

  let targets = [];
  try {
    targets = await sbGet('research_targets?platform=eq.threads&active=is.true&order=id.asc');
  } catch (err) {
    report('リサーチ対象の読み込み', err);
  }

  for (const t of targets.filter(function (t) { return t.kind === 'keyword'; })) {
    try { await fetchKeyword(t.value); } catch (err) { report('キーワード ' + t.value, err); }
  }
  for (const t of targets.filter(function (t) { return t.kind === 'account'; })) {
    try { await fetchCompetitor(t.value); } catch (err) { report('競合 ' + t.value, err); }
  }

  finish();
}

main();

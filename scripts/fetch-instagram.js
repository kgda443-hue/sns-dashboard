// Instagramのデータを取得してSupabaseに保存するスクリプトです。
// GitHub Actionsから毎日自動で実行されます。すべてInstagram公式API(無料)だけを使います。
//
// やっていること:
//   1. 自分のアカウントのフォロワー数・フォロー数を保存(daily_metrics)
//   2. 競合アカウント(research_targets に登録したもの)のフォロワー数・投稿数・
//      直近投稿の平均いいね/コメントを保存(competitor_metrics)し、直近投稿を trend_posts に保存
//   3. ハッシュタグ(research_targets に登録したもの)の人気投稿を trend_posts に保存
//
// 必要な環境変数(GitHubの「Secrets」に登録します):
//   SUPABASE_URL / SUPABASE_SERVICE_KEY
//   INSTAGRAM_ACCESS_TOKEN  … Instagram Graph APIのアクセストークン(期限なしのページトークン推奨。README参照)
//   INSTAGRAM_ACCOUNT_ID    … InstagramビジネスアカウントのID
//   INSTAGRAM_DB_ACCOUNT_ID … schema.sqlで登録したInstagram行のid(通常は2)

const { sbGet, sbUpsert, getJson, todayJst, average, report, warn, finish, requireEnv } = require('./lib');

const API = 'https://graph.facebook.com/v23.0/';
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const DB_ACCOUNT_ID = process.env.INSTAGRAM_DB_ACCOUNT_ID;
const today = todayJst();

const MEDIA_FIELDS = 'id,caption,like_count,comments_count,timestamp,permalink,media_type';

function ig(path, params) {
  const qs = new URLSearchParams(Object.assign({}, params, { access_token: IG_TOKEN }));
  return getJson(API + path + '?' + qs.toString(), 'Instagram API');
}

function toPost(m, source, query, author) {
  return {
    platform: 'instagram',
    source: source,
    query: query,
    post_id: m.id,
    author: author || null,
    caption: m.caption ? m.caption.slice(0, 1000) : null,
    url: m.permalink || null,
    media_type: m.media_type || null,
    like_count: typeof m.like_count === 'number' ? m.like_count : null,
    comment_count: typeof m.comments_count === 'number' ? m.comments_count : null,
    posted_at: m.timestamp || null,
    collected_on: today,
  };
}

// 1. 自分のアカウント
async function fetchOwn() {
  const me = await ig(IG_ACCOUNT_ID, { fields: 'followers_count,follows_count,media_count' });
  const row = {
    account_id: Number(DB_ACCOUNT_ID),
    date: today,
    followers_count: me.followers_count,
    following_count: me.follows_count,
  };
  await sbUpsert('daily_metrics', row, 'account_id,date');
  console.log('自分のアカウントを保存しました:', row);
}

// 2. 競合アカウント(Business Discovery: ビジネス/クリエイターアカウントのみ取得可能)
async function fetchCompetitor(handle) {
  const username = handle.replace(/^@/, '');
  const field = 'business_discovery.username(' + username + '){username,followers_count,media_count,' +
    'media.limit(12){' + MEDIA_FIELDS + '}}';
  const data = await ig(IG_ACCOUNT_ID, { fields: field });
  const bd = data.business_discovery;
  const media = (bd.media && bd.media.data) || [];

  await sbUpsert('competitor_metrics', {
    platform: 'instagram',
    handle: username,
    date: today,
    followers_count: bd.followers_count,
    media_count: bd.media_count,
    avg_likes: average(media.map(function (m) { return m.like_count; })),
    avg_comments: average(media.map(function (m) { return m.comments_count; })),
  }, 'platform,handle,date');

  await sbUpsert('trend_posts', media.map(function (m) { return toPost(m, 'competitor', username, username); }), 'platform,post_id');
  console.log('競合 @' + username + ': フォロワー ' + bd.followers_count + '人 / 直近' + media.length + '投稿');
}

// 3. ハッシュタグの人気投稿(1週間に調べられるハッシュタグは30個まで)
async function fetchHashtag(tag) {
  const q = tag.replace(/^#/, '');
  const found = await ig('ig_hashtag_search', { user_id: IG_ACCOUNT_ID, q: q });
  if (!found.data || found.data.length === 0) {
    warn('ハッシュタグ #' + q, '見つかりませんでした');
    return;
  }
  const top = await ig(found.data[0].id + '/top_media', { user_id: IG_ACCOUNT_ID, fields: MEDIA_FIELDS, limit: 25 });
  const posts = (top.data || []).map(function (m) { return toPost(m, 'hashtag', '#' + q, null); });
  await sbUpsert('trend_posts', posts, 'platform,post_id');
  console.log('#' + q + ': 人気投稿 ' + posts.length + '件');
}

async function main() {
  try {
    requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_DB_ACCOUNT_ID']);
  } catch (err) {
    report('設定', err);
    return finish();
  }

  try { await fetchOwn(); } catch (err) { report('自分のInstagram', err); }

  let targets = [];
  try {
    targets = await sbGet('research_targets?platform=eq.instagram&active=is.true&order=id.asc');
  } catch (err) {
    report('リサーチ対象の読み込み', err);
  }

  for (const t of targets.filter(function (t) { return t.kind === 'account'; })) {
    try { await fetchCompetitor(t.value); } catch (err) { report('競合 ' + t.value, err); }
  }
  for (const t of targets.filter(function (t) { return t.kind === 'hashtag'; })) {
    try { await fetchHashtag(t.value); } catch (err) { report('ハッシュタグ ' + t.value, err); }
  }

  finish();
}

main();

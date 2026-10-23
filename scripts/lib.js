// 各取得スクリプトで共通して使う小さな道具箱です。

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers(extra) {
  return Object.assign({
    'Content-Type': 'application/json',
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
  }, extra || {});
}

// Supabaseから読む
async function sbGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: headers() });
  if (!res.ok) throw new Error('Supabaseの読み込みに失敗しました(' + path + '): ' + (await res.text()));
  return res.json();
}

// Supabaseに書く(同じキーの行があれば上書き)
async function sbUpsert(table, rows, onConflict) {
  if (!rows || (Array.isArray(rows) && rows.length === 0)) return;
  const url = SUPABASE_URL + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + onConflict : '');
  const res = await fetch(url, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error('Supabaseへの保存に失敗しました(' + table + '): ' + (await res.text()));
}

// 外部APIをJSONで取得する。失敗したら中身つきのエラーにする
async function getJson(url, label) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(label + 'の取得に失敗しました(HTTP ' + res.status + '): ' + text);
  return JSON.parse(text);
}

// 日本時間の今日の日付(YYYY-MM-DD)
function todayJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

function average(nums) {
  const list = nums.filter(function (n) { return typeof n === 'number'; });
  if (list.length === 0) return null;
  return Math.round(list.reduce(function (a, b) { return a + b; }, 0) / list.length * 10) / 10;
}

// GitHub Actionsの画面に「なぜ失敗したか」を表示する
const problems = [];
function report(title, err) {
  const message = String(err && err.message ? err.message : err).replace(/access_token=[^&\s"]+/g, 'access_token=***');
  console.error('[失敗] ' + title + ': ' + message);
  // ::error:: で出すと実行結果の画面にそのまま表示される
  console.log('::error title=' + title + '::' + message.replace(/\r?\n/g, ' ').slice(0, 900));
  problems.push(title);
}
function warn(title, message) {
  console.log('::warning title=' + title + '::' + String(message).replace(/\r?\n/g, ' ').slice(0, 900));
}

function finish() {
  if (problems.length > 0) {
    console.error('失敗した処理: ' + problems.join(' / '));
    process.exit(1);
  }
  console.log('すべて完了しました');
}

function requireEnv(names) {
  const missing = names.filter(function (n) { return !process.env[n]; });
  if (missing.length > 0) {
    throw new Error('GitHubのSecretが未登録です: ' + missing.join(', '));
  }
}

module.exports = { sbGet, sbUpsert, getJson, todayJst, average, report, warn, finish, requireEnv };

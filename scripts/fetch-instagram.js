// Instagramのフォロワー数などを取得してSupabaseに保存するスクリプトです。
// GitHub Actionsから毎日自動で実行される想定です。
//
// 必要な環境変数(GitHubの「Secrets」に登録します):
//   SUPABASE_URL            … SupabaseプロジェクトのURL
//   SUPABASE_SERVICE_KEY    … Supabaseの「service_role」キー(絶対に公開しないこと)
//   INSTAGRAM_ACCESS_TOKEN  … Instagram Graph APIの長期アクセストークン
//   INSTAGRAM_ACCOUNT_ID    … InstagramビジネスアカウントのID(Instagram側のID)
//   INSTAGRAM_DB_ACCOUNT_ID … schema.sqlで登録したInstagram行のid(通常は2)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const DB_ACCOUNT_ID = process.env.INSTAGRAM_DB_ACCOUNT_ID;

async function main() {
  // 1. Instagram Graph APIからフォロワー数などを取得する
  const fields = 'followers_count,follows_count,media_count';
  const igUrl = 'https://graph.facebook.com/v19.0/' + IG_ACCOUNT_ID + '?fields=' + fields + '&access_token=' + IG_TOKEN;
  const igRes = await fetch(igUrl);
  if (!igRes.ok) {
    throw new Error('Instagram APIの取得に失敗しました: ' + (await igRes.text()));
  }
  const igData = await igRes.json();

  // 2. 今日の日付でSupabaseに保存する(同じ日にもう一度実行した場合は上書きする)
  const today = new Date().toISOString().slice(0, 10);
  const row = {
    account_id: Number(DB_ACCOUNT_ID),
    date: today,
    followers_count: igData.followers_count,
    following_count: igData.follows_count,
  };

  const dbRes = await fetch(SUPABASE_URL + '/rest/v1/daily_metrics?on_conflict=account_id,date', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });

  if (!dbRes.ok) {
    throw new Error('Supabaseへの保存に失敗しました: ' + (await dbRes.text()));
  }

  console.log('保存しました:', row);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});

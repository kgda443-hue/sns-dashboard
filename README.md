# SNSダッシュボード セットアップ手順

X(Twitter)とInstagramの数値を1つの画面で見るための個人用アプリです。
プログラミング不要でここまで作ってありますが、外部サービスの登録作業だけはご自身で行う必要があります。順番通りに進めてください。

## 全体像

| 場所 | 役割 |
|---|---|
| Supabase | 数値を保存するデータベース(無料) |
| GitHub Actions | Instagramの数値を毎日自動取得する仕組み(無料) |
| GitHub Pages | ダッシュボード画面・入力フォームを公開する場所(無料) |

## 手順1: Supabaseの準備

1. [supabase.com](https://supabase.com) でアカウント作成し、新しいプロジェクトを作る
2. 左メニューの「SQL Editor」を開き、[schema.sql](schema.sql) の中身を貼り付けて実行する
   - これでデータを保存する表(テーブル)が2つ作られます
   - `insert into accounts...` の行にある `@your_x_handle` と `@your_instagram_handle` は、後で自分のアカウント名に書き換えても構いません
3. 左メニューの「Project Settings > API」を開き、次の2つをメモする
   - **Project URL**(例: `https://xxxxx.supabase.co`)
   - **anon public key**(長い文字列)
   - **service_role key**(こちらは絶対に人に見せない・公開しない)

## 手順2: Instagram Graph APIの準備

1. Instagramアカウントをビジネスアカウントまたはクリエイターアカウントに設定する
2. FacebookページとそのInstagramアカウントを連携する
3. [Meta for Developers](https://developers.facebook.com) でアプリを作成する
4. Graph API Explorerなどを使って、長期(60日)アクセストークンとInstagramビジネスアカウントIDを取得する
   - この作業はMeta側の画面操作が中心なので、詰まったら該当の画面を教えてください

## 手順3: GitHubにアップロードする

1. GitHubでアカウントを作り、新しいリポジトリ(例: `sns-dashboard`)を作る
2. このフォルダの中身をすべてそのリポジトリにアップロードする

## 手順4: GitHub Actionsの設定(Instagram自動取得)

リポジトリの「Settings > Secrets and variables > Actions」で、次の5つを登録する。

| Secret名 | 値 |
|---|---|
| `SUPABASE_URL` | 手順1でメモしたProject URL |
| `SUPABASE_SERVICE_KEY` | 手順1でメモしたservice_role key |
| `INSTAGRAM_ACCESS_TOKEN` | 手順2で取得したアクセストークン |
| `INSTAGRAM_ACCOUNT_ID` | 手順2で取得したInstagramビジネスアカウントID |
| `INSTAGRAM_DB_ACCOUNT_ID` | `2`(schema.sqlの登録順どおりならInstagramはid=2) |

登録が終わると、毎日日本時間8:00に自動でInstagramの数値が取得されます。
「Actions」タブから手動で今すぐ実行して、動作確認もできます。

## 手順5: 入力フォームとダッシュボードの設定

[form.html](form.html) と [index.html](index.html) の中にある、次の2行を手順1でメモした値に書き換える。

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

## 手順6: GitHub Pagesで公開する

1. リポジトリの「Settings > Pages」を開く
2. 「Branch」を `main` にして保存する
3. 数分後、`https://(あなたのID).github.io/sns-dashboard/` でダッシュボード(index.html)が見られるようになる
4. `https://(あなたのID).github.io/sns-dashboard/form.html` がXの数値入力フォーム
5. スマホでこのURLを開き、ホーム画面に追加すればアプリのように使える

## セキュリティについての注意

`form.html` は、URLと anon key を知っていれば誰でもデータを書き込める簡易な作りです。
個人用でURLを公開しない前提であれば問題ありませんが、より厳密に守りたい場合は認証機能の追加が必要です。判断に迷う場合は相談してください。

## 各ファイルの役割

| ファイル | 役割 |
|---|---|
| `schema.sql` | データベースの表を作るための設定(Supabaseで1回だけ実行) |
| `scripts/fetch-instagram.js` | Instagramの数値を取得して保存するプログラム |
| `.github/workflows/daily-fetch.yml` | 上のプログラムを毎日自動実行する設定 |
| `form.html` | Xの数値を手動入力する画面 |
| `index.html` | 数値を確認するダッシュボード画面 |

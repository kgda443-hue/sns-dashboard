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

## 手順5: アプリ本体の設定

[index.html](index.html) の中にある、次の2行を手順1でメモした値に書き換える。

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

## 手順6: GitHub Pagesで公開する

1. リポジトリの「Settings > Pages」を開く
2. 「Branch」を `main` にして保存する
3. 数分後、`https://(あなたのID).github.io/sns-dashboard/` でアプリが開けるようになる

## 競合リサーチ・トレンド収集(すべて無料)

アプリ下の「リサーチ」タブで、競合アカウントの推移と集めた投稿を見られます。調べる対象(競合アカウント・キーワード・ハッシュタグ)も同じ画面から追加・削除できます。

| SNS | 取れるもの | 仕組み | 頻度 |
|---|---|---|---|
| Instagram | 競合のフォロワー数・投稿数・直近12投稿の平均いいね/コメント、ハッシュタグの人気投稿 | Instagram公式API(Business Discovery / ハッシュタグ検索) | 毎朝8時 |
| Threads | キーワードの人気投稿、競合のフォロワー数・投稿 | Threads公式API(キーワード検索 / プロフィール検索) | 毎朝8時 |
| TikTok | キーワードに近い「普段の何倍も伸びた」動画(とInstagramリール) | vidIQの無料枠(月150クレジット)をClaudeの定期タスクで使用 | 毎週月曜 7:43 |

初めて使うときは [schema-research.sql](schema-research.sql) をSupabaseの「SQL Editor」で1回実行します(実行済みなら不要)。

### 無料で使ううえでの制限

- **Instagramの競合**: 相手がビジネス/クリエイターアカウントの場合だけ取得できます。ハッシュタグは1週間に30種類まで。
- **Threads**: 他の人の投稿の検索・他アカウントの調査には、Metaのアプリ審査(`threads_keyword_search` / `threads_profile_discovery` の権限、無料)が必要です。審査が通るまでは自分の投稿しか返らないか、権限エラーになります。
- **TikTok**: 公式APIでは他人のデータを取れないため、vidIQの無料枠を使います。1キーワードで5クレジットなので、キーワードは3つまで(週3回×月4〜5週で最大75クレジット)。クレジットが20未満の週は自動でお休みします。競合アカウントのフォロワー推移はTikTokでは取れません。

### トークンの期限切れで止まらないようにする

- **Instagram**: Graph API Explorerで出る短期トークン(1〜2時間)や60日トークンは期限が切れます。長期ユーザートークンから取得した**Facebookページのアクセストークン**は期限がないので、それを `INSTAGRAM_ACCESS_TOKEN` に登録するのがおすすめです。
- **Threads**: 長期トークンを `THREADS_ACCESS_TOKEN` に1回登録すれば、以降は毎週自動で延長してSupabaseに保管します(ダッシュボードからは読めない場所です)。

失敗したときは、GitHubの「Actions」で失敗した実行を開くと、赤字で理由(例: トークン期限切れ、Secret未登録)が表示されます。

## スマホへの追加(QRコード)

[qr-code.png](qr-code.png) を読み取ると、アプリのURLが開きます。

1. QRコードを読み取ってURLを開く
2. ブラウザのメニューから「ホーム画面に追加」(iPhone)または「アプリをインストール」(Android)を選ぶ
3. ホーム画面のアイコンから、アプリのように起動できる

## 複数アカウントに対応する場合

Xのアカウントを複数登録したいときは、Supabaseの「Table Editor」から`accounts`の表に行を追加してください(`platform`は`x`、`data_source`は`manual`)。追加すると、入力画面のアカウント選択に自動で反映されます。

## セキュリティについての注意

このアプリは、URLと鍵(anon key)を知っていれば誰でもデータを書き込める簡易な作りです。
個人用でURLを公開しない前提であれば問題ありませんが、より厳密に守りたい場合は認証機能の追加が必要です。判断に迷う場合は相談してください。

## 各ファイルの役割

| ファイル | 役割 |
|---|---|
| `schema.sql` | データベースの表を作るための設定(Supabaseで1回だけ実行) |
| `schema-research.sql` | 競合リサーチ用の表を作る設定(Supabaseで1回だけ実行) |
| `scripts/fetch-instagram.js` | Instagram(自分・競合・ハッシュタグ)を取得して保存するプログラム |
| `scripts/fetch-threads.js` | Threads(キーワード・競合)を取得して保存するプログラム |
| `scripts/lib.js` | 上の2つで共通に使う部品 |
| `.github/workflows/daily-fetch.yml` | 上のプログラムを毎日自動実行する設定 |
| `index.html` | 入力とダッシュボードを1つにまとめたアプリ本体 |
| `manifest.json` / `service-worker.js` | ホーム画面に追加できるようにする設定 |
| `icons/` | アプリのアイコン画像 |
| `qr-code.png` | スマホで読み取るためのQRコード |

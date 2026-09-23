-- SNSダッシュボード用のテーブル定義です。
-- Supabaseの「SQL Editor」にこの内容を貼り付けて実行してください。

-- 管理するSNSアカウントの一覧
create table accounts (
  id serial primary key,
  platform text not null check (platform in ('x', 'instagram', 'threads')),
  handle text not null,
  data_source text not null check (data_source in ('manual', 'api')),
  created_at timestamptz default now()
);

-- 日々の数値の記録(1アカウント・1日につき1行)
create table daily_metrics (
  id serial primary key,
  account_id integer not null references accounts(id),
  date date not null,
  followers_count integer not null,
  following_count integer,
  impressions integer,
  reach integer,
  engagement_rate numeric,
  avg_likes numeric,
  saves integer,
  entered_at timestamptz default now(),
  unique (account_id, date)
);

-- 最初にアカウントを2件登録します。
-- handleの部分は後で自分の実際のアカウント名に書き換えてください。
-- ここでの登録順で id が 1, 2 と振られます(Xが1、Instagramが2)。
-- form.html と scripts/fetch-instagram.js でこのidを使うので、覚えておいてください。
insert into accounts (platform, handle, data_source) values
  ('x', '@your_x_handle', 'manual'),
  ('instagram', '@your_instagram_handle', 'api');

-- ダッシュボードや入力フォームからアクセスできるようにする設定(RLS)
alter table accounts enable row level security;
alter table daily_metrics enable row level security;

create policy "誰でも閲覧可能" on accounts for select using (true);
create policy "誰でも閲覧可能" on daily_metrics for select using (true);

-- 手動入力フォームとInstagram自動取得からの書き込みを許可します。
-- 注意: この設定はURLと鍵を知っていれば誰でもデータを書き込める簡易設定です。
-- 個人利用でURLを公開しない前提であれば問題ありませんが、
-- 厳密なセキュリティが必要な場合は認証機能の追加を検討してください。
create policy "書き込み許可" on daily_metrics for insert with check (true);

-- 競合リサーチ・トレンド収集用のテーブル定義です。
-- schema.sql を実行したあとに、Supabaseの「SQL Editor」で1回だけ実行してください。

-- 調べたい競合アカウント・キーワード・ハッシュタグの一覧
--   platform: instagram / threads / tiktok
--   kind    : account(競合アカウント) / keyword(キーワード) / hashtag(ハッシュタグ。Instagramのみ)
create table if not exists research_targets (
  id serial primary key,
  platform text not null check (platform in ('instagram', 'threads', 'tiktok')),
  kind text not null check (kind in ('account', 'keyword', 'hashtag')),
  value text not null,
  note text,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (platform, kind, value)
);

-- 競合アカウントの日々の数値(1アカウント・1日につき1行)
create table if not exists competitor_metrics (
  id serial primary key,
  platform text not null,
  handle text not null,
  date date not null,
  followers_count integer,
  media_count integer,
  avg_likes numeric,
  avg_comments numeric,
  entered_at timestamptz default now(),
  unique (platform, handle, date)
);

-- 集めた投稿(競合の直近投稿・キーワード/ハッシュタグの人気投稿・TikTokのバズ投稿)
create table if not exists trend_posts (
  id serial primary key,
  platform text not null,
  source text not null,          -- competitor / keyword / hashtag / outlier
  query text,                    -- どのアカウント・キーワードで見つけたか
  post_id text not null,
  author text,
  caption text,
  url text,
  media_type text,
  like_count integer,
  comment_count integer,
  view_count bigint,
  score numeric,                 -- TikTok: その人の普段の再生数の何倍伸びたか
  posted_at timestamptz,
  collected_on date not null default current_date,
  created_at timestamptz default now(),
  unique (platform, post_id)
);
create index if not exists trend_posts_collected_idx on trend_posts (collected_on desc);

-- 自動延長したAPIトークンの保管場所(ダッシュボードからは読めないようにする)
create table if not exists api_tokens (
  name text primary key,
  token text not null,
  refreshed_at timestamptz not null default now()
);

alter table research_targets enable row level security;
alter table competitor_metrics enable row level security;
alter table trend_posts enable row level security;
alter table api_tokens enable row level security; -- ポリシーなし = 自動取得(service_roleキー)以外は読めない

create policy "誰でも閲覧可能" on research_targets for select using (true);
create policy "誰でも閲覧可能" on competitor_metrics for select using (true);
create policy "誰でも閲覧可能" on trend_posts for select using (true);

-- ダッシュボードからリサーチ対象を追加・停止できるようにする(daily_metricsと同じ簡易設定)
create policy "追加許可" on research_targets for insert with check (true);
create policy "更新許可" on research_targets for update using (true) with check (true);
create policy "削除許可" on research_targets for delete using (true);

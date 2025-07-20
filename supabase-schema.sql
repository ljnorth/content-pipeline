-- Schema for Fashion Data Pipeline
-- Run these commands in Supabase SQL editor or psql

-- Table to store TikTok accounts
create table if not exists public.accounts (
  id bigserial primary key,
  username text not null unique,
  url text,
  last_scraped timestamptz,
  created_at timestamptz default now()
);

-- New table to store TikTok posts and engagement stats
create table if not exists public.posts (
  id bigserial primary key,
  username text references public.accounts(username) on delete cascade,
  post_id text not null unique,
  post_timestamp timestamptz,
  like_count bigint,
  comment_count bigint,
  view_count bigint,
  save_count bigint,
  engagement_rate numeric,
  created_at timestamptz default now()
);

-- Indexes for posts
create index if not exists posts_username_idx on public.posts(username);
create index if not exists posts_timestamp_idx on public.posts(post_timestamp);

-- Table to store analyzed images
create table if not exists public.images (
  id bigserial primary key,
  username text references public.accounts(username) on delete cascade,
  post_id text references public.posts(post_id) on delete cascade,
  image_path text,
  analysis jsonb,
  created_at timestamptz default now()
);

-- Indexes for faster lookup
create index if not exists images_username_idx on public.images(username);
create index if not exists images_post_id_idx on public.images(post_id); 
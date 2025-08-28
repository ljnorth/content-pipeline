-- Create tables for tracking owned posts and daily metrics

do $$ begin
  -- owned_posts: posts made by managed accounts
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='owned_posts'
  ) then
    create table public.owned_posts (
      id uuid primary key default gen_random_uuid(),
      account_username text not null,
      platform text not null default 'tiktok',
      platform_post_id text not null,
      url text,
      caption text,
      posted_at timestamptz,
      created_at timestamptz not null default now()
    );
    create unique index if not exists ux_owned_posts_platform_post on public.owned_posts(platform, platform_post_id);
    create index if not exists idx_owned_posts_account on public.owned_posts(account_username);
    create index if not exists idx_owned_posts_posted_at on public.owned_posts(posted_at);
  end if;

  -- post_metrics: one row per post per day
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='post_metrics'
  ) then
    create table public.post_metrics (
      id uuid primary key default gen_random_uuid(),
      platform text not null default 'tiktok',
      platform_post_id text not null,
      collected_at date not null,
      views int,
      likes int,
      comments int,
      shares int,
      saves int,
      created_at timestamptz not null default now()
    );
    create unique index if not exists ux_post_metrics_post_day on public.post_metrics(platform, platform_post_id, collected_at);
    create index if not exists idx_post_metrics_day on public.post_metrics(collected_at);
  end if;
end $$;



-- Ensure generated_posts table has expected columns used by the worker
do $$ begin
  -- Create table if it does not exist
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'generated_posts'
  ) then
    create table public.generated_posts (
      id uuid primary key default gen_random_uuid(),
      account_username text not null,
      generation_id text not null,
      post_number int not null,
      image_paths text[] not null default '{}',
      images jsonb,
      caption text,
      hashtags text,
      status text not null default 'generated',
      platform text,
      platform_post_id text,
      created_at timestamptz not null default now(),
      posted_at timestamptz
    );
    create index if not exists idx_generated_posts_account on public.generated_posts(account_username);
    create index if not exists idx_generated_posts_created on public.generated_posts(created_at);
  end if;

  -- Add any missing columns expected by code
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='platform') then
    alter table public.generated_posts add column platform text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='platform_post_id') then
    alter table public.generated_posts add column platform_post_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='posted_at') then
    alter table public.generated_posts add column posted_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='images') then
    alter table public.generated_posts add column images jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='image_paths') then
    alter table public.generated_posts add column image_paths text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='caption') then
    alter table public.generated_posts add column caption text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='hashtags') then
    alter table public.generated_posts add column hashtags text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='status') then
    alter table public.generated_posts add column status text default 'generated';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='generation_id') then
    alter table public.generated_posts add column generation_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='account_username') then
    alter table public.generated_posts add column account_username text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='generated_posts' and column_name='created_at') then
    alter table public.generated_posts add column created_at timestamptz default now();
  end if;
end $$;



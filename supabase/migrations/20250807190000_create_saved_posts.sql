 create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  caption text null,
  images jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_posts_owner_email on public.saved_posts(owner_email);
create unique index if not exists idx_saved_posts_owner_name on public.saved_posts(owner_email, name);



-- Ensure accounts has active and tags for source management
alter table if exists public.accounts
  add column if not exists active boolean not null default true,
  add column if not exists tags text[] not null default '{}',
  add column if not exists last_scraped timestamptz;

-- Turn all existing accounts active by default
update public.accounts set active = true where active is distinct from true;



-- Create table to track generated influencer assets
create table if not exists public.influencer_outputs (
  id bigserial primary key,
  account_username text not null references public.account_profiles(username) on delete cascade,
  kind text not null check (kind in ('still','reel')),
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists influencer_outputs_account_idx on public.influencer_outputs(account_username);
create index if not exists influencer_outputs_created_idx on public.influencer_outputs(created_at desc);



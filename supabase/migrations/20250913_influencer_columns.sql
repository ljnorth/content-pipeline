-- Influencer columns for character pipeline
alter table if exists public.account_profiles
  add column if not exists influencer_traits jsonb,
  add column if not exists influencer_soul_id text,
  add column if not exists flux_variants jsonb,
  add column if not exists anchor_stills jsonb;

create index if not exists account_profiles_soul_idx on public.account_profiles(influencer_soul_id);



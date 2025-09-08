-- Content style and influencer traits for managed accounts
alter table public.account_profiles
  add column if not exists content_style text not null default 'moodboard',
  add column if not exists influencer_traits jsonb not null default '{}'::jsonb,
  add column if not exists influencer_model_id text,
  add column if not exists video_settings jsonb not null default '{}'::jsonb;

create index if not exists account_profiles_content_style_idx on public.account_profiles(content_style);


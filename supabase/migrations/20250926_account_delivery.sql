-- Per-account delivery configuration: Slack vs Post for Me (Instagram)

alter table public.account_profiles
  add column if not exists delivery_channel text not null default 'slack',
  add column if not exists postforme_instagram_account_id text,
  add column if not exists delivery_schedule_days int;

create index if not exists account_profiles_delivery_idx
  on public.account_profiles(delivery_channel);




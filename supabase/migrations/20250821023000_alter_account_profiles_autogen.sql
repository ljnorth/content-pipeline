-- Ensure managed accounts can be toggled and auto-generated
do $$ begin
  -- is_active boolean flag
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'account_profiles' and column_name = 'is_active'
  ) then
    alter table public.account_profiles
      add column is_active boolean not null default true;
  end if;

  -- owner Slack fields (optional, used for tagging)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'account_profiles' and column_name = 'owner_slack_id'
  ) then
    alter table public.account_profiles add column owner_slack_id text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'account_profiles' and column_name = 'owner_display_name'
  ) then
    alter table public.account_profiles add column owner_display_name text;
  end if;

  -- content_strategy JSONB; ensure it exists and set autogenEnabled default to false when missing
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'account_profiles' and column_name = 'content_strategy'
  ) then
    alter table public.account_profiles add column content_strategy jsonb not null default '{}'::jsonb;
  end if;

  -- Make sure content_strategy has autogenEnabled key (default false)
  update public.account_profiles
  set content_strategy = coalesce(content_strategy, '{}'::jsonb) || jsonb_build_object('autogenEnabled', coalesce((content_strategy->>'autogenEnabled')::boolean, false))
  where (content_strategy->>'autogenEnabled') is null;

  -- Helpful index for active managed lookups
  create index if not exists idx_account_profiles_active on public.account_profiles(is_active);
end $$;



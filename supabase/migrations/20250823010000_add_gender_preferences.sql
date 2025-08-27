-- Add gender preferences support and indexing for faster filtering

-- 1) Ensure a fast lookup on accounts.tags for gender-based filtering
create index if not exists idx_accounts_tags on public.accounts using gin (tags);

-- 2) Ensure managed accounts have a preferredGender in content_strategy
--    Values: 'men' | 'women' | 'any' (default)
update public.account_profiles
set content_strategy = coalesce(content_strategy, '{}'::jsonb)
  || jsonb_build_object(
    'preferredGender', coalesce((content_strategy->>'preferredGender'),'any')
  )
where (content_strategy->>'preferredGender') is null;

-- Optional helpful index for quick lookups on is_active already exists in prior migration
-- create index if not exists idx_account_profiles_active on public.account_profiles(is_active);



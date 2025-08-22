-- Add missing post_number column on generated_posts
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'generated_posts' and column_name = 'post_number'
  ) then
    alter table public.generated_posts add column post_number int;
  end if;

  -- Helpful composite index for lookups/updates
  create index if not exists idx_generated_posts_key on public.generated_posts(generation_id, account_username, post_number);
end $$;



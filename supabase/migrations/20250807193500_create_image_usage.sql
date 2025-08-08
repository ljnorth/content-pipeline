create table if not exists public.image_usage (
  image_id bigint primary key,
  source_username text,
  used_count int not null default 0,
  last_used timestamptz
);

create index if not exists idx_image_usage_source on public.image_usage(source_username);



-- Add washing markers to images
do $$ begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='images' and column_name='washed'
  ) then
    alter table public.images add column washed boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='images' and column_name='original_image_path'
  ) then
    alter table public.images add column original_image_path text;
  end if;
  create index if not exists idx_images_washed on public.images(washed);
end $$;



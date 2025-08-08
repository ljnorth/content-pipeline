create or replace function public.increment_image_usage(img_id bigint)
returns void language plpgsql as $$
begin
  insert into public.image_usage(image_id, used_count, last_used)
  values (img_id, 1, now())
  on conflict (image_id)
  do update set used_count = public.image_usage.used_count + 1, last_used = now();
end; $$;



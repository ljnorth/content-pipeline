-- Vector search helper for nearest images by cosine distance
create or replace function public.nearest_images(
  anchor vector,
  k int,
  include_covers boolean default false,
  usernames text[] default null
)
returns table (
  id bigint,
  image_path text,
  username text,
  post_id text,
  aesthetic text,
  colors text[],
  season text,
  dist double precision
) as $$
  select i.id, i.image_path, i.username, i.post_id, i.aesthetic, i.colors, i.season,
         (i.embedding <=> anchor) as dist
  from images i
  where i.embedding is not null
    and (include_covers or (coalesce(i.is_cover_slide,false)=false and i.cover_slide_text is null))
    and (usernames is null or i.username = any(usernames))
  order by i.embedding <=> anchor
  limit k;
$$ language sql stable;



-- Enable vector extension if not already
create extension if not exists vector;

-- 1) Anchor cache per managed account
create table if not exists public.account_anchors (
  username text primary key references public.account_profiles(username) on delete cascade,
  anchor vector(512) not null,
  built_at timestamptz not null default now(),
  stats jsonb not null default '{}'::jsonb
);

create index if not exists account_anchors_built_at_idx on public.account_anchors(built_at desc);

-- 2) ANN index for images.embedding (HNSW preferred)
-- If your pgvector version supports HNSW, this will succeed. Otherwise, switch to IVFFLAT.
do $$ begin
  execute 'create index if not exists images_embedding_hnsw on public.images using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 200)';
exception when others then
  -- Fallback: IVFFLAT with a reasonable lists setting
  begin
    execute 'create index if not exists images_embedding_ivfflat on public.images using ivfflat (embedding vector_cosine_ops) with (lists = 100)';
  exception when others then null; end;
end $$;

-- Helpful btree indexes used by prefilters
create index if not exists images_username_idx on public.images(username);
create index if not exists posts_user_ts_idx on public.posts(username, created_at desc);
create index if not exists accounts_gender_idx on public.accounts(gender);



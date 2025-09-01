-- Enable pgvector extension and add embedding column to images
create extension if not exists vector;

alter table images add column if not exists embedding vector(512);

-- Optional: index for faster similarity search (requires ANALYZE after bulk load)
create index if not exists images_embedding_idx on images using ivfflat (embedding vector_cosine_ops) with (lists = 100);



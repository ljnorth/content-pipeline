create table if not exists public.meme_audio (
  id bigserial primary key,
  url text not null,
  title text,
  duration_sec numeric,
  vibe text,
  bpm numeric,
  gender text not null default 'both' check (gender in ('male','female','both')),
  created_at timestamptz not null default now()
);

create index if not exists meme_audio_gender_idx on public.meme_audio(gender);



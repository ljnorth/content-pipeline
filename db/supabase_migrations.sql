-- Influencer jobs and assets tables
create table if not exists public.influencer_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','running','failed','completed')),
  stage text,
  persona_json jsonb,
  prompt_text text,
  scene_preset text,
  pose_preset text,
  moodboard_json jsonb,
  higgsfield_job_id text,
  gemini_request_id text,
  warnings text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.influencer_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.influencer_jobs(id) on delete cascade,
  kind text not null check (kind in ('base','upscaled','variant','garment_swapped','video')),
  url text not null,
  meta jsonb,
  width int,
  height int,
  hash text,
  created_at timestamptz not null default now()
);

create index if not exists influencer_jobs_status_idx on public.influencer_jobs(status);
create index if not exists influencer_jobs_created_idx on public.influencer_jobs(created_at desc);
create index if not exists influencer_assets_job_idx on public.influencer_assets(job_id);
create index if not exists influencer_assets_created_idx on public.influencer_assets(created_at desc);
create index if not exists influencer_assets_kind_idx on public.influencer_assets(kind);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists influencer_jobs_touch on public.influencer_jobs;
create trigger influencer_jobs_touch before update on public.influencer_jobs
for each row execute function public.touch_updated_at();

-- RLS (optional: enable and add policies if you use RLS)
-- alter table public.influencer_jobs enable row level security;
-- alter table public.influencer_assets enable row level security;
-- grant select on public.influencer_jobs, public.influencer_assets to anon, authenticated;
-- writes should be through service role only.

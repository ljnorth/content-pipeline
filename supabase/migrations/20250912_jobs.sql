-- Jobs queue schema
create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  payload jsonb,
  status text not null default 'queued',
  step text,
  retries int not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists jobs_status_idx on public.jobs(status);

create table if not exists public.job_logs (
  id bigserial primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  ts timestamptz default now(),
  level text not null,
  message text not null,
  data jsonb
);

create index if not exists job_logs_job_idx on public.job_logs(job_id);

create table if not exists public.job_assets (
  id bigserial primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null,
  url text not null
);

create index if not exists job_assets_job_idx on public.job_assets(job_id);

-- Updated_at trigger
create or replace function public.touch_jobs_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;

drop trigger if exists trg_touch_jobs_updated_at on public.jobs;
create trigger trg_touch_jobs_updated_at
before update on public.jobs
for each row execute function public.touch_jobs_updated_at();



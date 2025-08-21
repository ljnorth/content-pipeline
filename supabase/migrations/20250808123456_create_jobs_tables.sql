-- Jobs tables
create table if not exists job_runs (
  run_id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempt int not null default 0,
  max_attempts int not null default 5,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  locked_at timestamptz,
  lock_owner text,
  error_excerpt text,
  metrics jsonb
);

create index if not exists idx_job_runs_status_created on job_runs(status, created_at);

create table if not exists job_checkpoints (
  run_id uuid primary key references job_runs(run_id) on delete cascade,
  cursor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- dequeue function
create or replace function dequeue_jobs(worker_id text, fetch_limit int default 1)
returns setof job_runs
language plpgsql
as $$
begin
  return query
  with cte as (
    select run_id
    from job_runs
    where status in ('queued','retry')
      and (locked_at is null or locked_at < now() - interval '15 minutes')
    order by created_at asc
    for update skip locked
    limit fetch_limit
  )
  update job_runs j
  set locked_at = now(),
      lock_owner = worker_id,
      status = 'running',
      started_at = coalesce(started_at, now()),
      attempt = attempt + 1
  from cte
  where j.run_id = cte.run_id
  returning j.*;
end;
$$;

-- complete function
create or replace function complete_job(p_run_id uuid, p_success boolean, p_error text default null, p_metrics jsonb default null)
returns void
language plpgsql
as $$
declare
  v_attempt int;
  v_max int;
begin
  select attempt, max_attempts into v_attempt, v_max from job_runs where run_id = p_run_id;
  if p_success then
    update job_runs
      set status='completed', ended_at=now(), error_excerpt=null, metrics=p_metrics
      where run_id=p_run_id;
  else
    if v_attempt < v_max then
      update job_runs
        set status='retry', locked_at=null, lock_owner=null, ended_at=now(), error_excerpt=left(coalesce(p_error,''), 500)
        where run_id=p_run_id;
    else
      update job_runs
        set status='dead', ended_at=now(), error_excerpt=left(coalesce(p_error,''), 500)
        where run_id=p_run_id;
    end if;
  end if;
end;
$$;

-- checkpoint upsert
create or replace function upsert_checkpoint(p_run_id uuid, p_cursor jsonb)
returns void
language plpgsql
as $$
begin
  insert into job_checkpoints(run_id, cursor, updated_at)
  values (p_run_id, p_cursor, now())
  on conflict (run_id) do update set cursor=excluded.cursor, updated_at=now();
end;
$$;



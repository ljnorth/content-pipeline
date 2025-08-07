create table if not exists public.user_profiles (
  user_id uuid primary key,
  email text unique not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create index if not exists idx_user_profiles_email on public.user_profiles(email);



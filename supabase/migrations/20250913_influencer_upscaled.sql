alter table public.account_profiles
add column if not exists flux_variants_upscaled jsonb;

create index if not exists account_profiles_flux_variants_upscaled_gin
on public.account_profiles using gin ((flux_variants_upscaled));



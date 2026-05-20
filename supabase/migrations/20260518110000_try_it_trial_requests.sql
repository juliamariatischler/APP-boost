create table if not exists public.try_it_trial_requests (
  id uuid primary key default gen_random_uuid(),
  sport_type text not null,
  provider_name text not null,
  child_name text not null,
  child_age integer,
  guardian_phone text not null,
  trial_training_status text not null,
  trial_training_info text,
  request_status text not null default 'requested',
  created_at timestamptz not null default now()
);

alter table public.try_it_trial_requests
add constraint guardian_phone_plausible
check (guardian_phone ~ '^\+?[0-9\s\/\-()]{7,20}$');

alter table public.try_it_trial_requests enable row level security;

drop policy if exists "Authenticated users can insert trial requests" on public.try_it_trial_requests;
create policy "Authenticated users can insert trial requests"
  on public.try_it_trial_requests
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can view trial requests" on public.try_it_trial_requests;
create policy "Authenticated users can view trial requests"
  on public.try_it_trial_requests
  for select
  to authenticated
  using (true);

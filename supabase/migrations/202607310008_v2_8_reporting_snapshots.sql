create table if not exists public.reporting_snapshots (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  period_start date not null,
  period_end date not null,
  application_version text not null,
  checksum text not null,
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  status text not null default 'Fechado' check (status = 'Fechado'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists reporting_snapshots_period_idx
  on public.reporting_snapshots(period_start, period_end);

alter table public.reporting_snapshots enable row level security;

do $$
begin
  create policy reporting_snapshots_read on public.reporting_snapshots for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy reporting_snapshots_insert on public.reporting_snapshots for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

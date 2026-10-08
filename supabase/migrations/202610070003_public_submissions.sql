create table if not exists public.erp_public_submissions (
  id text primary key,
  organization_id text not null default 'renea' references public.organizations(id),
  kind text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  payload jsonb not null,
  processed_at timestamptz,
  processed_by uuid
);
alter table public.erp_public_submissions enable row level security;
create policy "authenticated can use submissions" on public.erp_public_submissions for all to authenticated using (true) with check (true);

create table if not exists public.legacy_documents (
  id text not null,
  collection_path text not null,
  path text primary key,
  organization_id text not null default 'renea' references public.organizations(id),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists legacy_documents_collection_idx on public.legacy_documents(collection_path);
alter table public.legacy_documents enable row level security;
create policy "authenticated can use legacy documents" on public.legacy_documents for all to authenticated using (true) with check (true);

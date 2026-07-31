create table if not exists public.document_analysis_audit (
  id uuid primary key default gen_random_uuid(),
  document_hash text not null,
  document_type text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  extracted_fields jsonb not null default '[]'::jsonb,
  inconsistencies jsonb not null default '[]'::jsonb,
  requires_human_review boolean not null default true,
  processing_mode text not null default 'Local',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique(document_hash, document_type)
);

alter table public.document_analysis_audit enable row level security;

do $$
begin
  create policy document_analysis_authenticated on public.document_analysis_audit for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

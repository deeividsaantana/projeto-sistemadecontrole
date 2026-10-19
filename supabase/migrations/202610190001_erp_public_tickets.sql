-- Tickets do link público numa tabela só (auditoria de 16/10, C2). O app lia
-- e gravava em erp_public_tickets, que não existia; o link gravava em
-- legacy_documents. Agora os dois usam esta tabela.
create table if not exists public.erp_public_tickets (
  id text primary key,
  organization_id text not null default 'renea' references public.organizations(id),
  kind text not null default 'ticket_public',
  value jsonb not null,
  source_ip_hash text,
  updated_at timestamptz not null default now()
);

create index if not exists erp_public_tickets_kind_idx on public.erp_public_tickets(kind);

alter table public.erp_public_tickets enable row level security;

do $$
begin
  create policy "authenticated can use public tickets"
    on public.erp_public_tickets
    for all to authenticated
    using (true)
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.erp_public_tickets;
exception
  when duplicate_object then null;
end $$;

-- Traz o que o link já tinha gravado no lugar antigo, se houver.
insert into public.erp_public_tickets (id, organization_id, kind, value, updated_at)
select id, organization_id, 'ticket_public', payload->'value', updated_at
from public.legacy_documents
where collection_path = 'sistemarenea_public_tickets' and payload ? 'value'
on conflict (id) do nothing;

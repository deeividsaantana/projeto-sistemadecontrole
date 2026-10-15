-- Versões anteriores do retrato da nuvem.
--
-- O app guarda tudo num retrato único (erp_snapshots) e cada envio troca o
-- retrato inteiro. Em 15/10/2026 envios de navegadores sem a cópia local
-- publicaram listas vazias por cima (abastecimentos, materiais e 185
-- equipamentos sumiram) e não havia versão anterior para voltar.
--
-- Daqui em diante cada versão publicada fica guardada aqui. Ficam as 60 mais
-- recentes e, além delas, a primeira de cada dia dos últimos 45 dias. Só o
-- banco lê esta tabela (sem política de acesso): restaurar é ação de suporte.

create table if not exists public.erp_snapshot_history (
  id bigserial primary key,
  organization_id text not null,
  version uuid,
  updated_at timestamptz not null,
  updated_by uuid,
  record_count integer,
  payload jsonb not null,
  saved_at timestamptz not null default now()
);

create index if not exists erp_snapshot_history_org_updated_idx
  on public.erp_snapshot_history (organization_id, updated_at desc);

alter table public.erp_snapshot_history enable row level security;
revoke all on table public.erp_snapshot_history from anon, authenticated;

create or replace function public.keep_erp_snapshot_history()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.erp_snapshot_history (organization_id, version, updated_at, updated_by, record_count, payload)
  values (new.organization_id, new.version, new.updated_at, new.updated_by, new.record_count, new.payload);

  delete from public.erp_snapshot_history history
  where history.organization_id = new.organization_id
    and history.id not in (
      select recent.id from public.erp_snapshot_history recent
      where recent.organization_id = new.organization_id
      order by recent.updated_at desc
      limit 60
    )
    and history.id not in (
      select distinct on ((daily.updated_at at time zone 'America/Sao_Paulo')::date) daily.id
      from public.erp_snapshot_history daily
      where daily.organization_id = new.organization_id
        and daily.updated_at > now() - interval '45 days'
      order by (daily.updated_at at time zone 'America/Sao_Paulo')::date, daily.updated_at
    );
  return new;
end;
$$;

revoke all on function public.keep_erp_snapshot_history() from public, anon, authenticated;

drop trigger if exists erp_snapshots_keep_history on public.erp_snapshots;
create trigger erp_snapshots_keep_history
after insert or update on public.erp_snapshots
for each row execute function public.keep_erp_snapshot_history();

-- Guarda já a versão que está na nuvem agora.
insert into public.erp_snapshot_history (organization_id, version, updated_at, updated_by, record_count, payload)
select organization_id, version, updated_at, updated_by, record_count, payload
from public.erp_snapshots
where not exists (
  select 1 from public.erp_snapshot_history history
  where history.organization_id = erp_snapshots.organization_id and history.updated_at = erp_snapshots.updated_at
);

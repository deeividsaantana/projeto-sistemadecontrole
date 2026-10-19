-- Histórico de versões da nuvem (auditoria de 16/10, A31).
--
-- O gatilho que está no banco desde 16/10 guarda a versão que vai ser
-- substituída (no máximo uma a cada 30 minutos, e sempre que a nova vem com
-- menos registros). Ele não estava no repositório e não apagava nada: cada
-- versão tem perto de 1,3 MB e o banco enchia sem limite.
--
-- Esta migração deixa o repositório igual ao banco e põe o limite que a
-- migração de 15/10 já previa: ficam as 60 versões mais recentes e, além
-- delas, a primeira de cada dia dos últimos 45 dias.

create or replace function public.keep_erp_snapshot_history()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.record_count < old.record_count
     or not exists (
       select 1 from public.erp_snapshot_history h
       where h.organization_id = old.organization_id and h.saved_at > now() - interval '30 minutes'
     ) then
    insert into public.erp_snapshot_history (organization_id, version, updated_at, updated_by, record_count, payload)
    values (old.organization_id, old.version, old.updated_at, old.updated_by, old.record_count, old.payload);

    delete from public.erp_snapshot_history history
    where history.organization_id = old.organization_id
      and history.id not in (
        select recent.id from public.erp_snapshot_history recent
        where recent.organization_id = old.organization_id
        order by recent.saved_at desc
        limit 60
      )
      and history.id not in (
        select distinct on ((daily.saved_at at time zone 'America/Sao_Paulo')::date) daily.id
        from public.erp_snapshot_history daily
        where daily.organization_id = old.organization_id
          and daily.saved_at > now() - interval '45 days'
        order by (daily.saved_at at time zone 'America/Sao_Paulo')::date, daily.saved_at
      );
  end if;
  return new;
end;
$$;

revoke all on function public.keep_erp_snapshot_history() from public, anon, authenticated;

drop trigger if exists erp_snapshots_keep_history on public.erp_snapshots;
create trigger erp_snapshots_keep_history
after update on public.erp_snapshots
for each row execute function public.keep_erp_snapshot_history();

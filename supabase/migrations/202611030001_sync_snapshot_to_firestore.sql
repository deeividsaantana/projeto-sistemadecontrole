-- Sincroniza erp_snapshots (Supabase) → legacy_documents (Firestore)
-- Problema: App publica em Supabase, link presença lê de Firestore (desincronizado)
-- Solução: Trigger chama webhook que copia erp_snapshots para Firestore após cada publicação

-- Função que chama webhook de sincronização
create or replace function public.sync_erp_to_firestore()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  webhook_url text;
  webhook_secret text;
  response record;
begin
  -- Webhook para sincronização (definir em variáveis de ambiente)
  webhook_url := current_setting('app.firestore_sync_webhook_url', true);
  webhook_secret := current_setting('app.firestore_sync_webhook_secret', true);

  if webhook_url is not null then
    perform
      net.http_post(
        url := webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || webhook_secret
        ),
        body := jsonb_build_object(
          'organization_id', new.organization_id,
          'snapshot', new.payload,
          'updated_at', new.updated_at,
          'version', new.version,
          'record_count', new.record_count
        )
      );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_erp_to_firestore() from public, anon, authenticated;

-- Trigger: sincroniza APÓS cada atualização do snapshot
drop trigger if exists sync_erp_to_firestore_trigger on public.erp_snapshots;
create trigger sync_erp_to_firestore_trigger
after update on public.erp_snapshots
for each row
when (old.payload is distinct from new.payload)
execute function public.sync_erp_to_firestore();

-- Registra sincronizações para auditoria
create table if not exists public.firestore_sync_log (
  id bigserial primary key,
  organization_id text not null,
  snapshot_version uuid,
  snapshot_updated_at timestamptz,
  record_count integer,
  status text, -- 'pending', 'success', 'failed'
  error_message text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists firestore_sync_log_org_idx on public.firestore_sync_log (organization_id, attempted_at desc);
alter table public.firestore_sync_log enable row level security;
revoke all on table public.firestore_sync_log from anon, authenticated;

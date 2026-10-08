insert into public.erp_public_submissions (
  id,
  organization_id,
  kind,
  status,
  created_at,
  payload
)
select
  id,
  coalesce(nullif(organization_id, ''), 'renea'),
  coalesce(nullif(payload->>'kind', ''), 'presence'),
  coalesce(nullif(payload->>'status', ''), 'pending'),
  updated_at,
  coalesce(payload->'payload', '{}'::jsonb)
from public.legacy_documents
where collection_path = 'sistemarenea_public_submissions'
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  kind = excluded.kind,
  status = case
    when public.erp_public_submissions.status = 'processed' then 'processed'
    else excluded.status
  end,
  payload = excluded.payload;

notify pgrst, 'reload schema';

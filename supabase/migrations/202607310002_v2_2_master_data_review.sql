begin;

create table if not exists public.master_data_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  entity_name text not null,
  record_id uuid,
  canonical_key text not null,
  alias text not null,
  normalized_alias text not null,
  source_batch_id uuid,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint master_data_aliases_entity_valid check (
    entity_name in ('companies', 'suppliers', 'materials', 'locations', 'work_branches', 'collaborators')
  ),
  constraint master_data_aliases_canonical_key_not_blank check (btrim(canonical_key) <> ''),
  constraint master_data_aliases_alias_not_blank check (btrim(alias) <> ''),
  constraint master_data_aliases_normalized_not_blank check (btrim(normalized_alias) <> ''),
  constraint master_data_aliases_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint master_data_aliases_batch_fk
    foreign key (source_batch_id, organization_id)
    references public.import_batches(id, organization_id)
    on delete restrict,
  unique (organization_id, entity_name, normalized_alias),
  unique (id, organization_id)
);

create index if not exists master_data_aliases_lookup_idx
  on public.master_data_aliases (organization_id, entity_name, canonical_key)
  where active = true and deleted_at is null;

create table if not exists public.master_data_review_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  row_id uuid not null,
  entity_name text not null,
  normalized_key text,
  display_value text,
  review_status text not null default 'ready',
  decision text not null default 'pending',
  candidate_record_ids uuid[] not null default '{}',
  aliases text[] not null default '{}',
  issues jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.app_users(id),
  reviewed_at timestamptz,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_data_review_entity_valid check (
    entity_name in ('companies', 'suppliers', 'materials', 'locations', 'work_branches', 'collaborators')
  ),
  constraint master_data_review_status_valid check (
    review_status in ('ready', 'matched', 'duplicate', 'invalid')
  ),
  constraint master_data_review_decision_valid check (
    decision in ('pending', 'approved', 'rejected', 'merged')
  ),
  constraint master_data_review_issues_array check (jsonb_typeof(issues) = 'array'),
  constraint master_data_review_batch_fk
    foreign key (batch_id, organization_id)
    references public.import_batches(id, organization_id)
    on delete cascade,
  constraint master_data_review_row_fk
    foreign key (row_id, organization_id)
    references public.import_rows(id, organization_id)
    on delete cascade,
  unique (batch_id, row_id),
  unique (id, organization_id)
);

create index if not exists master_data_review_queue_idx
  on public.master_data_review_items (
    organization_id,
    entity_name,
    decision,
    review_status,
    created_at desc
  );

create index if not exists master_data_review_key_idx
  on public.master_data_review_items (organization_id, entity_name, normalized_key)
  where normalized_key is not null;

drop trigger if exists master_data_aliases_set_updated_at on public.master_data_aliases;
create trigger master_data_aliases_set_updated_at
  before update on public.master_data_aliases
  for each row execute function public.set_updated_at();

drop trigger if exists master_data_aliases_audit_change on public.master_data_aliases;
create trigger master_data_aliases_audit_change
  after insert or update or delete on public.master_data_aliases
  for each row execute function public.audit_row_change();

drop trigger if exists master_data_review_items_set_updated_at on public.master_data_review_items;
create trigger master_data_review_items_set_updated_at
  before update on public.master_data_review_items
  for each row execute function public.set_updated_at();

drop trigger if exists master_data_review_items_audit_change on public.master_data_review_items;
create trigger master_data_review_items_audit_change
  after insert or update or delete on public.master_data_review_items
  for each row execute function public.audit_row_change();

create or replace function public.stage_master_data_import(
  p_organization_id uuid,
  p_entity_name text,
  p_source_name text,
  p_worksheet_name text,
  p_rows jsonb,
  p_created_by uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_id_value uuid;
  total_rows_value integer;
  ready_rows_value integer;
  matched_rows_value integer;
  duplicate_rows_value integer;
  invalid_rows_value integer;
begin
  if p_entity_name not in ('companies', 'suppliers', 'materials', 'locations', 'work_branches', 'collaborators') then
    raise exception 'Entidade mestre inválida para revisão.';
  end if;

  batch_id_value := public.ingest_import_batch(
    p_organization_id,
    p_source_name,
    'master-workbook',
    p_entity_name,
    p_worksheet_name,
    p_rows,
    p_created_by,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('workflow', 'master-data-review-v2.2')
  );

  update public.import_rows
  set normalized_data = case
        when jsonb_typeof(raw_data -> 'normalized') = 'object' then raw_data -> 'normalized'
        else null
      end,
      source_key = coalesce(nullif(raw_data ->> 'canonicalKey', ''), source_key),
      status = case raw_data ->> 'status'
        when 'ready' then 'valid'::public.import_row_status
        when 'matched' then 'warning'::public.import_row_status
        when 'duplicate' then 'duplicate'::public.import_row_status
        when 'invalid' then 'invalid'::public.import_row_status
        else 'unmapped'::public.import_row_status
      end,
      review_notes = nullif(raw_data ->> 'reviewNote', '')
  where batch_id = batch_id_value
    and organization_id = p_organization_id;

  insert into public.master_data_review_items (
    organization_id,
    batch_id,
    row_id,
    entity_name,
    normalized_key,
    display_value,
    review_status,
    candidate_record_ids,
    aliases,
    issues,
    created_by,
    updated_by
  )
  select
    import_row.organization_id,
    import_row.batch_id,
    import_row.id,
    p_entity_name,
    nullif(import_row.raw_data ->> 'canonicalKey', ''),
    nullif(import_row.raw_data ->> 'displayValue', ''),
    case import_row.raw_data ->> 'status'
      when 'matched' then 'matched'
      when 'duplicate' then 'duplicate'
      when 'invalid' then 'invalid'
      else 'ready'
    end,
    case
      when jsonb_typeof(import_row.raw_data -> 'candidateRecordIds') = 'array'
        then array(
          select value::uuid
          from jsonb_array_elements_text(import_row.raw_data -> 'candidateRecordIds') as candidate(value)
          where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      else '{}'
    end,
    case
      when jsonb_typeof(import_row.raw_data -> 'aliases') = 'array'
        then array(select value from jsonb_array_elements_text(import_row.raw_data -> 'aliases') as alias(value))
      else '{}'
    end,
    case
      when jsonb_typeof(import_row.raw_data -> 'issues') = 'array' then import_row.raw_data -> 'issues'
      else '[]'::jsonb
    end,
    p_created_by,
    p_created_by
  from public.import_rows as import_row
  where import_row.batch_id = batch_id_value
    and import_row.organization_id = p_organization_id;

  insert into public.master_data_aliases (
    organization_id,
    entity_name,
    canonical_key,
    alias,
    normalized_alias,
    source_batch_id,
    created_by,
    updated_by
  )
  select distinct
    p_organization_id,
    p_entity_name,
    review_item.normalized_key,
    alias_value.alias,
    lower(regexp_replace(btrim(alias_value.alias), '[^[:alnum:]]+', '', 'g')),
    batch_id_value,
    p_created_by,
    p_created_by
  from public.master_data_review_items as review_item
  cross join lateral unnest(
    case
      when cardinality(review_item.aliases) > 0 then review_item.aliases
      when review_item.display_value is not null then array[review_item.display_value]
      else '{}'
    end
  ) as alias_value(alias)
  where review_item.batch_id = batch_id_value
    and review_item.organization_id = p_organization_id
    and review_item.normalized_key is not null
    and nullif(btrim(alias_value.alias), '') is not null
    and nullif(lower(regexp_replace(btrim(alias_value.alias), '[^[:alnum:]]+', '', 'g')), '') is not null
  on conflict (organization_id, entity_name, normalized_alias) do nothing;

  select
    count(*),
    count(*) filter (where review_status = 'ready'),
    count(*) filter (where review_status = 'matched'),
    count(*) filter (where review_status = 'duplicate'),
    count(*) filter (where review_status = 'invalid')
  into
    total_rows_value,
    ready_rows_value,
    matched_rows_value,
    duplicate_rows_value,
    invalid_rows_value
  from public.master_data_review_items
  where batch_id = batch_id_value
    and organization_id = p_organization_id;

  update public.import_batches
  set status = case
        when invalid_rows_value > 0 or duplicate_rows_value > 0 or matched_rows_value > 0
          then 'completed_with_warnings'::public.import_status
        else 'completed'::public.import_status
      end,
      valid_rows = ready_rows_value,
      warning_rows = matched_rows_value,
      invalid_rows = invalid_rows_value,
      duplicate_rows = duplicate_rows_value,
      completed_at = now()
  where id = batch_id_value
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'batchId', batch_id_value,
    'entity', p_entity_name,
    'totalRows', total_rows_value,
    'readyRows', ready_rows_value,
    'matchedRows', matched_rows_value,
    'duplicateRows', duplicate_rows_value,
    'invalidRows', invalid_rows_value
  );
end
$$;

create or replace view public.master_data_review_summary
with (security_invoker = true)
as
select
  review_item.organization_id,
  review_item.batch_id,
  review_item.entity_name,
  count(*) as total_rows,
  count(*) filter (where review_item.review_status = 'ready') as ready_rows,
  count(*) filter (where review_item.review_status = 'matched') as matched_rows,
  count(*) filter (where review_item.review_status = 'duplicate') as duplicate_rows,
  count(*) filter (where review_item.review_status = 'invalid') as invalid_rows,
  count(*) filter (where review_item.decision = 'pending') as pending_decisions,
  max(review_item.updated_at) as updated_at
from public.master_data_review_items as review_item
group by review_item.organization_id, review_item.batch_id, review_item.entity_name;

alter table public.master_data_aliases enable row level security;
alter table public.master_data_review_items enable row level security;

drop policy if exists master_data_aliases_select_organization on public.master_data_aliases;
create policy master_data_aliases_select_organization
  on public.master_data_aliases
  for select
  to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);

drop policy if exists master_data_aliases_insert_organization on public.master_data_aliases;
create policy master_data_aliases_insert_organization
  on public.master_data_aliases
  for insert
  to authenticated
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());

drop policy if exists master_data_aliases_update_organization on public.master_data_aliases;
create policy master_data_aliases_update_organization
  on public.master_data_aliases
  for update
  to authenticated
  using (organization_id = public.current_organization_id() and public.can_write_master_data())
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());

drop policy if exists master_data_aliases_delete_organization on public.master_data_aliases;
create policy master_data_aliases_delete_organization
  on public.master_data_aliases
  for delete
  to authenticated
  using (organization_id = public.current_organization_id() and public.can_archive_master_data());

drop policy if exists master_data_review_items_select_organization on public.master_data_review_items;
create policy master_data_review_items_select_organization
  on public.master_data_review_items
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists master_data_review_items_insert_organization on public.master_data_review_items;
create policy master_data_review_items_insert_organization
  on public.master_data_review_items
  for insert
  to authenticated
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());

drop policy if exists master_data_review_items_update_organization on public.master_data_review_items;
create policy master_data_review_items_update_organization
  on public.master_data_review_items
  for update
  to authenticated
  using (organization_id = public.current_organization_id() and public.can_write_master_data())
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());

drop policy if exists master_data_review_items_delete_organization on public.master_data_review_items;
create policy master_data_review_items_delete_organization
  on public.master_data_review_items
  for delete
  to authenticated
  using (organization_id = public.current_organization_id() and public.can_archive_master_data());

revoke all on
  public.master_data_aliases,
  public.master_data_review_items,
  public.master_data_review_summary
from anon;

revoke all on function public.stage_master_data_import(uuid, text, text, text, jsonb, uuid, jsonb)
from public, anon, authenticated;

grant select, insert, update, delete on
  public.master_data_aliases,
  public.master_data_review_items
to authenticated, service_role;

grant select on public.master_data_review_summary to authenticated, service_role;
grant execute on function public.stage_master_data_import(uuid, text, text, text, jsonb, uuid, jsonb)
to service_role;

comment on table public.master_data_aliases
  is 'Preserva variações textuais históricas e relaciona cada alias a uma chave canônica.';
comment on table public.master_data_review_items
  is 'Fila de revisão dos cadastros mestres; duplicidades e inválidos nunca são promovidos silenciosamente.';
comment on function public.stage_master_data_import(uuid, text, text, text, jsonb, uuid, jsonb)
  is 'Registra lote, linhas, aliases e fila de revisão de uma entidade mestre em uma única transação.';

commit;

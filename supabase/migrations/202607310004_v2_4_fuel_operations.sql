begin;

create table if not exists public.fueling_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid,
  convoy_id uuid,
  fuel_type_id uuid,
  local_source_id text,
  prefix_informed text,
  effective_date date not null,
  effective_time time,
  competence date generated always as (date_trunc('month', effective_date::timestamp)::date) stored,
  hour_meter numeric(16,3),
  odometer numeric(16,3),
  pump_start numeric(18,3),
  pump_end numeric(18,3),
  quantity_liters numeric(14,3) not null,
  cost_per_liter numeric(14,4),
  total_cost numeric(16,2) generated always as (
    round(quantity_liters * coalesce(cost_per_liter, 0), 2)
  ) stored,
  tank_capacity_liters numeric(14,3),
  responsible_name text,
  notes text,
  source_type text not null default 'manual',
  source_file text,
  source_sheet text,
  source_row integer,
  import_row_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fueling_events_quantity_positive check (quantity_liters > 0),
  constraint fueling_events_cost_non_negative check (cost_per_liter is null or cost_per_liter >= 0),
  constraint fueling_events_capacity_positive check (tank_capacity_liters is null or tank_capacity_liters > 0),
  constraint fueling_events_pump_order check (pump_end is null or pump_start is null or pump_end >= pump_start),
  constraint fueling_events_source_not_blank check (btrim(source_type) <> ''),
  constraint fueling_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fueling_events_equipment_fk
    foreign key (equipment_id, organization_id)
    references public.equipment(id, organization_id),
  constraint fueling_events_convoy_fk
    foreign key (convoy_id, organization_id)
    references public.convoys(id, organization_id),
  constraint fueling_events_fuel_type_fk
    foreign key (fuel_type_id, organization_id)
    references public.fuel_types(id, organization_id),
  constraint fueling_events_import_row_fk
    foreign key (import_row_id, organization_id)
    references public.import_rows(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists fueling_events_local_source_active_uidx
  on public.fueling_events (organization_id, local_source_id)
  where local_source_id is not null and deleted_at is null;
create index if not exists fueling_events_competence_idx
  on public.fueling_events (organization_id, competence, effective_date, effective_time)
  where deleted_at is null;
create index if not exists fueling_events_equipment_idx
  on public.fueling_events (organization_id, equipment_id, effective_date desc)
  where equipment_id is not null and deleted_at is null;
create index if not exists fueling_events_convoy_pump_idx
  on public.fueling_events (organization_id, convoy_id, effective_date, effective_time)
  where convoy_id is not null and deleted_at is null;

create table if not exists public.fuel_review_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  batch_id uuid not null,
  import_row_id uuid not null,
  local_source_id text,
  review_status text not null default 'pending',
  source_review_status text,
  effective_date date,
  competence date,
  prefix_informed text,
  quantity_liters numeric(14,3),
  cost_per_liter numeric(14,4),
  tank_capacity_liters numeric(14,3),
  issue_count integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  raw_data jsonb not null,
  normalized_data jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by uuid references public.app_users(id),
  reviewed_at timestamptz,
  promoted_event_id uuid,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fuel_review_items_status_check check (
    review_status in ('pending', 'approved', 'rejected', 'needs_correction')
  ),
  constraint fuel_review_items_issue_count_non_negative check (issue_count >= 0),
  constraint fuel_review_items_issues_array check (jsonb_typeof(issues) = 'array'),
  constraint fuel_review_items_raw_object check (jsonb_typeof(raw_data) = 'object'),
  constraint fuel_review_items_normalized_object check (jsonb_typeof(normalized_data) = 'object'),
  constraint fuel_review_items_batch_fk
    foreign key (batch_id, organization_id)
    references public.import_batches(id, organization_id)
    on delete cascade,
  constraint fuel_review_items_import_row_fk
    foreign key (import_row_id, organization_id)
    references public.import_rows(id, organization_id)
    on delete cascade,
  constraint fuel_review_items_promoted_event_fk
    foreign key (promoted_event_id, organization_id)
    references public.fueling_events(id, organization_id),
  unique (import_row_id),
  unique (id, organization_id)
);

create index if not exists fuel_review_items_queue_idx
  on public.fuel_review_items (organization_id, review_status, issue_count desc, created_at);
create index if not exists fuel_review_items_competence_idx
  on public.fuel_review_items (organization_id, competence, effective_date)
  where effective_date is not null;
create index if not exists fuel_review_items_prefix_idx
  on public.fuel_review_items (organization_id, lower(prefix_informed))
  where prefix_informed is not null;

create or replace function public.fuel_try_date(value text)
returns date
language plpgsql
immutable
as $$
declare
  parsed date;
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  parsed := value::date;
  return parsed;
exception
  when others then return null;
end
$$;

create or replace function public.fuel_try_numeric(value text)
returns numeric
language plpgsql
immutable
as $$
begin
  if nullif(btrim(value), '') is null then
    return null;
  end if;
  if position(',' in value) > 0 and position('.' in value) > 0 then
    return replace(replace(value, '.', ''), ',', '.')::numeric;
  end if;
  if position(',' in value) > 0 then
    return replace(value, ',', '.')::numeric;
  end if;
  return value::numeric;
exception
  when others then
    begin
      return value::numeric;
    exception
      when others then return null;
    end;
end
$$;

create or replace function public.stage_fuel_import(
  p_organization_id uuid,
  p_source_name text,
  p_source_type text,
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
  preserved_rows_value integer;
  review_rows_value integer;
  pending_rows_value integer;
begin
  batch_id_value := public.ingest_import_batch(
    p_organization_id,
    p_source_name,
    coalesce(nullif(btrim(p_source_type), ''), 'fuel-system'),
    'fueling_events',
    coalesce(nullif(btrim(p_worksheet_name), ''), 'ABASTECIMENTOS'),
    p_rows,
    p_created_by,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'module', 'fuel',
      'promotion', 'manual_only',
      'competenceRule', 'effective_date'
    )
  );

  update public.import_rows row_item
  set
    normalized_data = row_item.raw_data || jsonb_build_object(
      'competencia',
      case
        when public.fuel_try_date(row_item.raw_data ->> 'data') is not null
          then to_char(public.fuel_try_date(row_item.raw_data ->> 'data'), 'YYYY-MM')
        else ''
      end,
      'custoTotal',
      round(
        coalesce(public.fuel_try_numeric(row_item.raw_data ->> 'quantidadeLitros'), 0)
        * coalesce(public.fuel_try_numeric(row_item.raw_data ->> 'custoLitro'), 0),
        2
      )
    ),
    target_table = 'fueling_events',
    status = case
      when public.fuel_try_date(row_item.raw_data ->> 'data') is null then 'invalid'::public.import_row_status
      when jsonb_typeof(row_item.raw_data -> 'alertas') = 'array'
        and jsonb_array_length(row_item.raw_data -> 'alertas') > 0 then 'warning'::public.import_row_status
      else 'valid'::public.import_row_status
    end,
    updated_at = now()
  where row_item.organization_id = p_organization_id
    and row_item.batch_id = batch_id_value;

  insert into public.fuel_review_items (
    organization_id,
    batch_id,
    import_row_id,
    local_source_id,
    review_status,
    source_review_status,
    effective_date,
    competence,
    prefix_informed,
    quantity_liters,
    cost_per_liter,
    tank_capacity_liters,
    issue_count,
    issues,
    raw_data,
    normalized_data,
    created_by,
    updated_by
  )
  select
    row_item.organization_id,
    row_item.batch_id,
    row_item.id,
    nullif(btrim(coalesce(row_item.raw_data ->> 'id', row_item.source_key)), ''),
    'pending',
    nullif(btrim(row_item.raw_data ->> 'revisaoStatus'), ''),
    public.fuel_try_date(row_item.raw_data ->> 'data'),
    date_trunc('month', public.fuel_try_date(row_item.raw_data ->> 'data')::timestamp)::date,
    nullif(btrim(row_item.raw_data ->> 'prefixoInformado'), ''),
    public.fuel_try_numeric(row_item.raw_data ->> 'quantidadeLitros'),
    public.fuel_try_numeric(row_item.raw_data ->> 'custoLitro'),
    public.fuel_try_numeric(row_item.raw_data ->> 'capacidadeTanqueLitros'),
    case
      when jsonb_typeof(row_item.raw_data -> 'alertas') = 'array'
        then jsonb_array_length(row_item.raw_data -> 'alertas')
      else 0
    end,
    case
      when jsonb_typeof(row_item.raw_data -> 'alertas') = 'array'
        then row_item.raw_data -> 'alertas'
      else '[]'::jsonb
    end,
    row_item.raw_data,
    coalesce(row_item.normalized_data, '{}'::jsonb),
    p_created_by,
    p_created_by
  from public.import_rows row_item
  where row_item.organization_id = p_organization_id
    and row_item.batch_id = batch_id_value;

  select count(*) into preserved_rows_value
  from public.import_rows
  where organization_id = p_organization_id and batch_id = batch_id_value;

  select count(*), count(*) filter (where review_status = 'pending')
  into review_rows_value, pending_rows_value
  from public.fuel_review_items
  where organization_id = p_organization_id and batch_id = batch_id_value;

  update public.import_batches
  set
    status = case
      when exists (
        select 1 from public.import_rows
        where organization_id = p_organization_id
          and batch_id = batch_id_value
          and status in ('warning', 'invalid', 'duplicate', 'unmapped')
      ) then 'completed_with_warnings'::public.import_status
      else 'completed'::public.import_status
    end,
    valid_rows = (
      select count(*) from public.import_rows
      where organization_id = p_organization_id
        and batch_id = batch_id_value
        and status = 'valid'
    ),
    warning_rows = (
      select count(*) from public.import_rows
      where organization_id = p_organization_id
        and batch_id = batch_id_value
        and status = 'warning'
    ),
    invalid_rows = (
      select count(*) from public.import_rows
      where organization_id = p_organization_id
        and batch_id = batch_id_value
        and status = 'invalid'
    ),
    completed_at = now(),
    updated_at = now()
  where organization_id = p_organization_id and id = batch_id_value;

  return jsonb_build_object(
    'batchId', batch_id_value,
    'preservedRows', preserved_rows_value,
    'reviewRows', review_rows_value,
    'pendingRows', pending_rows_value
  );
end
$$;

create or replace view public.fuel_review_summary
with (security_invoker = true)
as
select
  organization_id,
  competence,
  review_status,
  count(*) as records,
  coalesce(sum(quantity_liters), 0) as total_liters,
  coalesce(sum(quantity_liters * coalesce(cost_per_liter, 0)), 0) as total_cost,
  sum(issue_count) as issue_count
from public.fuel_review_items
group by organization_id, competence, review_status;

drop trigger if exists fueling_events_set_updated_at on public.fueling_events;
create trigger fueling_events_set_updated_at
before update on public.fueling_events
for each row execute function public.set_updated_at();

drop trigger if exists fuel_review_items_set_updated_at on public.fuel_review_items;
create trigger fuel_review_items_set_updated_at
before update on public.fuel_review_items
for each row execute function public.set_updated_at();

drop trigger if exists fueling_events_audit on public.fueling_events;
create trigger fueling_events_audit
after insert or update or delete on public.fueling_events
for each row execute function public.audit_row_change();

drop trigger if exists fuel_review_items_audit on public.fuel_review_items;
create trigger fuel_review_items_audit
after insert or update or delete on public.fuel_review_items
for each row execute function public.audit_row_change();

alter table public.fueling_events enable row level security;
alter table public.fuel_review_items enable row level security;

drop policy if exists fueling_events_select_own on public.fueling_events;
create policy fueling_events_select_own
  on public.fueling_events
  for select
  to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);

drop policy if exists fueling_events_write_own on public.fueling_events;
create policy fueling_events_write_own
  on public.fueling_events
  for all
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_app_role() in ('admin', 'gestor', 'operador')
    and deleted_at is null
  )
  with check (
    organization_id = public.current_organization_id()
    and public.current_app_role() in ('admin', 'gestor', 'operador')
  );

drop policy if exists fuel_review_items_select_own on public.fuel_review_items;
create policy fuel_review_items_select_own
  on public.fuel_review_items
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists fuel_review_items_write_own on public.fuel_review_items;
create policy fuel_review_items_write_own
  on public.fuel_review_items
  for all
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_app_role() in ('admin', 'gestor', 'operador')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.current_app_role() in ('admin', 'gestor', 'operador')
  );

revoke all on function public.stage_fuel_import(uuid, text, text, text, jsonb, uuid, jsonb) from public;
grant execute on function public.stage_fuel_import(uuid, text, text, text, jsonb, uuid, jsonb) to service_role;

commit;

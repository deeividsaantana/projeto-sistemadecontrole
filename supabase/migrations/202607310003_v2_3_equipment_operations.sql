begin;

alter table public.equipment
  add column if not exists fleet_kind text not null default 'equipment',
  add column if not exists external_sge_code text,
  add column if not exists family text,
  add column if not exists mobilized boolean not null default false,
  add column if not exists availability_target numeric(7,6),
  add column if not exists mobilized_at date,
  add column if not exists demobilized_at date,
  add column if not exists responsible_operator_id uuid,
  add column if not exists responsible_operator_name text,
  add column if not exists fuel_type_id uuid,
  add column if not exists fuel_name text,
  add column if not exists tank_capacity_liters numeric(14,3),
  add column if not exists linked_equipment_id uuid;

alter table public.vehicles
  add column if not exists external_sge_code text,
  add column if not exists family text,
  add column if not exists mobilized boolean not null default false,
  add column if not exists mobilized_at date,
  add column if not exists demobilized_at date,
  add column if not exists responsible_operator_id uuid,
  add column if not exists responsible_operator_name text,
  add column if not exists linked_equipment_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipment_fleet_kind_check') then
    alter table public.equipment
      add constraint equipment_fleet_kind_check
      check (fleet_kind in ('equipment', 'vehicle', 'implement'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_availability_target_check') then
    alter table public.equipment
      add constraint equipment_availability_target_check
      check (availability_target is null or availability_target between 0 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_tank_capacity_check') then
    alter table public.equipment
      add constraint equipment_tank_capacity_check
      check (tank_capacity_liters is null or tank_capacity_liters > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_mobilization_dates_check') then
    alter table public.equipment
      add constraint equipment_mobilization_dates_check
      check (demobilized_at is null or mobilized_at is null or demobilized_at >= mobilized_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_responsible_operator_fk') then
    alter table public.equipment
      add constraint equipment_responsible_operator_fk
      foreign key (responsible_operator_id, organization_id)
      references public.collaborators(id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_fuel_type_fk') then
    alter table public.equipment
      add constraint equipment_fuel_type_fk
      foreign key (fuel_type_id, organization_id)
      references public.fuel_types(id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_linked_equipment_fk') then
    alter table public.equipment
      add constraint equipment_linked_equipment_fk
      foreign key (linked_equipment_id, organization_id)
      references public.equipment(id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicles_mobilization_dates_check') then
    alter table public.vehicles
      add constraint vehicles_mobilization_dates_check
      check (demobilized_at is null or mobilized_at is null or demobilized_at >= mobilized_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicles_responsible_operator_fk') then
    alter table public.vehicles
      add constraint vehicles_responsible_operator_fk
      foreign key (responsible_operator_id, organization_id)
      references public.collaborators(id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicles_linked_equipment_fk') then
    alter table public.vehicles
      add constraint vehicles_linked_equipment_fk
      foreign key (linked_equipment_id, organization_id)
      references public.equipment(id, organization_id);
  end if;
end
$$;

create unique index if not exists equipment_external_sge_code_active_uidx
  on public.equipment (organization_id, lower(external_sge_code))
  where external_sge_code is not null and deleted_at is null;
create index if not exists equipment_fleet_kind_idx
  on public.equipment (organization_id, fleet_kind, status)
  where deleted_at is null;
create index if not exists equipment_responsible_operator_idx
  on public.equipment (organization_id, responsible_operator_id)
  where responsible_operator_id is not null and deleted_at is null;
create index if not exists vehicles_responsible_operator_idx
  on public.vehicles (organization_id, responsible_operator_id)
  where responsible_operator_id is not null and deleted_at is null;

create table if not exists public.equipment_external_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid,
  vehicle_id uuid,
  source_system text not null,
  external_identifier citext not null,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint equipment_external_identifiers_target_check check (
    (equipment_id is not null and vehicle_id is null)
    or (equipment_id is null and vehicle_id is not null)
  ),
  constraint equipment_external_identifiers_source_not_blank check (btrim(source_system) <> ''),
  constraint equipment_external_identifiers_value_not_blank check (btrim(external_identifier::text) <> ''),
  constraint equipment_external_identifiers_dates_check check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  ),
  constraint equipment_external_identifiers_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint equipment_external_identifiers_equipment_fk
    foreign key (equipment_id, organization_id)
    references public.equipment(id, organization_id),
  constraint equipment_external_identifiers_vehicle_fk
    foreign key (vehicle_id, organization_id)
    references public.vehicles(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists equipment_external_identifiers_active_uidx
  on public.equipment_external_identifiers (
    organization_id,
    lower(source_system),
    lower(external_identifier::text)
  )
  where active and deleted_at is null;

create table if not exists public.equipment_mobilizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid,
  vehicle_id uuid,
  location_id uuid,
  started_at date not null,
  ended_at date,
  status text not null default 'Mobilizado',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint equipment_mobilizations_target_check check (
    (equipment_id is not null and vehicle_id is null)
    or (equipment_id is null and vehicle_id is not null)
  ),
  constraint equipment_mobilizations_dates_check check (ended_at is null or ended_at >= started_at),
  constraint equipment_mobilizations_status_not_blank check (btrim(status) <> ''),
  constraint equipment_mobilizations_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint equipment_mobilizations_equipment_fk
    foreign key (equipment_id, organization_id)
    references public.equipment(id, organization_id),
  constraint equipment_mobilizations_vehicle_fk
    foreign key (vehicle_id, organization_id)
    references public.vehicles(id, organization_id),
  constraint equipment_mobilizations_location_fk
    foreign key (location_id, organization_id)
    references public.locations(id, organization_id),
  unique (id, organization_id)
);

create index if not exists equipment_mobilizations_equipment_period_idx
  on public.equipment_mobilizations (organization_id, equipment_id, started_at desc)
  where deleted_at is null;
create index if not exists equipment_mobilizations_vehicle_period_idx
  on public.equipment_mobilizations (organization_id, vehicle_id, started_at desc)
  where deleted_at is null;

create table if not exists public.equipment_operator_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid,
  vehicle_id uuid,
  collaborator_id uuid,
  operator_name text,
  started_at date not null,
  ended_at date,
  primary_operator boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint equipment_operator_assignments_target_check check (
    (equipment_id is not null and vehicle_id is null)
    or (equipment_id is null and vehicle_id is not null)
  ),
  constraint equipment_operator_assignments_operator_check check (
    collaborator_id is not null or nullif(btrim(operator_name), '') is not null
  ),
  constraint equipment_operator_assignments_dates_check check (ended_at is null or ended_at >= started_at),
  constraint equipment_operator_assignments_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint equipment_operator_assignments_equipment_fk
    foreign key (equipment_id, organization_id)
    references public.equipment(id, organization_id),
  constraint equipment_operator_assignments_vehicle_fk
    foreign key (vehicle_id, organization_id)
    references public.vehicles(id, organization_id),
  constraint equipment_operator_assignments_collaborator_fk
    foreign key (collaborator_id, organization_id)
    references public.collaborators(id, organization_id),
  unique (id, organization_id)
);

create index if not exists equipment_operator_assignments_equipment_period_idx
  on public.equipment_operator_assignments (organization_id, equipment_id, started_at desc)
  where deleted_at is null;
create index if not exists equipment_operator_assignments_vehicle_period_idx
  on public.equipment_operator_assignments (organization_id, vehicle_id, started_at desc)
  where deleted_at is null;

create table if not exists public.equipment_operational_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid,
  vehicle_id uuid,
  event_type text not null,
  source_module text not null,
  source_record_id text,
  effective_at timestamptz not null,
  status text,
  operator_id uuid,
  operator_name text,
  scheduled_hours numeric(12,2),
  available_hours numeric(12,2),
  unavailable_hours numeric(12,2),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint equipment_operational_events_target_check check (
    (equipment_id is not null and vehicle_id is null)
    or (equipment_id is null and vehicle_id is not null)
  ),
  constraint equipment_operational_events_type_check check (
    event_type in ('daily_part', 'maintenance', 'availability', 'status')
  ),
  constraint equipment_operational_events_source_not_blank check (btrim(source_module) <> ''),
  constraint equipment_operational_events_hours_check check (
    (scheduled_hours is null or scheduled_hours >= 0)
    and (available_hours is null or available_hours >= 0)
    and (unavailable_hours is null or unavailable_hours >= 0)
  ),
  constraint equipment_operational_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint equipment_operational_events_equipment_fk
    foreign key (equipment_id, organization_id)
    references public.equipment(id, organization_id),
  constraint equipment_operational_events_vehicle_fk
    foreign key (vehicle_id, organization_id)
    references public.vehicles(id, organization_id),
  constraint equipment_operational_events_operator_fk
    foreign key (operator_id, organization_id)
    references public.collaborators(id, organization_id),
  unique (id, organization_id)
);

create index if not exists equipment_operational_events_equipment_date_idx
  on public.equipment_operational_events (organization_id, equipment_id, effective_at desc)
  where deleted_at is null;
create index if not exists equipment_operational_events_vehicle_date_idx
  on public.equipment_operational_events (organization_id, vehicle_id, effective_at desc)
  where deleted_at is null;
create unique index if not exists equipment_operational_events_source_uidx
  on public.equipment_operational_events (organization_id, source_module, source_record_id, event_type)
  where source_record_id is not null and deleted_at is null;

drop trigger if exists set_equipment_external_identifiers_updated_at on public.equipment_external_identifiers;
create trigger set_equipment_external_identifiers_updated_at
  before update on public.equipment_external_identifiers
  for each row execute function public.set_updated_at();
drop trigger if exists audit_equipment_external_identifiers on public.equipment_external_identifiers;
create trigger audit_equipment_external_identifiers
  after insert or update or delete on public.equipment_external_identifiers
  for each row execute function public.audit_row_change();

drop trigger if exists set_equipment_mobilizations_updated_at on public.equipment_mobilizations;
create trigger set_equipment_mobilizations_updated_at
  before update on public.equipment_mobilizations
  for each row execute function public.set_updated_at();
drop trigger if exists audit_equipment_mobilizations on public.equipment_mobilizations;
create trigger audit_equipment_mobilizations
  after insert or update or delete on public.equipment_mobilizations
  for each row execute function public.audit_row_change();

drop trigger if exists set_equipment_operator_assignments_updated_at on public.equipment_operator_assignments;
create trigger set_equipment_operator_assignments_updated_at
  before update on public.equipment_operator_assignments
  for each row execute function public.set_updated_at();
drop trigger if exists audit_equipment_operator_assignments on public.equipment_operator_assignments;
create trigger audit_equipment_operator_assignments
  after insert or update or delete on public.equipment_operator_assignments
  for each row execute function public.audit_row_change();

drop trigger if exists set_equipment_operational_events_updated_at on public.equipment_operational_events;
create trigger set_equipment_operational_events_updated_at
  before update on public.equipment_operational_events
  for each row execute function public.set_updated_at();
drop trigger if exists audit_equipment_operational_events on public.equipment_operational_events;
create trigger audit_equipment_operational_events
  after insert or update or delete on public.equipment_operational_events
  for each row execute function public.audit_row_change();

alter table public.master_data_aliases
  drop constraint if exists master_data_aliases_entity_name_check;
alter table public.master_data_aliases
  add constraint master_data_aliases_entity_name_check check (
    entity_name in (
      'companies',
      'suppliers',
      'materials',
      'locations',
      'work_branches',
      'collaborators',
      'equipment',
      'vehicles'
    )
  );

alter table public.master_data_review_items
  drop constraint if exists master_data_review_items_entity_name_check;
alter table public.master_data_review_items
  add constraint master_data_review_items_entity_name_check check (
    entity_name in (
      'companies',
      'suppliers',
      'materials',
      'locations',
      'work_branches',
      'collaborators',
      'equipment',
      'vehicles'
    )
  );

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
  if p_entity_name not in (
    'companies',
    'suppliers',
    'materials',
    'locations',
    'work_branches',
    'collaborators',
    'equipment',
    'vehicles'
  ) then
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
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('workflow', 'master-data-review-v2.3')
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

create or replace view public.equipment_operational_overview
with (security_invoker = true)
as
select
  equipment.organization_id,
  equipment.id as equipment_id,
  equipment.prefix,
  equipment.name,
  equipment.fleet_kind,
  equipment.family,
  equipment.status,
  equipment.mobilized,
  equipment.availability_target,
  equipment.responsible_operator_id,
  equipment.responsible_operator_name,
  equipment.current_location_id,
  coalesce(sum(event.available_hours), equipment.available_hours, 0) as available_hours,
  coalesce(sum(event.unavailable_hours), equipment.unavailable_hours, 0) as unavailable_hours,
  case
    when coalesce(sum(event.available_hours), equipment.available_hours, 0)
       + coalesce(sum(event.unavailable_hours), equipment.unavailable_hours, 0) > 0
      then coalesce(sum(event.available_hours), equipment.available_hours, 0)
        / (
          coalesce(sum(event.available_hours), equipment.available_hours, 0)
          + coalesce(sum(event.unavailable_hours), equipment.unavailable_hours, 0)
        )
    else null
  end as mechanical_availability,
  count(*) filter (
    where event.event_type = 'maintenance'
      and coalesce(event.status, '') not in ('Concluída', 'Cancelada')
  ) as open_maintenance_events,
  max(event.effective_at) filter (where event.event_type = 'daily_part') as latest_daily_part_at
from public.equipment
left join public.equipment_operational_events as event
  on event.organization_id = equipment.organization_id
 and event.equipment_id = equipment.id
 and event.deleted_at is null
where equipment.deleted_at is null
group by equipment.id, equipment.organization_id;

alter table public.equipment_external_identifiers enable row level security;
alter table public.equipment_mobilizations enable row level security;
alter table public.equipment_operator_assignments enable row level security;
alter table public.equipment_operational_events enable row level security;

drop policy if exists equipment_external_identifiers_select_organization on public.equipment_external_identifiers;
create policy equipment_external_identifiers_select_organization
  on public.equipment_external_identifiers for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists equipment_external_identifiers_insert_organization on public.equipment_external_identifiers;
create policy equipment_external_identifiers_insert_organization
  on public.equipment_external_identifiers for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_external_identifiers_update_organization on public.equipment_external_identifiers;
create policy equipment_external_identifiers_update_organization
  on public.equipment_external_identifiers for update to authenticated
  using (organization_id = public.current_organization_id() and public.can_write_master_data())
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_external_identifiers_delete_organization on public.equipment_external_identifiers;
create policy equipment_external_identifiers_delete_organization
  on public.equipment_external_identifiers for delete to authenticated
  using (organization_id = public.current_organization_id() and public.can_archive_master_data());

drop policy if exists equipment_mobilizations_select_organization on public.equipment_mobilizations;
create policy equipment_mobilizations_select_organization
  on public.equipment_mobilizations for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists equipment_mobilizations_insert_organization on public.equipment_mobilizations;
create policy equipment_mobilizations_insert_organization
  on public.equipment_mobilizations for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_mobilizations_update_organization on public.equipment_mobilizations;
create policy equipment_mobilizations_update_organization
  on public.equipment_mobilizations for update to authenticated
  using (organization_id = public.current_organization_id() and public.can_write_master_data())
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_mobilizations_delete_organization on public.equipment_mobilizations;
create policy equipment_mobilizations_delete_organization
  on public.equipment_mobilizations for delete to authenticated
  using (organization_id = public.current_organization_id() and public.can_archive_master_data());

drop policy if exists equipment_operator_assignments_select_organization on public.equipment_operator_assignments;
create policy equipment_operator_assignments_select_organization
  on public.equipment_operator_assignments for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists equipment_operator_assignments_insert_organization on public.equipment_operator_assignments;
create policy equipment_operator_assignments_insert_organization
  on public.equipment_operator_assignments for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_operator_assignments_update_organization on public.equipment_operator_assignments;
create policy equipment_operator_assignments_update_organization
  on public.equipment_operator_assignments for update to authenticated
  using (organization_id = public.current_organization_id() and public.can_write_master_data())
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_operator_assignments_delete_organization on public.equipment_operator_assignments;
create policy equipment_operator_assignments_delete_organization
  on public.equipment_operator_assignments for delete to authenticated
  using (organization_id = public.current_organization_id() and public.can_archive_master_data());

drop policy if exists equipment_operational_events_select_organization on public.equipment_operational_events;
create policy equipment_operational_events_select_organization
  on public.equipment_operational_events for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists equipment_operational_events_insert_organization on public.equipment_operational_events;
create policy equipment_operational_events_insert_organization
  on public.equipment_operational_events for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_operational_events_update_organization on public.equipment_operational_events;
create policy equipment_operational_events_update_organization
  on public.equipment_operational_events for update to authenticated
  using (organization_id = public.current_organization_id() and public.can_write_master_data())
  with check (organization_id = public.current_organization_id() and public.can_write_master_data());
drop policy if exists equipment_operational_events_delete_organization on public.equipment_operational_events;
create policy equipment_operational_events_delete_organization
  on public.equipment_operational_events for delete to authenticated
  using (organization_id = public.current_organization_id() and public.can_archive_master_data());

revoke all on
  public.equipment_external_identifiers,
  public.equipment_mobilizations,
  public.equipment_operator_assignments,
  public.equipment_operational_events,
  public.equipment_operational_overview
from anon;

revoke all on function public.stage_master_data_import(uuid, text, text, text, jsonb, uuid, jsonb)
from public, anon, authenticated;

grant select, insert, update, delete on
  public.equipment_external_identifiers,
  public.equipment_mobilizations,
  public.equipment_operator_assignments,
  public.equipment_operational_events
to authenticated, service_role;

grant select on public.equipment_operational_overview to authenticated, service_role;
grant execute on function public.stage_master_data_import(uuid, text, text, text, jsonb, uuid, jsonb)
to service_role;

comment on table public.equipment_external_identifiers
  is 'Identificadores externos da frota, incluindo o código SGE usado no XLOOKUP das planilhas.';
comment on table public.equipment_mobilizations
  is 'Histórico de mobilização e desmobilização por equipamento ou veículo.';
comment on table public.equipment_operator_assignments
  is 'Histórico do operador responsável por equipamento ou veículo e período.';
comment on table public.equipment_operational_events
  is 'Integra partes diárias, manutenção, disponibilidade e mudanças de status sem duplicar o cadastro mestre.';
comment on view public.equipment_operational_overview
  is 'Visão consolidada de disponibilidade, manutenção e última parte diária por equipamento.';

commit;

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  create type public.app_role as enum ('admin', 'gestor', 'operador', 'leitura');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.import_status as enum ('pending', 'processing', 'completed', 'completed_with_warnings', 'failed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.import_row_status as enum ('pending', 'valid', 'warning', 'invalid', 'duplicate', 'unmapped', 'imported');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code citext not null,
  name text not null,
  legal_name text,
  tax_id text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_code_not_blank check (btrim(code::text) <> ''),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists organizations_code_active_uidx
  on public.organizations (lower(code::text))
  where deleted_at is null;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  firebase_uid text,
  email citext,
  full_name text not null,
  role public.app_role not null default 'leitura',
  active boolean not null default true,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint app_users_full_name_not_blank check (btrim(full_name) <> ''),
  constraint app_users_identity_required check (auth_user_id is not null or nullif(btrim(firebase_uid), '') is not null),
  constraint app_users_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (organization_id, firebase_uid),
  unique (id, organization_id)
);

create index if not exists app_users_organization_idx
  on public.app_users (organization_id, active)
  where deleted_at is null;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legacy_id text,
  code citext,
  name text not null,
  legal_name text,
  tax_id text,
  phone text,
  responsible_name text,
  company_type text not null default 'other',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint companies_name_not_blank check (btrim(name) <> ''),
  constraint companies_type_valid check (company_type in ('owner', 'contractor', 'supplier', 'customer', 'other')),
  constraint companies_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (id, organization_id)
);

create unique index if not exists companies_legacy_id_active_uidx
  on public.companies (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists companies_code_active_uidx
  on public.companies (organization_id, lower(code::text))
  where code is not null and deleted_at is null;
create unique index if not exists companies_tax_id_active_uidx
  on public.companies (organization_id, regexp_replace(tax_id, '[^0-9]', '', 'g'))
  where nullif(regexp_replace(tax_id, '[^0-9]', '', 'g'), '') is not null and deleted_at is null;
create index if not exists companies_name_idx
  on public.companies (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legacy_id text,
  code citext,
  name text not null,
  address text,
  responsible_name text,
  status text not null default 'Ativa',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint locations_name_not_blank check (btrim(name) <> ''),
  constraint locations_status_not_blank check (btrim(status) <> ''),
  constraint locations_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (id, organization_id)
);

create unique index if not exists locations_legacy_id_active_uidx
  on public.locations (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists locations_code_active_uidx
  on public.locations (organization_id, lower(code::text))
  where code is not null and deleted_at is null;
create index if not exists locations_name_idx
  on public.locations (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.work_branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  location_id uuid,
  legacy_id text,
  code citext,
  name text not null,
  description text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint work_branches_name_not_blank check (btrim(name) <> ''),
  constraint work_branches_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint work_branches_location_fk
    foreign key (location_id, organization_id)
    references public.locations(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists work_branches_legacy_id_active_uidx
  on public.work_branches (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists work_branches_code_active_uidx
  on public.work_branches (organization_id, lower(code::text))
  where code is not null and deleted_at is null;
create index if not exists work_branches_location_idx
  on public.work_branches (organization_id, location_id)
  where deleted_at is null;

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid,
  current_location_id uuid,
  legacy_id text,
  prefix citext not null,
  name text not null,
  equipment_type text,
  brand text,
  model text,
  serial_number text,
  license_plate citext,
  status text not null default 'Ativo',
  notes text,
  photo_url text,
  available_hours numeric(12,2) not null default 0,
  unavailable_hours numeric(12,2) not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint equipment_prefix_not_blank check (btrim(prefix::text) <> ''),
  constraint equipment_name_not_blank check (btrim(name) <> ''),
  constraint equipment_status_not_blank check (btrim(status) <> ''),
  constraint equipment_hours_non_negative check (available_hours >= 0 and unavailable_hours >= 0),
  constraint equipment_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint equipment_company_fk
    foreign key (company_id, organization_id)
    references public.companies(id, organization_id),
  constraint equipment_location_fk
    foreign key (current_location_id, organization_id)
    references public.locations(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists equipment_legacy_id_active_uidx
  on public.equipment (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists equipment_prefix_active_uidx
  on public.equipment (organization_id, lower(prefix::text))
  where deleted_at is null;
create index if not exists equipment_license_plate_idx
  on public.equipment (organization_id, lower(license_plate::text))
  where license_plate is not null and deleted_at is null;
create index if not exists equipment_company_idx
  on public.equipment (organization_id, company_id)
  where deleted_at is null;
create index if not exists equipment_location_idx
  on public.equipment (organization_id, current_location_id)
  where deleted_at is null;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid,
  current_location_id uuid,
  legacy_id text,
  prefix citext,
  license_plate citext not null,
  name text not null,
  vehicle_type text,
  brand text,
  model text,
  status text not null default 'Ativo',
  capacity numeric(14,3),
  capacity_unit text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vehicles_plate_not_blank check (btrim(license_plate::text) <> ''),
  constraint vehicles_name_not_blank check (btrim(name) <> ''),
  constraint vehicles_status_not_blank check (btrim(status) <> ''),
  constraint vehicles_capacity_positive check (capacity is null or capacity > 0),
  constraint vehicles_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint vehicles_company_fk
    foreign key (company_id, organization_id)
    references public.companies(id, organization_id),
  constraint vehicles_location_fk
    foreign key (current_location_id, organization_id)
    references public.locations(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists vehicles_legacy_id_active_uidx
  on public.vehicles (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists vehicles_plate_active_uidx
  on public.vehicles (organization_id, lower(license_plate::text))
  where deleted_at is null;
create unique index if not exists vehicles_prefix_active_uidx
  on public.vehicles (organization_id, lower(prefix::text))
  where prefix is not null and deleted_at is null;

create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid,
  legacy_id text,
  registration citext,
  name text not null,
  job_title text,
  phone text,
  email citext,
  leader_registration text,
  leader_name text,
  area text,
  area_responsible text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint collaborators_name_not_blank check (btrim(name) <> ''),
  constraint collaborators_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint collaborators_company_fk
    foreign key (company_id, organization_id)
    references public.companies(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists collaborators_legacy_id_active_uidx
  on public.collaborators (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists collaborators_registration_active_uidx
  on public.collaborators (organization_id, lower(registration::text))
  where registration is not null and deleted_at is null;
create index if not exists collaborators_name_idx
  on public.collaborators (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid not null,
  legacy_id text,
  code citext,
  contact_name text,
  phone text,
  email citext,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint suppliers_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint suppliers_company_fk
    foreign key (company_id, organization_id)
    references public.companies(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists suppliers_company_active_uidx
  on public.suppliers (organization_id, company_id)
  where deleted_at is null;
create unique index if not exists suppliers_legacy_id_active_uidx
  on public.suppliers (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists suppliers_code_active_uidx
  on public.suppliers (organization_id, lower(code::text))
  where code is not null and deleted_at is null;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  default_supplier_id uuid,
  legacy_id text,
  code citext,
  name text not null,
  category text not null default 'Outros',
  default_unit text not null,
  density numeric(14,6),
  reference_value numeric(16,4),
  status text not null default 'Ativo',
  notes text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint materials_name_not_blank check (btrim(name) <> ''),
  constraint materials_category_not_blank check (btrim(category) <> ''),
  constraint materials_unit_not_blank check (btrim(default_unit) <> ''),
  constraint materials_density_positive check (density is null or density > 0),
  constraint materials_reference_value_non_negative check (reference_value is null or reference_value >= 0),
  constraint materials_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint materials_supplier_fk
    foreign key (default_supplier_id, organization_id)
    references public.suppliers(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists materials_legacy_id_active_uidx
  on public.materials (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists materials_code_active_uidx
  on public.materials (organization_id, lower(code::text))
  where code is not null and deleted_at is null;
create index if not exists materials_name_idx
  on public.materials (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.convoys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  responsible_collaborator_id uuid,
  legacy_id text,
  code citext,
  name text not null,
  license_plate citext,
  capacity_liters numeric(14,3) not null,
  responsible_name text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint convoys_name_not_blank check (btrim(name) <> ''),
  constraint convoys_capacity_positive check (capacity_liters > 0),
  constraint convoys_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint convoys_responsible_fk
    foreign key (responsible_collaborator_id, organization_id)
    references public.collaborators(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists convoys_legacy_id_active_uidx
  on public.convoys (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists convoys_code_active_uidx
  on public.convoys (organization_id, lower(code::text))
  where code is not null and deleted_at is null;
create unique index if not exists convoys_plate_active_uidx
  on public.convoys (organization_id, lower(license_plate::text))
  where license_plate is not null and deleted_at is null;

create table if not exists public.fuel_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legacy_id text,
  code citext,
  name text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fuel_types_name_not_blank check (btrim(name) <> ''),
  constraint fuel_types_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (id, organization_id)
);

create unique index if not exists fuel_types_legacy_id_active_uidx
  on public.fuel_types (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists fuel_types_name_active_uidx
  on public.fuel_types (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.lubricant_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legacy_id text,
  code citext,
  name text not null,
  default_unit text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lubricant_products_name_not_blank check (btrim(name) <> ''),
  constraint lubricant_products_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (id, organization_id)
);

create unique index if not exists lubricant_products_legacy_id_active_uidx
  on public.lubricant_products (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists lubricant_products_name_active_uidx
  on public.lubricant_products (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.service_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_branch_id uuid,
  legacy_id text,
  code citext,
  name text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint service_stages_name_not_blank check (btrim(name) <> ''),
  constraint service_stages_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint service_stages_branch_fk
    foreign key (work_branch_id, organization_id)
    references public.work_branches(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists service_stages_legacy_id_active_uidx
  on public.service_stages (organization_id, legacy_id)
  where legacy_id is not null and deleted_at is null;
create unique index if not exists service_stages_name_active_uidx
  on public.service_stages (organization_id, lower(name))
  where deleted_at is null;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  entity_name text,
  source_name text not null,
  source_type text not null default 'xlsx',
  worksheet_name text,
  source_hash text,
  status public.import_status not null default 'pending',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  imported_rows integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_batches_source_name_not_blank check (btrim(source_name) <> ''),
  constraint import_batches_counts_non_negative check (
    total_rows >= 0 and valid_rows >= 0 and warning_rows >= 0
    and invalid_rows >= 0 and duplicate_rows >= 0 and imported_rows >= 0
  ),
  constraint import_batches_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (id, organization_id)
);

create index if not exists import_batches_organization_status_idx
  on public.import_batches (organization_id, status, created_at desc);
create index if not exists import_batches_source_hash_idx
  on public.import_batches (organization_id, source_hash)
  where source_hash is not null;

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  row_number integer not null,
  source_key text,
  status public.import_row_status not null default 'pending',
  raw_data jsonb not null,
  normalized_data jsonb,
  target_table text,
  target_id uuid,
  fingerprint text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_rows_number_positive check (row_number > 0),
  constraint import_rows_raw_data_valid check (jsonb_typeof(raw_data) in ('object', 'array', 'string', 'number', 'boolean', 'null')),
  constraint import_rows_normalized_object check (normalized_data is null or jsonb_typeof(normalized_data) = 'object'),
  constraint import_rows_batch_fk
    foreign key (batch_id, organization_id)
    references public.import_batches(id, organization_id)
    on delete cascade,
  unique (batch_id, row_number),
  unique (id, organization_id)
);

create index if not exists import_rows_batch_status_idx
  on public.import_rows (organization_id, batch_id, status, row_number);
create index if not exists import_rows_fingerprint_idx
  on public.import_rows (organization_id, fingerprint)
  where fingerprint is not null;

create table if not exists public.import_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  row_id uuid,
  severity text not null,
  code text not null,
  field_name text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_by uuid references public.app_users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_issues_severity_valid check (severity in ('info', 'warning', 'error')),
  constraint import_issues_code_not_blank check (btrim(code) <> ''),
  constraint import_issues_message_not_blank check (btrim(message) <> ''),
  constraint import_issues_details_object check (jsonb_typeof(details) = 'object'),
  constraint import_issues_batch_fk
    foreign key (batch_id, organization_id)
    references public.import_batches(id, organization_id)
    on delete cascade,
  constraint import_issues_row_fk
    foreign key (row_id, organization_id)
    references public.import_rows(id, organization_id)
    on delete cascade
);

create index if not exists import_issues_review_idx
  on public.import_issues (organization_id, batch_id, resolved, severity);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_user_id uuid references public.app_users(id),
  table_name text not null,
  record_id uuid,
  operation text not null,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] not null default '{}',
  request_claims jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_events_operation_valid check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  constraint audit_events_claims_object check (jsonb_typeof(request_claims) = 'object')
);

create index if not exists audit_events_organization_time_idx
  on public.audit_events (organization_id, occurred_at desc);
create index if not exists audit_events_record_idx
  on public.audit_events (organization_id, table_name, record_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select user_record.id
  from public.app_users as user_record
  where user_record.auth_user_id = auth.uid()
    and user_record.active = true
    and user_record.deleted_at is null
  limit 1
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select user_record.organization_id
  from public.app_users as user_record
  where user_record.auth_user_id = auth.uid()
    and user_record.active = true
    and user_record.deleted_at is null
  limit 1
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select user_record.role
  from public.app_users as user_record
  where user_record.auth_user_id = auth.uid()
    and user_record.active = true
    and user_record.deleted_at is null
  limit 1
$$;

create or replace function public.can_write_master_data()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_app_role() in ('admin', 'gestor', 'operador'), false)
$$;

create or replace function public.can_archive_master_data()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_app_role() in ('admin', 'gestor'), false)
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_payload jsonb;
  new_payload jsonb;
  organization_value uuid;
  actor_value uuid;
  record_value uuid;
  claims_value jsonb;
  changed_value text[];
begin
  old_payload := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_payload := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  organization_value := nullif(coalesce(new_payload ->> 'organization_id', old_payload ->> 'organization_id'), '')::uuid;
  record_value := nullif(coalesce(new_payload ->> 'id', old_payload ->> 'id'), '')::uuid;
  actor_value := nullif(coalesce(new_payload ->> 'updated_by', new_payload ->> 'created_by', old_payload ->> 'updated_by'), '')::uuid;

  begin
    claims_value := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  exception
    when others then claims_value := '{}'::jsonb;
  end;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}')
    into changed_value
    from jsonb_each(new_payload) as new_item(key, value)
    where old_payload -> new_item.key is distinct from new_item.value;
  else
    changed_value := '{}';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    changed_fields,
    request_claims
  )
  values (
    organization_value,
    actor_value,
    tg_table_name,
    record_value,
    tg_op,
    old_payload,
    new_payload,
    changed_value,
    claims_value
  );

  return null;
end
$$;

do $$
declare
  table_name_value text;
  audited_tables text[] := array[
    'app_users',
    'companies',
    'locations',
    'work_branches',
    'equipment',
    'vehicles',
    'collaborators',
    'suppliers',
    'materials',
    'convoys',
    'fuel_types',
    'lubricant_products',
    'service_stages',
    'import_batches',
    'import_rows',
    'import_issues'
  ];
begin
  foreach table_name_value in array audited_tables loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name_value, table_name_value);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name_value,
      table_name_value
    );

    execute format('drop trigger if exists %I_audit_change on public.%I', table_name_value, table_name_value);
    execute format(
      'create trigger %I_audit_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      table_name_value,
      table_name_value
    );
  end loop;
end
$$;

create or replace function public.bootstrap_organization(
  p_id uuid,
  p_code text,
  p_name text,
  p_legal_name text default null,
  p_tax_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_code), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'Código e nome da organização são obrigatórios.';
  end if;

  insert into public.organizations (id, code, name, legal_name, tax_id)
  values (p_id, btrim(p_code), btrim(p_name), nullif(btrim(p_legal_name), ''), nullif(btrim(p_tax_id), ''))
  on conflict (id) do update
  set code = excluded.code,
      name = excluded.name,
      legal_name = excluded.legal_name,
      tax_id = excluded.tax_id,
      active = true,
      deleted_at = null,
      updated_at = now();

  return p_id;
end
$$;

create or replace function public.ingest_import_batch(
  p_organization_id uuid,
  p_source_name text,
  p_source_type text,
  p_entity_name text,
  p_worksheet_name text,
  p_rows jsonb,
  p_created_by uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_id_value uuid;
  row_count_value integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'As linhas da importação devem ser enviadas como uma lista JSON.';
  end if;

  row_count_value := jsonb_array_length(p_rows);
  if row_count_value > 5000 then
    raise exception 'Cada lote pode preservar no máximo 5000 linhas.';
  end if;

  insert into public.import_batches (
    organization_id,
    entity_name,
    source_name,
    source_type,
    worksheet_name,
    status,
    total_rows,
    metadata,
    created_by
  )
  values (
    p_organization_id,
    nullif(btrim(p_entity_name), ''),
    btrim(p_source_name),
    coalesce(nullif(btrim(p_source_type), ''), 'xlsx'),
    nullif(btrim(p_worksheet_name), ''),
    'pending',
    row_count_value,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning id into batch_id_value;

  insert into public.import_rows (
    organization_id,
    batch_id,
    row_number,
    source_key,
    raw_data
  )
  select
    p_organization_id,
    batch_id_value,
    item.ordinality::integer,
    nullif(btrim(item.value ->> 'sourceRowId'), ''),
    item.value
  from jsonb_array_elements(p_rows) with ordinality as item(value, ordinality);

  return batch_id_value;
end
$$;

create or replace view public.master_data_catalog
with (security_invoker = true)
as
  select organization_id, 'companies'::text as entity, id, coalesce(code::text, legacy_id) as code, name, active, updated_at
  from public.companies where deleted_at is null
  union all
  select organization_id, 'locations', id, coalesce(code::text, legacy_id), name, active, updated_at
  from public.locations where deleted_at is null
  union all
  select organization_id, 'work_branches', id, coalesce(code::text, legacy_id), name, active, updated_at
  from public.work_branches where deleted_at is null
  union all
  select organization_id, 'equipment', id, prefix::text, name, active, updated_at
  from public.equipment where deleted_at is null
  union all
  select organization_id, 'vehicles', id, coalesce(prefix::text, license_plate::text), name, active, updated_at
  from public.vehicles where deleted_at is null
  union all
  select organization_id, 'collaborators', id, coalesce(registration::text, legacy_id), name, active, updated_at
  from public.collaborators where deleted_at is null
  union all
  select supplier.organization_id, 'suppliers', supplier.id, coalesce(supplier.code::text, supplier.legacy_id), company.name, supplier.active, supplier.updated_at
  from public.suppliers as supplier
  join public.companies as company
    on company.id = supplier.company_id
   and company.organization_id = supplier.organization_id
   and company.deleted_at is null
  where supplier.deleted_at is null
  union all
  select organization_id, 'materials', id, coalesce(code::text, legacy_id), name, active, updated_at
  from public.materials where deleted_at is null
  union all
  select organization_id, 'convoys', id, coalesce(code::text, license_plate::text), name, active, updated_at
  from public.convoys where deleted_at is null
  union all
  select organization_id, 'fuel_types', id, coalesce(code::text, legacy_id), name, active, updated_at
  from public.fuel_types where deleted_at is null
  union all
  select organization_id, 'lubricant_products', id, coalesce(code::text, legacy_id), name, active, updated_at
  from public.lubricant_products where deleted_at is null
  union all
  select organization_id, 'service_stages', id, coalesce(code::text, legacy_id), name, active, updated_at
  from public.service_stages where deleted_at is null;

alter table public.organizations enable row level security;
alter table public.app_users enable row level security;
alter table public.companies enable row level security;
alter table public.locations enable row level security;
alter table public.work_branches enable row level security;
alter table public.equipment enable row level security;
alter table public.vehicles enable row level security;
alter table public.collaborators enable row level security;
alter table public.suppliers enable row level security;
alter table public.materials enable row level security;
alter table public.convoys enable row level security;
alter table public.fuel_types enable row level security;
alter table public.lubricant_products enable row level security;
alter table public.service_stages enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.import_issues enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own
  on public.organizations
  for select
  to authenticated
  using (id = public.current_organization_id() and deleted_at is null);

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update
  on public.organizations
  for update
  to authenticated
  using (id = public.current_organization_id() and public.current_app_role() = 'admin' and deleted_at is null)
  with check (id = public.current_organization_id() and public.current_app_role() = 'admin');

drop policy if exists app_users_select_organization on public.app_users;
create policy app_users_select_organization
  on public.app_users
  for select
  to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);

drop policy if exists app_users_admin_insert on public.app_users;
create policy app_users_admin_insert
  on public.app_users
  for insert
  to authenticated
  with check (organization_id = public.current_organization_id() and public.current_app_role() = 'admin');

drop policy if exists app_users_admin_update on public.app_users;
create policy app_users_admin_update
  on public.app_users
  for update
  to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() = 'admin' and deleted_at is null)
  with check (organization_id = public.current_organization_id() and public.current_app_role() = 'admin');

do $$
declare
  table_name_value text;
  scoped_tables text[] := array[
    'companies',
    'locations',
    'work_branches',
    'equipment',
    'vehicles',
    'collaborators',
    'suppliers',
    'materials',
    'convoys',
    'fuel_types',
    'lubricant_products',
    'service_stages',
    'import_batches',
    'import_rows',
    'import_issues'
  ];
begin
  foreach table_name_value in array scoped_tables loop
    execute format('drop policy if exists %I_select_organization on public.%I', table_name_value, table_name_value);
    execute format(
      'create policy %I_select_organization on public.%I for select to authenticated using (organization_id = public.current_organization_id())',
      table_name_value,
      table_name_value
    );

    execute format('drop policy if exists %I_insert_organization on public.%I', table_name_value, table_name_value);
    execute format(
      'create policy %I_insert_organization on public.%I for insert to authenticated with check (organization_id = public.current_organization_id() and public.can_write_master_data())',
      table_name_value,
      table_name_value
    );

    execute format('drop policy if exists %I_update_organization on public.%I', table_name_value, table_name_value);
    execute format(
      'create policy %I_update_organization on public.%I for update to authenticated using (organization_id = public.current_organization_id() and public.can_write_master_data()) with check (organization_id = public.current_organization_id() and public.can_write_master_data())',
      table_name_value,
      table_name_value
    );

    execute format('drop policy if exists %I_delete_organization on public.%I', table_name_value, table_name_value);
    execute format(
      'create policy %I_delete_organization on public.%I for delete to authenticated using (organization_id = public.current_organization_id() and public.can_archive_master_data())',
      table_name_value,
      table_name_value
    );
  end loop;
end
$$;

drop policy if exists audit_events_select_management on public.audit_events;
create policy audit_events_select_management
  on public.audit_events
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_app_role() in ('admin', 'gestor')
  );

revoke all on
  public.organizations,
  public.app_users,
  public.companies,
  public.locations,
  public.work_branches,
  public.equipment,
  public.vehicles,
  public.collaborators,
  public.suppliers,
  public.materials,
  public.convoys,
  public.fuel_types,
  public.lubricant_products,
  public.service_stages,
  public.import_batches,
  public.import_rows,
  public.import_issues,
  public.audit_events,
  public.master_data_catalog
from anon;
revoke all on function public.bootstrap_organization(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ingest_import_batch(uuid, text, text, text, text, jsonb, uuid, jsonb) from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.organizations,
  public.app_users,
  public.companies,
  public.locations,
  public.work_branches,
  public.equipment,
  public.vehicles,
  public.collaborators,
  public.suppliers,
  public.materials,
  public.convoys,
  public.fuel_types,
  public.lubricant_products,
  public.service_stages,
  public.import_batches,
  public.import_rows,
  public.import_issues
to authenticated, service_role;
grant select on public.audit_events, public.master_data_catalog to authenticated, service_role;
grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.current_organization_id() to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.can_write_master_data() to authenticated, service_role;
grant execute on function public.can_archive_master_data() to authenticated, service_role;
grant execute on function public.bootstrap_organization(uuid, text, text, text, text) to service_role;
grant execute on function public.ingest_import_batch(uuid, text, text, text, text, jsonb, uuid, jsonb) to service_role;

comment on table public.organizations is 'Tenant raiz. Todo dado operacional pertence a uma organização.';
comment on table public.app_users is 'Espelho de identidade e perfil. Firebase continua autenticando durante a migração gradual.';
comment on table public.import_rows is 'Preserva cada linha bruta recebida, inclusive inválida, duplicada ou ainda não mapeada.';
comment on table public.audit_events is 'Trilha imutável de alterações produzida por gatilhos.';
comment on view public.master_data_catalog is 'Catálogo unificado de cadastros mestres ativos para pesquisa e integrações.';
comment on function public.ingest_import_batch(uuid, text, text, text, text, jsonb, uuid, jsonb)
  is 'Registra um lote e todas as linhas brutas em uma única transação, sem descarte silencioso.';

commit;

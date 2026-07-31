begin;

create table if not exists public.travel_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ticket_number citext not null,
  local_source_id text,
  equipment_id uuid,
  material_id uuid,
  origin_location_id uuid,
  destination_location_id uuid,
  work_branch_id uuid,
  quantity numeric(14,3),
  quantity_unit text not null default 'm³',
  company_label text,
  destination_label text,
  stake_label text,
  flow_status text not null default 'draft',
  source_type text not null default 'manual',
  source_file text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint travel_tickets_number_not_blank check (btrim(ticket_number::text) <> ''),
  constraint travel_tickets_quantity_positive check (quantity is null or quantity > 0),
  constraint travel_tickets_unit_not_blank check (btrim(quantity_unit) <> ''),
  constraint travel_tickets_flow_status_check check (flow_status in ('draft', 'open', 'complete', 'divergent', 'cancelled')),
  constraint travel_tickets_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint travel_tickets_equipment_fk
    foreign key (equipment_id, organization_id)
    references public.equipment(id, organization_id),
  constraint travel_tickets_material_fk
    foreign key (material_id, organization_id)
    references public.materials(id, organization_id),
  constraint travel_tickets_origin_location_fk
    foreign key (origin_location_id, organization_id)
    references public.locations(id, organization_id),
  constraint travel_tickets_destination_location_fk
    foreign key (destination_location_id, organization_id)
    references public.locations(id, organization_id),
  constraint travel_tickets_branch_fk
    foreign key (work_branch_id, organization_id)
    references public.work_branches(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists travel_tickets_number_active_uidx
  on public.travel_tickets (organization_id, lower(ticket_number::text))
  where deleted_at is null;
create unique index if not exists travel_tickets_local_source_active_uidx
  on public.travel_tickets (organization_id, local_source_id)
  where local_source_id is not null and deleted_at is null;
create index if not exists travel_tickets_master_links_idx
  on public.travel_tickets (organization_id, equipment_id, material_id, destination_location_id, work_branch_id)
  where deleted_at is null;

create table if not exists public.travel_ticket_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ticket_id uuid not null,
  event_type text not null,
  occurred_at timestamptz not null,
  local_source_id text,
  import_row_id uuid,
  responsible_name text,
  source_type text not null default 'manual',
  source_sheet text,
  source_row integer,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint travel_ticket_events_type_check check (
    event_type in ('release', 'receipt', 'return', 'print', 'cancel')
  ),
  constraint travel_ticket_events_source_not_blank check (btrim(source_type) <> ''),
  constraint travel_ticket_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint travel_ticket_events_ticket_fk
    foreign key (ticket_id, organization_id)
    references public.travel_tickets(id, organization_id)
    on delete cascade,
  constraint travel_ticket_events_import_row_fk
    foreign key (import_row_id, organization_id)
    references public.import_rows(id, organization_id),
  unique (id, organization_id)
);

create unique index if not exists travel_ticket_events_local_source_active_uidx
  on public.travel_ticket_events (organization_id, local_source_id)
  where local_source_id is not null and deleted_at is null;
create index if not exists travel_ticket_events_timeline_idx
  on public.travel_ticket_events (organization_id, ticket_id, occurred_at, event_type)
  where deleted_at is null;

create table if not exists public.travel_print_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  local_source_id text,
  batch_code citext not null,
  print_mode text not null default 'blank',
  printed_at timestamptz not null,
  first_ticket_number citext,
  last_ticket_number citext,
  quantity integer not null,
  status text not null default 'printed',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint travel_print_batches_code_not_blank check (btrim(batch_code::text) <> ''),
  constraint travel_print_batches_mode_check check (print_mode in ('blank', 'prefilled')),
  constraint travel_print_batches_quantity_positive check (quantity > 0),
  constraint travel_print_batches_status_check check (status in ('printed', 'partially_used', 'used', 'cancelled')),
  constraint travel_print_batches_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique (id, organization_id)
);

create unique index if not exists travel_print_batches_code_active_uidx
  on public.travel_print_batches (organization_id, lower(batch_code::text))
  where deleted_at is null;

create table if not exists public.travel_print_batch_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  batch_id uuid not null,
  ticket_id uuid not null,
  sequence_number integer,
  created_at timestamptz not null default now(),
  constraint travel_print_batch_items_sequence_positive check (sequence_number is null or sequence_number > 0),
  constraint travel_print_batch_items_batch_fk
    foreign key (batch_id, organization_id)
    references public.travel_print_batches(id, organization_id)
    on delete cascade,
  constraint travel_print_batch_items_ticket_fk
    foreign key (ticket_id, organization_id)
    references public.travel_tickets(id, organization_id)
    on delete cascade,
  unique (batch_id, ticket_id),
  unique (id, organization_id)
);

create table if not exists public.travel_divergences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ticket_id uuid not null,
  field_name text not null,
  release_value text,
  receipt_value text,
  status text not null default 'pending',
  resolution_notes text,
  resolved_by uuid references public.app_users(id),
  resolved_at timestamptz,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint travel_divergences_field_check check (
    field_name in ('equipment', 'prefix', 'license_plate', 'material', 'quantity', 'destination', 'branch', 'other')
  ),
  constraint travel_divergences_status_check check (status in ('pending', 'resolved', 'accepted')),
  constraint travel_divergences_ticket_fk
    foreign key (ticket_id, organization_id)
    references public.travel_tickets(id, organization_id)
    on delete cascade,
  unique (id, organization_id)
);

create index if not exists travel_divergences_queue_idx
  on public.travel_divergences (organization_id, status, created_at)
  where deleted_at is null;

create table if not exists public.travel_review_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  batch_id uuid not null,
  import_row_id uuid not null,
  local_source_id text,
  ticket_number text,
  event_type text,
  effective_date date,
  effective_time time,
  prefix_informed text,
  license_plate_informed text,
  material_informed text,
  quantity_informed numeric(14,3),
  destination_informed text,
  stake_informed text,
  review_status text not null default 'pending',
  issue_count integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  raw_data jsonb not null,
  normalized_data jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by uuid references public.app_users(id),
  reviewed_at timestamptz,
  promoted_ticket_id uuid,
  promoted_event_id uuid,
  created_by uuid references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_review_items_event_type_check check (
    event_type is null or event_type in ('release', 'receipt', 'return', 'print', 'cancel')
  ),
  constraint travel_review_items_status_check check (
    review_status in ('pending', 'approved', 'rejected', 'needs_correction')
  ),
  constraint travel_review_items_issue_count_non_negative check (issue_count >= 0),
  constraint travel_review_items_issues_array check (jsonb_typeof(issues) = 'array'),
  constraint travel_review_items_raw_object check (jsonb_typeof(raw_data) = 'object'),
  constraint travel_review_items_normalized_object check (jsonb_typeof(normalized_data) = 'object'),
  constraint travel_review_items_batch_fk
    foreign key (batch_id, organization_id)
    references public.import_batches(id, organization_id)
    on delete cascade,
  constraint travel_review_items_import_row_fk
    foreign key (import_row_id, organization_id)
    references public.import_rows(id, organization_id)
    on delete cascade,
  constraint travel_review_items_ticket_fk
    foreign key (promoted_ticket_id, organization_id)
    references public.travel_tickets(id, organization_id),
  constraint travel_review_items_event_fk
    foreign key (promoted_event_id, organization_id)
    references public.travel_ticket_events(id, organization_id),
  unique (import_row_id),
  unique (id, organization_id)
);

create index if not exists travel_review_items_queue_idx
  on public.travel_review_items (organization_id, review_status, issue_count desc, created_at);
create index if not exists travel_review_items_ticket_idx
  on public.travel_review_items (organization_id, lower(ticket_number), event_type)
  where ticket_number is not null;

create or replace function public.travel_try_date(value text)
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

create or replace function public.travel_try_time(value text)
returns time
language plpgsql
immutable
as $$
begin
  if value is null or value !~ '^\d{1,2}:\d{2}' then
    return null;
  end if;
  return substring(value from 1 for 5)::time;
exception
  when others then return null;
end
$$;

create or replace function public.travel_try_numeric(value text)
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
  when others then return null;
end
$$;

create or replace function public.stage_travel_import(
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
  duplicate_rows_value integer;
begin
  batch_id_value := public.ingest_import_batch(
    p_organization_id,
    p_source_name,
    coalesce(nullif(btrim(p_source_type), ''), 'travel-system'),
    'travel_tickets',
    coalesce(nullif(btrim(p_worksheet_name), ''), 'LIBERAÇÃO + RECEBIMENTO'),
    p_rows,
    p_created_by,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'module', 'travel',
      'promotion', 'manual_only',
      'pairingKey', 'ticketNumero',
      'divergenceFields', jsonb_build_array('prefixo', 'placa', 'tipoMaterial', 'quantidadeM3')
    )
  );

  update public.import_rows row_item
  set
    normalized_data = row_item.raw_data || jsonb_build_object(
      'ticketNumeroNormalizado', upper(regexp_replace(coalesce(row_item.raw_data ->> 'ticketNumero', ''), '[^0-9A-Za-z._/-]', '', 'g')),
      'evento',
      case
        when lower(coalesce(row_item.raw_data ->> 'tipoTicket', '')) like 'receb%' then 'receipt'
        else 'release'
      end
    ),
    target_table = 'travel_tickets',
    status = case
      when nullif(btrim(row_item.raw_data ->> 'ticketNumero'), '') is null then 'invalid'::public.import_row_status
      when public.travel_try_date(row_item.raw_data ->> 'data') is null then 'invalid'::public.import_row_status
      when exists (
        select 1
        from public.import_rows duplicate_item
        where duplicate_item.organization_id = row_item.organization_id
          and duplicate_item.batch_id = row_item.batch_id
          and duplicate_item.id <> row_item.id
          and upper(regexp_replace(coalesce(duplicate_item.raw_data ->> 'ticketNumero', ''), '[^0-9A-Za-z._/-]', '', 'g'))
            = upper(regexp_replace(coalesce(row_item.raw_data ->> 'ticketNumero', ''), '[^0-9A-Za-z._/-]', '', 'g'))
          and lower(coalesce(duplicate_item.raw_data ->> 'tipoTicket', 'Liberação'))
            = lower(coalesce(row_item.raw_data ->> 'tipoTicket', 'Liberação'))
      ) then 'duplicate'::public.import_row_status
      when coalesce(row_item.raw_data ->> 'status', '') in ('Erro de importação', 'Pendente')
        then 'warning'::public.import_row_status
      else 'valid'::public.import_row_status
    end,
    updated_at = now()
  where row_item.organization_id = p_organization_id
    and row_item.batch_id = batch_id_value;

  insert into public.travel_review_items (
    organization_id,
    batch_id,
    import_row_id,
    local_source_id,
    ticket_number,
    event_type,
    effective_date,
    effective_time,
    prefix_informed,
    license_plate_informed,
    material_informed,
    quantity_informed,
    destination_informed,
    stake_informed,
    review_status,
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
    nullif(btrim(row_item.raw_data ->> 'ticketNumero'), ''),
    case
      when lower(coalesce(row_item.raw_data ->> 'tipoTicket', '')) like 'receb%' then 'receipt'
      else 'release'
    end,
    public.travel_try_date(row_item.raw_data ->> 'data'),
    public.travel_try_time(
      case
        when lower(coalesce(row_item.raw_data ->> 'tipoTicket', '')) like 'receb%'
          then coalesce(row_item.raw_data ->> 'horaChegada', row_item.raw_data ->> 'horaSaida')
        else row_item.raw_data ->> 'horaSaida'
      end
    ),
    nullif(btrim(row_item.raw_data ->> 'prefixo'), ''),
    nullif(btrim(row_item.raw_data ->> 'placa'), ''),
    nullif(btrim(row_item.raw_data ->> 'tipoMaterial'), ''),
    public.travel_try_numeric(row_item.raw_data ->> 'quantidadeM3'),
    nullif(btrim(coalesce(row_item.raw_data ->> 'destinoOutro', row_item.raw_data ->> 'destinoObra')), ''),
    nullif(btrim(row_item.raw_data ->> 'estaca'), ''),
    'pending',
    (case when row_item.status = 'valid' then 0 else 1 end),
    case
      when row_item.status = 'invalid' then jsonb_build_array('Campos obrigatórios ausentes ou inválidos')
      when row_item.status = 'duplicate' then jsonb_build_array('Possível duplicidade preservada para revisão')
      when row_item.status = 'warning' then jsonb_build_array('Registro preservado com pendências de origem')
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

  select
    count(*),
    count(*) filter (where review_status = 'pending')
  into review_rows_value, pending_rows_value
  from public.travel_review_items
  where organization_id = p_organization_id and batch_id = batch_id_value;

  select count(*) into duplicate_rows_value
  from public.import_rows
  where organization_id = p_organization_id
    and batch_id = batch_id_value
    and status = 'duplicate';

  update public.import_batches
  set
    status = case
      when exists (
        select 1
        from public.import_rows
        where organization_id = p_organization_id
          and batch_id = batch_id_value
          and status in ('warning', 'invalid', 'duplicate', 'unmapped')
      ) then 'completed_with_warnings'::public.import_status
      else 'completed'::public.import_status
    end,
    valid_rows = (
      select count(*) from public.import_rows
      where organization_id = p_organization_id and batch_id = batch_id_value and status = 'valid'
    ),
    warning_rows = (
      select count(*) from public.import_rows
      where organization_id = p_organization_id and batch_id = batch_id_value and status = 'warning'
    ),
    invalid_rows = (
      select count(*) from public.import_rows
      where organization_id = p_organization_id and batch_id = batch_id_value and status = 'invalid'
    ),
    duplicate_rows = duplicate_rows_value,
    completed_at = now(),
    updated_at = now()
  where organization_id = p_organization_id and id = batch_id_value;

  return jsonb_build_object(
    'batchId', batch_id_value,
    'preservedRows', preserved_rows_value,
    'reviewRows', review_rows_value,
    'pendingRows', pending_rows_value,
    'duplicateRows', duplicate_rows_value
  );
end
$$;

create or replace view public.travel_operation_overview
with (security_invoker = true)
as
select
  ticket.organization_id,
  ticket.id as ticket_id,
  ticket.ticket_number,
  ticket.equipment_id,
  ticket.material_id,
  ticket.origin_location_id,
  ticket.destination_location_id,
  ticket.work_branch_id,
  min(event.occurred_at) filter (where event.event_type = 'release') as released_at,
  min(event.occurred_at) filter (where event.event_type = 'receipt') as received_at,
  max(event.occurred_at) filter (where event.event_type = 'return') as returned_at,
  extract(epoch from (
    min(event.occurred_at) filter (where event.event_type = 'receipt')
    - min(event.occurred_at) filter (where event.event_type = 'release')
  )) / 60 as duration_minutes,
  count(distinct divergence.id) filter (where divergence.status = 'pending') as pending_divergences,
  ticket.flow_status
from public.travel_tickets ticket
left join public.travel_ticket_events event
  on event.organization_id = ticket.organization_id
 and event.ticket_id = ticket.id
 and event.deleted_at is null
left join public.travel_divergences divergence
  on divergence.organization_id = ticket.organization_id
 and divergence.ticket_id = ticket.id
 and divergence.deleted_at is null
where ticket.deleted_at is null
group by ticket.id, ticket.organization_id;

drop trigger if exists travel_tickets_set_updated_at on public.travel_tickets;
create trigger travel_tickets_set_updated_at
before update on public.travel_tickets
for each row execute function public.set_updated_at();
drop trigger if exists travel_ticket_events_set_updated_at on public.travel_ticket_events;
create trigger travel_ticket_events_set_updated_at
before update on public.travel_ticket_events
for each row execute function public.set_updated_at();
drop trigger if exists travel_print_batches_set_updated_at on public.travel_print_batches;
create trigger travel_print_batches_set_updated_at
before update on public.travel_print_batches
for each row execute function public.set_updated_at();
drop trigger if exists travel_divergences_set_updated_at on public.travel_divergences;
create trigger travel_divergences_set_updated_at
before update on public.travel_divergences
for each row execute function public.set_updated_at();
drop trigger if exists travel_review_items_set_updated_at on public.travel_review_items;
create trigger travel_review_items_set_updated_at
before update on public.travel_review_items
for each row execute function public.set_updated_at();

drop trigger if exists travel_tickets_audit on public.travel_tickets;
create trigger travel_tickets_audit
after insert or update or delete on public.travel_tickets
for each row execute function public.audit_row_change();
drop trigger if exists travel_ticket_events_audit on public.travel_ticket_events;
create trigger travel_ticket_events_audit
after insert or update or delete on public.travel_ticket_events
for each row execute function public.audit_row_change();
drop trigger if exists travel_print_batches_audit on public.travel_print_batches;
create trigger travel_print_batches_audit
after insert or update or delete on public.travel_print_batches
for each row execute function public.audit_row_change();
drop trigger if exists travel_divergences_audit on public.travel_divergences;
create trigger travel_divergences_audit
after insert or update or delete on public.travel_divergences
for each row execute function public.audit_row_change();
drop trigger if exists travel_review_items_audit on public.travel_review_items;
create trigger travel_review_items_audit
after insert or update or delete on public.travel_review_items
for each row execute function public.audit_row_change();

alter table public.travel_tickets enable row level security;
alter table public.travel_ticket_events enable row level security;
alter table public.travel_print_batches enable row level security;
alter table public.travel_print_batch_items enable row level security;
alter table public.travel_divergences enable row level security;
alter table public.travel_review_items enable row level security;

drop policy if exists travel_tickets_select_own on public.travel_tickets;
create policy travel_tickets_select_own on public.travel_tickets
  for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists travel_tickets_write_own on public.travel_tickets;
create policy travel_tickets_write_own on public.travel_tickets
  for all to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador') and deleted_at is null)
  with check (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'));

drop policy if exists travel_ticket_events_select_own on public.travel_ticket_events;
create policy travel_ticket_events_select_own on public.travel_ticket_events
  for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists travel_ticket_events_write_own on public.travel_ticket_events;
create policy travel_ticket_events_write_own on public.travel_ticket_events
  for all to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador') and deleted_at is null)
  with check (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'));

drop policy if exists travel_print_batches_select_own on public.travel_print_batches;
create policy travel_print_batches_select_own on public.travel_print_batches
  for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists travel_print_batches_write_own on public.travel_print_batches;
create policy travel_print_batches_write_own on public.travel_print_batches
  for all to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador') and deleted_at is null)
  with check (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'));

drop policy if exists travel_print_batch_items_select_own on public.travel_print_batch_items;
create policy travel_print_batch_items_select_own on public.travel_print_batch_items
  for select to authenticated
  using (organization_id = public.current_organization_id());
drop policy if exists travel_print_batch_items_write_own on public.travel_print_batch_items;
create policy travel_print_batch_items_write_own on public.travel_print_batch_items
  for all to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'))
  with check (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'));

drop policy if exists travel_divergences_select_own on public.travel_divergences;
create policy travel_divergences_select_own on public.travel_divergences
  for select to authenticated
  using (organization_id = public.current_organization_id() and deleted_at is null);
drop policy if exists travel_divergences_write_own on public.travel_divergences;
create policy travel_divergences_write_own on public.travel_divergences
  for all to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador') and deleted_at is null)
  with check (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'));

drop policy if exists travel_review_items_select_own on public.travel_review_items;
create policy travel_review_items_select_own on public.travel_review_items
  for select to authenticated
  using (organization_id = public.current_organization_id());
drop policy if exists travel_review_items_write_own on public.travel_review_items;
create policy travel_review_items_write_own on public.travel_review_items
  for all to authenticated
  using (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'))
  with check (organization_id = public.current_organization_id() and public.current_app_role() in ('admin', 'gestor', 'operador'));

revoke all on function public.stage_travel_import(uuid, text, text, text, jsonb, uuid, jsonb) from public;
grant execute on function public.stage_travel_import(uuid, text, text, text, jsonb, uuid, jsonb) to service_role;

grant select, insert, update, delete on
  public.travel_tickets,
  public.travel_ticket_events,
  public.travel_print_batches,
  public.travel_print_batch_items,
  public.travel_divergences,
  public.travel_review_items
to authenticated, service_role;

grant select on public.travel_operation_overview to authenticated, service_role;

comment on table public.travel_tickets
  is 'Entidade canônica do ticket de viagem, vinculada a equipamento, material, local e ramo por ID.';
comment on table public.travel_ticket_events
  is 'Linha do tempo de liberação, recebimento, devolução, impressão e cancelamento.';
comment on table public.travel_review_items
  is 'Fila sem descarte para revisão manual dos históricos de viagens importados.';
comment on view public.travel_operation_overview
  is 'Pareamento de eventos, duração e divergências por ticket de viagem.';

commit;

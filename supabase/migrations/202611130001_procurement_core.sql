-- Núcleo transacional de Solicitações e Compras.
-- A API usa service_role; clientes nunca recebem permissão direta nestas tabelas.

create table if not exists public.erp_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'renea',
  request_number text not null,
  requester_user_id uuid not null,
  requester_name text not null,
  requester_role text not null check (requester_role = 'ROLE_SOLICITANTE'),
  work_front text not null,
  stake_application text not null,
  item_type text not null check (item_type in ('Material', 'Serviço')),
  technical_description text not null,
  quantity_requested numeric(18,3) not null check (quantity_requested > 0),
  unit text not null,
  desired_deadline date not null,
  allow_partial boolean not null,
  engineering_drawing_ref text,
  status text not null default 'SOLICITACAO_ABERTA',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_number)
);

create table if not exists public.erp_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.erp_requests(id) on delete restrict,
  item_number integer not null check (item_number > 0),
  item_type text not null check (item_type in ('Material', 'Serviço')),
  technical_description text not null,
  quantity_requested numeric(18,3) not null check (quantity_requested > 0),
  unit text not null,
  desired_deadline date not null,
  allow_partial boolean not null,
  quantity_first_delivery numeric(18,3) check (quantity_first_delivery is null or quantity_first_delivery > 0),
  engineering_drawing_ref text,
  unique (request_id, item_number),
  check (quantity_first_delivery is null or quantity_first_delivery <= quantity_requested)
);

create table if not exists public.erp_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'renea',
  request_id uuid not null references public.erp_requests(id),
  buyer_user_id uuid not null,
  buyer_name text not null,
  po_number text not null,
  supplier text not null,
  unit_price_brl numeric(18,2) not null check (unit_price_brl >= 0),
  total_value_brl numeric(18,2) not null check (total_value_brl > 0),
  quantity_allocated numeric(18,3) not null check (quantity_allocated > 0),
  quantity_remaining numeric(18,3) not null check (quantity_remaining >= 0),
  delivery_start date not null,
  delivery_end date not null,
  status text not null default 'PEDIDO_MONTADO',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, po_number),
  check (delivery_end >= delivery_start),
  check (quantity_remaining <= quantity_allocated)
);

create table if not exists public.erp_logistics_tracking (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'renea',
  purchase_order_id uuid not null references public.erp_purchase_orders(id),
  destination_type text not null check (destination_type in ('LOCAL', 'DESCARTE')),
  promised_start date not null,
  promised_end date not null,
  received_at timestamptz,
  received_quantity numeric(18,3) check (received_quantity >= 0),
  invoice_number text,
  scale_ticket text,
  status text not null default 'APROVADO_EM_TRANSITO',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (promised_end >= promised_start)
);

create table if not exists public.erp_audit_trail (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'renea',
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid not null,
  actor_name text not null,
  actor_role text not null,
  before_state jsonb,
  after_state jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists erp_requests_org_status_idx on public.erp_requests (organization_id, status, updated_at desc);
create index if not exists erp_requests_requester_idx on public.erp_requests (organization_id, requester_user_id, created_at desc);
create index if not exists erp_purchase_orders_request_idx on public.erp_purchase_orders (organization_id, request_id);
create index if not exists erp_request_items_request_idx on public.erp_request_items (request_id, item_number);
create index if not exists erp_logistics_due_idx on public.erp_logistics_tracking (organization_id, promised_end, status);
create index if not exists erp_audit_entity_idx on public.erp_audit_trail (organization_id, entity_type, entity_id, created_at desc);

create or replace function public.create_erp_request(p_request jsonb, p_audit jsonb)
returns public.erp_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.erp_requests;
begin
  insert into public.erp_requests (
    organization_id, request_number, requester_user_id, requester_name,
    requester_role, work_front, stake_application, item_type,
    technical_description, quantity_requested, unit, desired_deadline,
    allow_partial, engineering_drawing_ref
  ) values (
    p_request->>'organization_id', p_request->>'request_number',
    (p_request->>'requester_user_id')::uuid, p_request->>'requester_name',
    p_request->>'requester_role', p_request->>'work_front',
    p_request->>'stake_application', p_request->>'item_type',
    p_request->>'technical_description', (p_request->>'quantity_requested')::numeric,
    p_request->>'unit', (p_request->>'desired_deadline')::date,
    (p_request->>'allow_partial')::boolean, nullif(p_request->>'engineering_drawing_ref', '')
  ) returning * into inserted;

  insert into public.erp_audit_trail (
    organization_id, entity_type, entity_id, action, actor_user_id,
    actor_name, actor_role, after_state, metadata
  ) values (
    p_audit->>'organization_id', 'request', inserted.id, 'REQUEST_CREATED',
    (p_audit->>'actor_user_id')::uuid, p_audit->>'actor_name',
    p_audit->>'actor_role', to_jsonb(inserted), coalesce(p_audit->'metadata', '{}'::jsonb)
  );
  insert into public.erp_request_items (
    request_id, item_number, item_type, technical_description, quantity_requested,
    unit, desired_deadline, allow_partial, quantity_first_delivery, engineering_drawing_ref
  )
  select inserted.id, item_number, item_type, technical_description, quantity_requested,
    unit, desired_deadline, allow_partial, quantity_first_delivery, nullif(engineering_drawing_ref, '')
  from jsonb_to_recordset(coalesce(p_request->'items', '[]'::jsonb)) as items(
    item_number integer, item_type text, technical_description text,
    quantity_requested numeric, unit text, desired_deadline date,
    allow_partial boolean, quantity_first_delivery numeric, engineering_drawing_ref text
  );
  return inserted;
end;
$$;

revoke all on function public.create_erp_request(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_erp_request(jsonb, jsonb) to service_role;

create or replace function public.transition_erp_request(
  p_request_id uuid,
  p_expected_version integer,
  p_action text,
  p_actor jsonb,
  p_payload jsonb default '{}'::jsonb
)
returns public.erp_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.erp_requests;
  before_row public.erp_requests;
  next_status text;
begin
  select * into current_row from public.erp_requests where id = p_request_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'P0002'; end if;
  before_row := current_row;
  if current_row.version <> p_expected_version then raise exception 'Conflito de versão. Recarregue a solicitação.' using errcode = 'P0001'; end if;

  if p_action = 'approve' then
    if lower(p_actor->>'actor_name') <> 'bruno' or p_actor->>'actor_role' <> 'aprovador' then raise exception 'Aprovação exclusiva de Bruno.' using errcode = 'P0003'; end if;
    if current_row.status <> 'AGUARDANDO_APROVACAO_BRUNO' then raise exception 'Estado inválido para aprovação.' using errcode = 'P0004'; end if;
    next_status := 'APROVADO_EM_TRANSITO';
  elsif p_action = 'dispatch' then
    if p_actor->>'actor_role' <> 'suprimentos' then raise exception 'Somente Suprimentos despacha.' using errcode = 'P0003'; end if;
    if current_row.status <> 'APROVADO_EM_TRANSITO' then raise exception 'Estado inválido para despacho.' using errcode = 'P0004'; end if;
    next_status := 'APROVADO_EM_TRANSITO';
  elsif p_action = 'receive' then
    if p_actor->>'actor_role' <> 'recebedor' then raise exception 'Somente Recepção/Campo recebe.' using errcode = 'P0003'; end if;
    if current_row.status <> 'APROVADO_EM_TRANSITO' then raise exception 'Estado inválido para recebimento.' using errcode = 'P0004'; end if;
    if coalesce(p_payload->>'invoice_number', '') = '' or coalesce(p_payload->>'destination_type', '') = '' then raise exception 'NF e destino são obrigatórios.' using errcode = 'P0005'; end if;
    next_status := case when (p_payload->>'quantity_received')::numeric >= current_row.quantity_requested then 'CONCLUIDO_CONCILIADO_NF' else 'APROVADO_EM_TRANSITO' end;
  else
    raise exception 'Ação de compras inválida.' using errcode = 'P0006';
  end if;

  update public.erp_requests set status = next_status, version = version + 1, updated_at = now() where id = current_row.id returning * into current_row;
  insert into public.erp_audit_trail (organization_id, entity_type, entity_id, action, actor_user_id, actor_name, actor_role, before_state, after_state, metadata)
  values (current_row.organization_id, 'request', current_row.id, upper(p_action), (p_actor->>'actor_user_id')::uuid, p_actor->>'actor_name', p_actor->>'actor_role', to_jsonb(before_row), to_jsonb(current_row), coalesce(p_payload, '{}'::jsonb));
  return current_row;
end;
$$;

revoke all on function public.transition_erp_request(uuid, integer, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.transition_erp_request(uuid, integer, text, jsonb, jsonb) to service_role;

create or replace function public.block_erp_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Auditoria de compras é imutável e append-only';
end;
$$;

drop trigger if exists erp_audit_no_update on public.erp_audit_trail;
create trigger erp_audit_no_update before update or delete on public.erp_audit_trail
for each row execute function public.block_erp_audit_mutation();

alter table public.erp_requests enable row level security;
alter table public.erp_purchase_orders enable row level security;
alter table public.erp_logistics_tracking enable row level security;
alter table public.erp_audit_trail enable row level security;
revoke all on public.erp_requests, public.erp_purchase_orders, public.erp_logistics_tracking, public.erp_audit_trail from anon, authenticated;

notify pgrst, 'reload schema';

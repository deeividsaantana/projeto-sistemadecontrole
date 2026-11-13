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
create index if not exists erp_logistics_due_idx on public.erp_logistics_tracking (organization_id, promised_end, status);
create index if not exists erp_audit_entity_idx on public.erp_audit_trail (organization_id, entity_type, entity_id, created_at desc);

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

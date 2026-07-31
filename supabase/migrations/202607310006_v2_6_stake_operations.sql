create table if not exists public.stake_lots (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  occurred_on date not null,
  invoice_number text not null,
  material_code text,
  description text not null,
  profile_model text,
  length_m numeric(12,3) not null default 0,
  physical_quantity numeric(12,3) not null default 1,
  weight_kg numeric(14,3) not null default 0,
  unit_value numeric(14,2) not null default 0,
  total_value numeric(14,2) not null default 0,
  truck_plate text,
  trailer_plate text,
  destination text,
  status text not null default 'Pendente',
  invoice_checked boolean not null default false,
  invoice_divergence text,
  source text not null default 'Manual',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stake_drivings (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  lot_id uuid references public.stake_lots(id) on delete set null,
  occurred_on date not null,
  item_reference text,
  service text not null,
  identification text not null,
  profile text,
  length_m numeric(12,3) not null default 0,
  driven_length_m numeric(12,3) not null default 0,
  remainder_m numeric(12,3) not null default 0,
  loss_m numeric(12,3) not null default 0,
  source text not null default 'Manual',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stake_lots_invoice_idx on public.stake_lots(invoice_number);
create index if not exists stake_drivings_lot_idx on public.stake_drivings(lot_id);
create index if not exists stake_drivings_date_idx on public.stake_drivings(occurred_on);

alter table public.stake_lots enable row level security;
alter table public.stake_drivings enable row level security;

do $$
begin
  create policy stake_lots_authenticated on public.stake_lots for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy stake_drivings_authenticated on public.stake_drivings for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

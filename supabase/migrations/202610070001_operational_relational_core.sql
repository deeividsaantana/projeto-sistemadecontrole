-- Nucleo relacional da migracao Supabase RENEA.
-- Aditivo: preserva erp_snapshots/Firebase e cria tabelas normalizadas com
-- legacy_id para reconciliar sem renomear chaves operacionais.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  nome text not null,
  cnpj text not null default '',
  telefone text not null default '',
  responsavel text not null default '',
  tipos text[] not null default array['EMPRESA'],
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  nome text not null,
  endereco text not null default '',
  responsavel text not null default '',
  status text not null check (status in ('Ativa', 'Concluída', 'Planejada')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.equipamentos_operacionais (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  prefixo text not null,
  nome text not null,
  tipo text not null default '',
  empresa_legacy_id text not null default '',
  obra_legacy_id text not null default '',
  status text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.funcionarios_operacionais (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  matricula text not null default '',
  nome text not null,
  cargo text not null default '',
  empresa_legacy_id text not null default '',
  status text not null default 'ATIVO',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.materiais_operacionais (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  codigo text not null default '',
  descricao text not null,
  categoria text not null default '',
  unidade text not null,
  fornecedor_legacy_id text not null default '',
  ativo boolean not null default true,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.movimentos_materiais_operacionais (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  data date not null,
  tipo text not null check (tipo in ('Entrada', 'Saída', 'Transferência', 'Ajuste')),
  material_legacy_id text not null,
  obra_legacy_id text not null default '',
  fornecedor_legacy_id text not null default '',
  quantidade numeric not null,
  unidade text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.abastecimentos_operacionais (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  data date not null,
  hora text not null default '',
  equipamento_legacy_id text not null,
  quantidade_litros numeric not null check (quantidade_litros >= 0),
  tipo_combustivel_legacy_id text not null default '',
  comboio_legacy_id text not null default '',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.public_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  status_fluxo text not null default 'Rascunho',
  allow_overwrite_sent boolean not null default false,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create table if not exists public.public_ticket_counters (
  organization_id text primary key references public.organizations(id) on delete cascade,
  next_number integer not null default 1 check (next_number >= 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  legacy_id text not null,
  kind text not null check (kind in ('presence', 'presence-reset', 'equipe')),
  status text not null default 'pending' check (status in ('pending', 'processed', 'cancelled')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legacy_id)
);

create index if not exists empresas_organization_idx on public.empresas(organization_id);
create index if not exists obras_organization_idx on public.obras(organization_id);
create index if not exists equipamentos_operacionais_organization_idx on public.equipamentos_operacionais(organization_id);
create index if not exists funcionarios_operacionais_organization_idx on public.funcionarios_operacionais(organization_id);
create index if not exists materiais_operacionais_organization_idx on public.materiais_operacionais(organization_id);
create index if not exists movimentos_materiais_operacionais_organization_idx on public.movimentos_materiais_operacionais(organization_id);
create index if not exists abastecimentos_operacionais_organization_idx on public.abastecimentos_operacionais(organization_id);
create index if not exists public_tickets_organization_idx on public.public_tickets(organization_id);
create index if not exists public_submissions_organization_status_idx on public.public_submissions(organization_id, status);

alter table public.empresas enable row level security;
alter table public.obras enable row level security;
alter table public.equipamentos_operacionais enable row level security;
alter table public.funcionarios_operacionais enable row level security;
alter table public.materiais_operacionais enable row level security;
alter table public.movimentos_materiais_operacionais enable row level security;
alter table public.abastecimentos_operacionais enable row level security;
alter table public.public_tickets enable row level security;
alter table public.public_ticket_counters enable row level security;
alter table public.public_submissions enable row level security;

create policy "members can read empresas"
  on public.empresas for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert empresas"
  on public.empresas for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update empresas"
  on public.empresas for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete empresas"
  on public.empresas for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read obras"
  on public.obras for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert obras"
  on public.obras for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update obras"
  on public.obras for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete obras"
  on public.obras for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read equipamentos operacionais"
  on public.equipamentos_operacionais for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert equipamentos operacionais"
  on public.equipamentos_operacionais for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update equipamentos operacionais"
  on public.equipamentos_operacionais for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete equipamentos operacionais"
  on public.equipamentos_operacionais for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read funcionarios operacionais"
  on public.funcionarios_operacionais for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert funcionarios operacionais"
  on public.funcionarios_operacionais for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update funcionarios operacionais"
  on public.funcionarios_operacionais for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete funcionarios operacionais"
  on public.funcionarios_operacionais for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read materiais operacionais"
  on public.materiais_operacionais for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert materiais operacionais"
  on public.materiais_operacionais for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update materiais operacionais"
  on public.materiais_operacionais for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete materiais operacionais"
  on public.materiais_operacionais for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read movimentos materiais operacionais"
  on public.movimentos_materiais_operacionais for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert movimentos materiais operacionais"
  on public.movimentos_materiais_operacionais for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update movimentos materiais operacionais"
  on public.movimentos_materiais_operacionais for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete movimentos materiais operacionais"
  on public.movimentos_materiais_operacionais for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read abastecimentos operacionais"
  on public.abastecimentos_operacionais for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert abastecimentos operacionais"
  on public.abastecimentos_operacionais for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update abastecimentos operacionais"
  on public.abastecimentos_operacionais for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete abastecimentos operacionais"
  on public.abastecimentos_operacionais for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read public tickets"
  on public.public_tickets for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can insert public tickets"
  on public.public_tickets for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors can update public tickets"
  on public.public_tickets for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "admins can delete public tickets"
  on public.public_tickets for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read public submissions"
  on public.public_submissions for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors can update public submissions"
  on public.public_submissions for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "members can read ticket counters"
  on public.public_ticket_counters for select to authenticated
  using (public.is_organization_member(organization_id));

create or replace function public.reserve_public_ticket_numbers(
  p_organization_id text,
  p_known_next_number integer,
  p_requested_count integer
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_next integer;
  v_numbers text[];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.has_organization_role(p_organization_id, array['admin', 'editor']) then
    raise exception 'ORGANIZATION_WRITE_DENIED';
  end if;

  v_count := greatest(1, least(200, coalesce(p_requested_count, 1)));
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id || ':ticket_counter', 0));

  insert into public.public_ticket_counters (organization_id, next_number)
  values (p_organization_id, greatest(1, coalesce(p_known_next_number, 1)))
  on conflict (organization_id) do nothing;

  select greatest(counter.next_number, coalesce(p_known_next_number, 1), 1)
    into v_next
    from public.public_ticket_counters counter
    where counter.organization_id = p_organization_id
    for update;

  update public.public_ticket_counters
    set next_number = v_next + v_count,
        updated_at = clock_timestamp()
    where organization_id = p_organization_id;

  select array_agg((v_next + offset_value)::text order by offset_value)
    into v_numbers
    from generate_series(0, v_count - 1) offset_value;

  return v_numbers;
end;
$$;

revoke all on function public.reserve_public_ticket_numbers(text, integer, integer) from public;
grant execute on function public.reserve_public_ticket_numbers(text, integer, integer) to authenticated;

-- Fase 3 (piloto), continuação: cadastros mestres de pessoas e frota.
-- Espelha Funcionario e Equipamento do Firestore (src/types.ts). Mantém o
-- mesmo padrão de organization_id + RLS das migrations anteriores.

create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  matricula text,
  nome text not null,
  cargo text not null,
  telefone text not null,
  empresa_id uuid references public.parceiros(id) on delete set null,
  ativo boolean not null default true,
  lider_matricula text,
  lider_nome text,
  area text,
  responsavel_area text,
  divisao text,
  secao text,
  status text not null default 'ATIVO' check (status in (
    'ATIVO', 'INATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO'
  )),
  data_mobilizacao date,
  data_desmobilizacao date,
  situacao_rh text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  prefixo text not null,
  nome text not null,
  tipo text not null,
  marca text not null,
  modelo text not null,
  serie_placa text not null,
  placa text,
  ano integer,
  empresa_id uuid references public.parceiros(id) on delete set null,
  status text not null default 'Ativo' check (status in (
    'Ativo', 'Parado', 'Manutenção', 'Mobilizado', 'Desmobilizado', 'Esperando motorista'
  )),
  local_atual_id uuid references public.projects(id) on delete set null,
  observacao text,
  horas_disponiveis numeric,
  horas_indisponiveis numeric,
  categoria_frota text check (categoria_frota in ('Equipamento', 'Veículo', 'Implemento')),
  codigo_sge text,
  familia text,
  mobilizado boolean,
  meta_disponibilidade numeric,
  data_mobilizacao date,
  data_desmobilizacao date,
  operador_responsavel_id uuid references public.colaboradores(id) on delete set null,
  operador_responsavel_nome text,
  capacidade_tanque_litros numeric,
  equipamento_vinculado_id uuid references public.equipamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists colaboradores_organization_idx
  on public.colaboradores(organization_id);
create index if not exists colaboradores_empresa_idx
  on public.colaboradores(empresa_id);
create index if not exists equipamentos_organization_idx
  on public.equipamentos(organization_id);
create index if not exists equipamentos_empresa_idx
  on public.equipamentos(empresa_id);
create index if not exists equipamentos_local_atual_idx
  on public.equipamentos(local_atual_id);
create index if not exists equipamentos_operador_idx
  on public.equipamentos(operador_responsavel_id);

alter table public.colaboradores enable row level security;
alter table public.equipamentos enable row level security;

create policy "members can read organization colaboradores"
  on public.colaboradores for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization colaboradores"
  on public.colaboradores for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization colaboradores"
  on public.colaboradores for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization colaboradores"
  on public.colaboradores for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read organization equipamentos"
  on public.equipamentos for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization equipamentos"
  on public.equipamentos for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization equipamentos"
  on public.equipamentos for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization equipamentos"
  on public.equipamentos for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

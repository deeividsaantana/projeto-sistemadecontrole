-- Piloto multi-tenant de colaboradores.
-- empresa_id permanece opcional até a reconciliação dos IDs legados com parceiros.

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  matricula text,
  nome text not null,
  cargo text not null default '',
  telefone text not null default '',
  empresa_id uuid references public.parceiros(id) on delete set null,
  ativo boolean not null default true,
  lider_matricula text,
  lider_nome text,
  area text,
  responsavel_area text,
  divisao text,
  secao text,
  status text check (status in ('ATIVO', 'INATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO')),
  data_mobilizacao date,
  data_desmobilizacao date,
  situacao_rh text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funcionarios_organization_idx
  on public.funcionarios(organization_id);
create index if not exists funcionarios_empresa_idx
  on public.funcionarios(empresa_id);

alter table public.funcionarios enable row level security;

drop policy if exists "members can read organization funcionarios" on public.funcionarios;
create policy "members can read organization funcionarios"
  on public.funcionarios for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "editors can write organization funcionarios" on public.funcionarios;
create policy "editors can write organization funcionarios"
  on public.funcionarios for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

drop policy if exists "editors can update organization funcionarios" on public.funcionarios;
create policy "editors can update organization funcionarios"
  on public.funcionarios for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

drop policy if exists "admins can delete organization funcionarios" on public.funcionarios;
create policy "admins can delete organization funcionarios"
  on public.funcionarios for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

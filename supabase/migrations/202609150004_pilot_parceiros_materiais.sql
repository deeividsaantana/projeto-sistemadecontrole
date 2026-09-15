-- Fase 5 (piloto): cadastros base — parceiros (empresas/fornecedores/
-- geradores/aceitantes/transportadoras) e materiais. Espelha o tipo Empresa
-- já existente no Firestore (fornecedor = Empresa com 'FORNECEDOR' em tipos,
-- não é uma entidade separada) e o tipo Material.
--
-- Diferença deliberada do Firestore: lá esses cadastros não têm campo de
-- organização (o deployment atual serve uma única empresa). Aqui já nascem
-- com organization_id, porque essa é a fundação multiempresa real que a
-- Fase 4 do roadmap pede — não dá pra herdar a limitação atual pro Postgres.

create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  responsavel text,
  tipos text[] not null default '{}'
    check (tipos <@ array['EMPRESA', 'FORNECEDOR', 'GERADOR', 'ACEITANTE', 'TRANSPORTADORA']),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  codigo text,
  descricao text not null,
  categoria text,
  unidade text not null,
  fornecedor_padrao_id uuid references public.parceiros(id) on delete set null,
  estoque_minimo numeric,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parceiros_organization_idx
  on public.parceiros(organization_id);
create index if not exists materiais_organization_idx
  on public.materiais(organization_id);
create index if not exists materiais_fornecedor_padrao_idx
  on public.materiais(fornecedor_padrao_id);

alter table public.parceiros enable row level security;
alter table public.materiais enable row level security;

create policy "members can read organization parceiros"
  on public.parceiros for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization parceiros"
  on public.parceiros for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization parceiros"
  on public.parceiros for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization parceiros"
  on public.parceiros for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read organization materiais"
  on public.materiais for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization materiais"
  on public.materiais for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization materiais"
  on public.materiais for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization materiais"
  on public.materiais for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

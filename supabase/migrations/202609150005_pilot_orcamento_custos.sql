-- Fase 6 (piloto): orçamento base e lançamentos de custo. Espelha
-- OrcamentoItem e LancamentoCusto do Firestore. Dinheiro em numeric
-- (nunca float), nunca negativo — regra 16 do prompt mestre.

create table if not exists public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  categoria text not null check (categoria in (
    'Combustível', 'Manutenção', 'Material', 'Locação',
    'Serviço de terceiro', 'Mão de obra', 'Outro'
  )),
  valor_orcado numeric not null check (valor_orcado >= 0),
  responsavel text not null,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lancamentos_custo (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  fornecedor_id uuid references public.parceiros(id) on delete set null,
  data date not null,
  categoria text not null check (categoria in (
    'Combustível', 'Manutenção', 'Material', 'Locação',
    'Serviço de terceiro', 'Mão de obra', 'Outro'
  )),
  descricao text not null,
  valor numeric not null check (valor >= 0),
  frente text,
  documento text,
  responsavel text not null,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orcamento_itens_organization_idx
  on public.orcamento_itens(organization_id);
create index if not exists orcamento_itens_project_idx
  on public.orcamento_itens(project_id);
create index if not exists lancamentos_custo_organization_idx
  on public.lancamentos_custo(organization_id);
create index if not exists lancamentos_custo_project_idx
  on public.lancamentos_custo(project_id);
create index if not exists lancamentos_custo_fornecedor_idx
  on public.lancamentos_custo(fornecedor_id);

alter table public.orcamento_itens enable row level security;
alter table public.lancamentos_custo enable row level security;

create policy "members can read organization orcamento"
  on public.orcamento_itens for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization orcamento"
  on public.orcamento_itens for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization orcamento"
  on public.orcamento_itens for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization orcamento"
  on public.orcamento_itens for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read organization lancamentos_custo"
  on public.lancamentos_custo for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization lancamentos_custo"
  on public.lancamentos_custo for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization lancamentos_custo"
  on public.lancamentos_custo for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization lancamentos_custo"
  on public.lancamentos_custo for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

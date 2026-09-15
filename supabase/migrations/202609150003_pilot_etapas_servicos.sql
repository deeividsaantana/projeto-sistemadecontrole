-- Fase 3 (piloto, continuação): etapas de serviço e serviços da obra.
-- Espelha os tipos já existentes no Firestore (EtapaServico, ServicoObra)
-- em vez de inventar uma hierarquia nova — aditivo, RLS no mesmo padrão
-- de organization_members já usado em projects/cost_centers.

-- Catálogo de etapas de serviço (Terraplenagem, Drenagem, Pavimentação...),
-- por organização — mesmo escopo do EtapaServico atual no Firestore.
create table if not exists public.etapas_servico (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

-- Serviço contratado de uma obra específica: o que se mede e em que unidade.
create table if not exists public.servicos_obra (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  codigo text,
  descricao text not null,
  unidade text not null,
  quantidade_prevista numeric,
  situacao text not null default 'Ativo' check (situacao in ('Ativo', 'Suspenso', 'Concluído')),
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists etapas_servico_organization_idx
  on public.etapas_servico(organization_id);
create index if not exists servicos_obra_project_idx
  on public.servicos_obra(project_id);

alter table public.etapas_servico enable row level security;
alter table public.servicos_obra enable row level security;

create policy "members can read organization etapas"
  on public.etapas_servico for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization etapas"
  on public.etapas_servico for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization etapas"
  on public.etapas_servico for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization etapas"
  on public.etapas_servico for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read project servicos"
  on public.servicos_obra for select to authenticated
  using (exists (
    select 1 from public.projects project
    where project.id = servicos_obra.project_id
      and public.is_organization_member(project.organization_id)
  ));

create policy "editors can write project servicos"
  on public.servicos_obra for insert to authenticated
  with check (exists (
    select 1 from public.projects project
    where project.id = servicos_obra.project_id
      and public.has_organization_role(project.organization_id, array['admin', 'editor'])
  ));

create policy "editors can update project servicos"
  on public.servicos_obra for update to authenticated
  using (exists (
    select 1 from public.projects project
    where project.id = servicos_obra.project_id
      and public.has_organization_role(project.organization_id, array['admin', 'editor'])
  ))
  with check (exists (
    select 1 from public.projects project
    where project.id = servicos_obra.project_id
      and public.has_organization_role(project.organization_id, array['admin', 'editor'])
  ));

create policy "admins can delete project servicos"
  on public.servicos_obra for delete to authenticated
  using (exists (
    select 1 from public.projects project
    where project.id = servicos_obra.project_id
      and public.has_organization_role(project.organization_id, array['admin'])
  ));

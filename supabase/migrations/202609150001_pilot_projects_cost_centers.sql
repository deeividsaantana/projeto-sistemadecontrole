-- Fase 3 (piloto): fundação relacional para obras e centros de custo,
-- vinculados à organização (empresa) já existente desde a Fase 1. Aditivo
-- apenas — não interfere em erp_snapshots nem no fluxo Firebase atual.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

create index if not exists projects_organization_idx
  on public.projects(organization_id);
create index if not exists cost_centers_project_idx
  on public.cost_centers(project_id);

alter table public.projects enable row level security;
alter table public.cost_centers enable row level security;

-- Reaproveita organization_members (Fase 1) em vez de criar um segundo
-- conceito de "empresa" paralelo — organizations já cumpre esse papel.
create or replace function public.is_organization_member(p_organization_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(p_organization_id text, p_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.role = any(p_roles)
  );
$$;

revoke all on function public.is_organization_member(text) from public;
revoke all on function public.has_organization_role(text, text[]) from public;
grant execute on function public.is_organization_member(text) to authenticated;
grant execute on function public.has_organization_role(text, text[]) to authenticated;

create policy "members can read organization projects"
  on public.projects for select to authenticated
  using (public.is_organization_member(organization_id));

create policy "editors can write organization projects"
  on public.projects for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "editors can update organization projects"
  on public.projects for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));

create policy "admins can delete organization projects"
  on public.projects for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin']));

create policy "members can read project cost centers"
  on public.cost_centers for select to authenticated
  using (exists (
    select 1 from public.projects project
    where project.id = cost_centers.project_id
      and public.is_organization_member(project.organization_id)
  ));

create policy "editors can write project cost centers"
  on public.cost_centers for insert to authenticated
  with check (exists (
    select 1 from public.projects project
    where project.id = cost_centers.project_id
      and public.has_organization_role(project.organization_id, array['admin', 'editor'])
  ));

create policy "editors can update project cost centers"
  on public.cost_centers for update to authenticated
  using (exists (
    select 1 from public.projects project
    where project.id = cost_centers.project_id
      and public.has_organization_role(project.organization_id, array['admin', 'editor'])
  ))
  with check (exists (
    select 1 from public.projects project
    where project.id = cost_centers.project_id
      and public.has_organization_role(project.organization_id, array['admin', 'editor'])
  ));

create policy "admins can delete project cost centers"
  on public.cost_centers for delete to authenticated
  using (exists (
    select 1 from public.projects project
    where project.id = cost_centers.project_id
      and public.has_organization_role(project.organization_id, array['admin'])
  ));

-- Fase 1 da migração RENEA: espelho transicional do retrato operacional.
-- O Firebase segue como padrão até VITE_CLOUD_PROVIDER ser alterado.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.erp_snapshots (
  organization_id text primary key references public.organizations(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  record_count integer not null default 0 check (record_count >= 0),
  payload jsonb not null default '{}'::jsonb,
  constraint erp_snapshots_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.erp_snapshots enable row level security;

create policy "members can read their organization"
  on public.organizations for select to authenticated
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = organizations.id
      and member.user_id = auth.uid()
  ));

create policy "members can read their membership"
  on public.organization_members for select to authenticated
  using (user_id = auth.uid());

create policy "members can read organization snapshots"
  on public.erp_snapshots for select to authenticated
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = erp_snapshots.organization_id
      and member.user_id = auth.uid()
  ));

create or replace function public.publish_erp_snapshot(
  p_organization_id text,
  p_known_updated_at timestamptz,
  p_payload jsonb
)
returns table (published_at timestamptz, snapshot_version uuid, total_records integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_updated_at timestamptz;
  v_record_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.role in ('admin', 'editor')
  ) then
    raise exception 'ORGANIZATION_WRITE_DENIED';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_SNAPSHOT_PAYLOAD';
  end if;

  -- Serializa publicações da mesma organização, inclusive o primeiro insert.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id, 0));

  select snapshot.updated_at
    into v_current_updated_at
    from public.erp_snapshots snapshot
    where snapshot.organization_id = p_organization_id
    for update;

  if v_current_updated_at is not null
     and (p_known_updated_at is null or v_current_updated_at <> p_known_updated_at) then
    raise exception 'CLOUD_VERSION_CONFLICT';
  end if;

  select coalesce(sum(jsonb_array_length(entry.value)), 0)::integer
    into v_record_count
    from jsonb_each(p_payload) entry
    where jsonb_typeof(entry.value) = 'array';

  insert into public.erp_snapshots (
    organization_id, version, updated_at, updated_by, record_count, payload
  ) values (
    p_organization_id, gen_random_uuid(), clock_timestamp(), auth.uid(), v_record_count, p_payload
  )
  on conflict (organization_id) do update set
    version = excluded.version,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by,
    record_count = excluded.record_count,
    payload = excluded.payload
  returning erp_snapshots.updated_at, erp_snapshots.version, erp_snapshots.record_count
    into published_at, snapshot_version, total_records;

  return next;
end;
$$;

revoke all on function public.publish_erp_snapshot(text, timestamptz, jsonb) from public;
grant execute on function public.publish_erp_snapshot(text, timestamptz, jsonb) to authenticated;

insert into public.organizations (id, name)
values ('renea', 'RENEA Infraestrutura')
on conflict (id) do update set name = excluded.name;

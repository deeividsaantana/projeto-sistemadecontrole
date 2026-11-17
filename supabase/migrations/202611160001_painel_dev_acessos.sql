-- Painel Dev de acessos (pedido de 16/11/2026): um painel só, do dono do
-- sistema, para ver e mudar o que cada pessoa vê e faz, aba por aba.
--
-- Segurança:
-- - Quem é "dev" fica em erp_dev_owners. Só se entra nessa tabela pelo SQL
--   Editor do Supabase: o app não tem nenhum caminho para dar ou tirar dev.
-- - Toda mudança passa pelas funções abaixo, que só a API (service_role)
--   chama, e cada função confere no banco se quem pediu é dev.
-- - Cada mudança vira uma linha em erp_access_audit (quem, quando, antes e
--   depois). A auditoria só cresce; desfazer grava uma linha nova que aponta
--   para a desfeita, e uma linha só pode ser desfeita uma vez. Senha nunca
--   vai para o histórico: só fica anotado que uma senha nova foi gerada.
-- - Trava: o dev não esconde aba de si mesmo nem tira o próprio perfil de
--   administrador por aqui.
--
-- Cada regra de aba é a lista do que a pessoa pode fazer nela: ver, editar
-- (lançar e editar), aprovar e excluir. Lista vazia = sem acesso; sem
-- regra = o padrão do perfil.

create table if not exists public.erp_dev_owners (
  organization_id text not null default 'renea',
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.erp_access_rules (
  organization_id text not null default 'renea',
  user_id uuid not null references auth.users(id) on delete cascade,
  tab text not null check (tab ~ '^[a-z][a-z-]{1,40}$' and tab <> 'dev'),
  actions text[] not null check (
    actions <@ array['ver', 'editar', 'aprovar', 'excluir']::text[]
    and (cardinality(actions) = 0 or 'ver' = any(actions))
  ),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, tab)
);

create table if not exists public.erp_access_audit (
  id bigint generated always as identity primary key,
  organization_id text not null default 'renea',
  actor_user_id uuid not null,
  actor_name text not null,
  target_user_id uuid not null,
  target_name text not null,
  kind text not null check (kind in ('aba', 'perfil', 'situacao', 'contratacao', 'criacao', 'senha')),
  item text not null,
  before_value text,
  after_value text,
  undoes_id bigint references public.erp_access_audit(id),
  created_at timestamptz not null default now()
);

create index if not exists erp_access_audit_org_idx on public.erp_access_audit (organization_id, created_at desc);
create unique index if not exists erp_access_audit_desfaz_uma_vez on public.erp_access_audit (undoes_id) where undoes_id is not null;

create or replace function public.erp_access_audit_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'O histórico de acessos não pode ser alterado.' using errcode = 'P0003';
end;
$$;
drop trigger if exists erp_access_audit_no_change on public.erp_access_audit;
create trigger erp_access_audit_no_change before update or delete on public.erp_access_audit
  for each row execute function public.erp_access_audit_append_only();

create or replace function public.erp_is_dev(p_organization_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.erp_dev_owners d
    where d.organization_id = p_organization_id and d.user_id = p_user_id);
$$;

create or replace function public.erp_assert_dev(p_organization_id text, p_actor jsonb)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := nullif(p_actor->>'user_id', '')::uuid;
begin
  if v_actor is null or not public.erp_is_dev(p_organization_id, v_actor) then
    raise exception 'Só o dono do sistema mexe nos acessos.' using errcode = 'P0003';
  end if;
  return v_actor;
end;
$$;

create or replace function public.erp_member_name(p_organization_id text, p_user_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
begin
  select coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email, 'Usuário') into v_name
    from public.organization_members m join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and m.user_id = p_user_id;
  if v_name is null then raise exception 'Pessoa não encontrada nesta empresa.' using errcode = 'P0002'; end if;
  return v_name;
end;
$$;

-- Aba de uma pessoa: p_actions null volta ao padrão do perfil; lista vazia
-- tira o acesso. A ordem da lista é sempre ver, editar, aprovar, excluir.
create or replace function public.set_erp_access_rule(
  p_organization_id text, p_actor jsonb, p_user_id uuid, p_tab text, p_actions text[], p_undoes bigint default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.erp_assert_dev(p_organization_id, p_actor);
  v_target_name text := public.erp_member_name(p_organization_id, p_user_id);
  v_actions text[];
  v_before text[];
  v_id bigint;
begin
  if p_tab is null or p_tab !~ '^[a-z][a-z-]{1,40}$' or p_tab = 'dev' then
    raise exception 'Aba inválida.' using errcode = 'P0004';
  end if;
  if p_actions is not null then
    if not (p_actions <@ array['ver', 'editar', 'aprovar', 'excluir']::text[]) then
      raise exception 'Ação inválida.' using errcode = 'P0004';
    end if;
    -- Quem lança, aprova ou exclui precisa ver a aba.
    v_actions := array(select a from unnest(array['ver', 'editar', 'aprovar', 'excluir']) as a
      where a = any(p_actions) or (a = 'ver' and cardinality(p_actions) > 0));
  end if;
  if v_actions is not null and not ('ver' = any(v_actions)) and p_tab = 'dashboard' then
    raise exception 'A Visão geral fica sempre aberta: é para onde o sistema leva quem não tem outra aba.' using errcode = 'P0001';
  end if;
  if v_actions is not null and not ('ver' = any(v_actions)) and p_user_id = v_actor then
    raise exception 'Trava de segurança: você não pode esconder uma aba de si mesmo.' using errcode = 'P0001';
  end if;

  select r.actions into v_before from public.erp_access_rules r
    where r.organization_id = p_organization_id and r.user_id = p_user_id and r.tab = p_tab
    for update;
  if v_before is not distinct from v_actions then
    raise exception 'Nada mudou: a aba já está assim.' using errcode = 'P0001';
  end if;

  if v_actions is null then
    delete from public.erp_access_rules
      where organization_id = p_organization_id and user_id = p_user_id and tab = p_tab;
  else
    insert into public.erp_access_rules (organization_id, user_id, tab, actions, updated_by)
    values (p_organization_id, p_user_id, p_tab, v_actions, v_actor)
    on conflict (organization_id, user_id, tab)
      do update set actions = excluded.actions, updated_by = excluded.updated_by, updated_at = now();
  end if;

  insert into public.erp_access_audit
    (organization_id, actor_user_id, actor_name, target_user_id, target_name, kind, item, before_value, after_value, undoes_id)
  values (p_organization_id, v_actor, coalesce(p_actor->>'name', ''), p_user_id, v_target_name,
    'aba', p_tab, array_to_string(v_before, ','), array_to_string(v_actions, ','), p_undoes)
  returning id into v_id;
  return v_id;
end;
$$;

-- Perfil, situação, papéis da contratação, login novo e senha nova mudam pela
-- API (Auth e set_erp_hiring_role); esta função só confere o dev e grava o
-- histórico. A senha em si nunca chega aqui.
create or replace function public.record_erp_access_change(
  p_organization_id text, p_actor jsonb, p_user_id uuid, p_kind text, p_item text,
  p_before text, p_after text, p_undoes bigint default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.erp_assert_dev(p_organization_id, p_actor);
  v_id bigint;
begin
  if p_kind not in ('perfil', 'situacao', 'contratacao', 'criacao', 'senha') then
    raise exception 'Tipo de mudança inválido.' using errcode = 'P0004';
  end if;
  insert into public.erp_access_audit
    (organization_id, actor_user_id, actor_name, target_user_id, target_name, kind, item, before_value, after_value, undoes_id)
  values (p_organization_id, v_actor, coalesce(p_actor->>'name', ''), p_user_id,
    public.erp_member_name(p_organization_id, p_user_id), p_kind, left(coalesce(p_item, ''), 60),
    left(p_before, 60), left(p_after, 60), p_undoes)
  returning id into v_id;
  return v_id;
end;
$$;

-- Tudo o que o painel mostra, numa ida só ao banco.
create or replace function public.erp_dev_panel(p_organization_id text, p_actor jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := public.erp_assert_dev(p_organization_id, p_actor);
begin
  return jsonb_build_object(
    'me', v_actor,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email, 'Usuário'),
        'email', coalesce(u.email, ''),
        'membership', m.role,
        'claimed_role', coalesce(u.raw_app_meta_data->>'role', ''),
        'active', not coalesce(u.banned_until > now(), false),
        'last_sign_in_at', u.last_sign_in_at,
        'dev', public.erp_is_dev(p_organization_id, m.user_id)
      ) order by coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email))
      from public.organization_members m join auth.users u on u.id = m.user_id
      where m.organization_id = p_organization_id), '[]'::jsonb),
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'tab', r.tab, 'actions', to_jsonb(r.actions), 'updated_at', r.updated_at))
      from public.erp_access_rules r where r.organization_id = p_organization_id), '[]'::jsonb),
    'hiring', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', h.user_id, 'role', h.role))
      from public.erp_hiring_roles h where h.organization_id = p_organization_id), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(linha order by (linha->>'id')::bigint desc) from (
        select jsonb_build_object(
          'id', a.id, 'actor_name', a.actor_name, 'target_user_id', a.target_user_id,
          'target_name', a.target_name, 'kind', a.kind, 'item', a.item,
          'before', a.before_value, 'after', a.after_value, 'undoes_id', a.undoes_id,
          'undone', exists (select 1 from public.erp_access_audit d where d.undoes_id = a.id),
          'created_at', a.created_at) as linha
        from public.erp_access_audit a
        where a.organization_id = p_organization_id
        order by a.id desc limit 300) ultimas), '[]'::jsonb)
  );
end;
$$;

alter table public.erp_dev_owners enable row level security;
alter table public.erp_access_rules enable row level security;
alter table public.erp_access_audit enable row level security;

revoke all on public.erp_dev_owners, public.erp_access_rules, public.erp_access_audit from public, anon, authenticated;

-- O navegador só lê as próprias linhas: se é dev e as próprias regras de aba
-- (para montar o menu). Gravar, só pelas funções acima, via API.
grant select on public.erp_dev_owners, public.erp_access_rules to authenticated;
drop policy if exists "dev le a si mesmo" on public.erp_dev_owners;
create policy "dev le a si mesmo" on public.erp_dev_owners
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "cada um le as proprias regras" on public.erp_access_rules;
create policy "cada um le as proprias regras" on public.erp_access_rules
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on function public.erp_is_dev(text, uuid) from public, anon, authenticated;
revoke all on function public.erp_assert_dev(text, jsonb) from public, anon, authenticated;
revoke all on function public.erp_member_name(text, uuid) from public, anon, authenticated;
revoke all on function public.set_erp_access_rule(text, jsonb, uuid, text, text[], bigint) from public, anon, authenticated;
revoke all on function public.record_erp_access_change(text, jsonb, uuid, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.erp_dev_panel(text, jsonb) from public, anon, authenticated;
grant execute on function public.set_erp_access_rule(text, jsonb, uuid, text, text[], bigint) to service_role;
grant execute on function public.record_erp_access_change(text, jsonb, uuid, text, text, text, text, bigint) to service_role;
grant execute on function public.erp_dev_panel(text, jsonb) to service_role;
grant execute on function public.erp_is_dev(text, uuid) to service_role;

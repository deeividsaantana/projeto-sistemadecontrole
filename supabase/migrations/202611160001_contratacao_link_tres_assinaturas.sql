-- Solicitação de Contratação, fluxo novo (16/11/2026):
-- 1) cada pedido ganha um link próprio com token único (/contratacao-link/<token>);
-- 2) ordem rígida de 3 assinaturas: 1ª gerente (Bruno) -> 2ª gerente
--    (Marcelo Suegama) -> 3ª RH. Quem é cada um o administrador marca em
--    "Quem assina" (papéis gerente_1, gerente_2, rh);
-- 3) quem abre o pedido só preenche (não assina mais);
-- 4) cada assinatura grava cargo e um hash de validação próprio;
-- 5) com a 3ª assinatura o pedido fica CONCLUIDO e o link expira.
-- A ordem e o "quem pode" são conferidos AQUI, no banco, e de novo na API.
-- Só a API (service_role) chama as funções; o navegador nunca lê estas tabelas.

begin;

-- Papéis ------------------------------------------------------------------
alter table public.erp_hiring_roles drop constraint if exists erp_hiring_roles_role_check;
delete from public.erp_hiring_roles where role = 'gerente';
alter table public.erp_hiring_roles add constraint erp_hiring_roles_role_check
  check (role in ('gerente_1', 'gerente_2', 'rh', 'auxiliar'));
-- 1ª e 2ª assinatura têm uma pessoa só cada; RH pode ter mais de uma.
create unique index if not exists erp_hiring_roles_um_titular_idx
  on public.erp_hiring_roles (organization_id, role) where role in ('gerente_1', 'gerente_2');

-- Pedidos -----------------------------------------------------------------
alter table public.erp_hiring_requests drop constraint if exists erp_hiring_requests_status_check;
alter table public.erp_hiring_requests drop constraint if exists erp_hiring_requests_rejected_stage_check;
alter table public.erp_hiring_requests add column if not exists etapa_atual smallint;
alter table public.erp_hiring_requests add column if not exists link_token text;
alter table public.erp_hiring_requests add column if not exists concluded_at timestamptz;

-- Pedidos em aberto do fluxo antigo recomeçam na 1ª assinatura do fluxo novo.
update public.erp_hiring_requests set status = 'etapa_1', etapa_atual = 1
  where status in ('aguardando_rh', 'aguardando_gerente');
update public.erp_hiring_requests set status = 'concluido', etapa_atual = null, concluded_at = coalesce(concluded_at, updated_at)
  where status = 'aprovada';
update public.erp_hiring_requests
  set link_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where link_token is null;

alter table public.erp_hiring_requests alter column status set default 'etapa_1';
alter table public.erp_hiring_requests alter column link_token set not null;
alter table public.erp_hiring_requests add constraint erp_hiring_requests_status_check
  check (status in ('etapa_1', 'etapa_2', 'etapa_3', 'concluido', 'recusada'));
alter table public.erp_hiring_requests add constraint erp_hiring_requests_rejected_stage_check
  check (rejected_stage in ('gerente_1', 'gerente_2', 'rh', 'gerente'));
alter table public.erp_hiring_requests drop constraint if exists erp_hiring_requests_etapa_check;
alter table public.erp_hiring_requests add constraint erp_hiring_requests_etapa_check check (
  (status = 'etapa_1' and etapa_atual = 1) or (status = 'etapa_2' and etapa_atual = 2)
  or (status = 'etapa_3' and etapa_atual = 3) or (status in ('concluido', 'recusada') and etapa_atual is null));
alter table public.erp_hiring_requests drop constraint if exists erp_hiring_requests_token_check;
alter table public.erp_hiring_requests add constraint erp_hiring_requests_token_check check (link_token ~ '^[0-9a-f]{64}$');
create unique index if not exists erp_hiring_requests_link_token_idx on public.erp_hiring_requests (link_token);

-- Assinaturas -------------------------------------------------------------
alter table public.erp_hiring_signatures drop constraint if exists erp_hiring_signatures_stage_check;
alter table public.erp_hiring_signatures add constraint erp_hiring_signatures_stage_check
  check (stage in ('solicitante', 'gerente_1', 'gerente_2', 'rh', 'gerente'));
alter table public.erp_hiring_signatures add column if not exists signer_cargo text;
alter table public.erp_hiring_signatures add column if not exists hash_validacao text;
create unique index if not exists erp_hiring_signatures_hash_idx on public.erp_hiring_signatures (hash_validacao) where hash_validacao is not null;

-- Abrir pedido: só os dados. Gera o link e grava na auditoria. ----------------
drop function if exists public.create_erp_hiring_request(text, jsonb, jsonb, text, jsonb, text);
create or replace function public.create_erp_hiring_request(
  p_organization_id text, p_actor jsonb, p_form jsonb, p_form_hash text, p_client_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (p_actor->>'user_id')::uuid;
  v_name text := coalesce(nullif(trim(p_actor->>'name'), ''), 'Sem nome');
  v_seq integer;
  v_year text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_request public.erp_hiring_requests;
begin
  if v_actor is null then raise exception 'Sessão inválida.' using errcode = 'P0003'; end if;
  if not exists (select 1 from public.organization_members m where m.user_id = v_actor and m.organization_id = p_organization_id) then
    raise exception 'Sua conta não faz parte desta empresa.' using errcode = 'P0003';
  end if;
  if coalesce(p_client_key, '') !~ '^[a-zA-Z0-9_-]{12,80}$' then
    raise exception 'Envio sem identificação. Atualize a página.' using errcode = 'P0004';
  end if;
  if coalesce(p_form_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Dados sem código de conferência.' using errcode = 'P0004';
  end if;
  perform pg_advisory_xact_lock(hashtext('erp_hiring_seq:' || p_organization_id));
  -- Duplo clique ou reenvio depois de queda: devolve o pedido já criado.
  select * into v_request from public.erp_hiring_requests
    where organization_id = p_organization_id and client_key = p_client_key;
  if found then
    if v_request.requester_user_id <> v_actor then
      raise exception 'Envio repetido inválido.' using errcode = 'P0003';
    end if;
    return to_jsonb(v_request);
  end if;
  select coalesce(max(seq), 0) + 1 into v_seq from public.erp_hiring_requests where organization_id = p_organization_id;

  insert into public.erp_hiring_requests (organization_id, seq, request_number, requester_user_id, requester_name,
    form, form_hash, client_key, status, etapa_atual, link_token)
  values (p_organization_id, v_seq, 'CONT-' || v_year || '-' || lpad(v_seq::text, 4, '0'), v_actor, v_name,
    p_form, p_form_hash, p_client_key, 'etapa_1', 1,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  returning * into v_request;

  insert into public.erp_hiring_audit (organization_id, request_id, actor_user_id, actor_name, action, from_status, to_status, details)
  values (p_organization_id, v_request.id, v_actor, v_name, 'abriu', null, v_request.status,
    jsonb_build_object('form_hash', p_form_hash));

  return to_jsonb(v_request);
end;
$$;

-- Assinar (aprovar) ou recusar a etapa atual. Confere: etapa atual, papel de
-- quem age (gerente_1 -> gerente_2 -> rh), versão (dois cliques ao mesmo
-- tempo) e que a mesma pessoa não assina duas etapas do mesmo pedido.
create or replace function public.sign_erp_hiring_request(
  p_organization_id text, p_request_id uuid, p_expected_version integer,
  p_actor jsonb, p_decision text, p_signature jsonb, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (p_actor->>'user_id')::uuid;
  v_name text := coalesce(nullif(trim(p_actor->>'name'), ''), 'Sem nome');
  v_request public.erp_hiring_requests;
  v_from text;
  v_stage text;
  v_cargo text;
  v_now timestamptz := clock_timestamp();
  v_prev text;
  v_hash text;
begin
  if v_actor is null then raise exception 'Sessão inválida.' using errcode = 'P0003'; end if;
  select * into v_request from public.erp_hiring_requests
    where id = p_request_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  if v_request.status in ('concluido', 'recusada') then
    raise exception 'Este pedido já foi encerrado.' using errcode = 'P0001';
  end if;
  if v_request.version <> p_expected_version then
    raise exception 'Este pedido mudou enquanto você olhava. Abra de novo.' using errcode = 'P0001';
  end if;

  v_from := v_request.status;
  v_stage := case v_request.etapa_atual when 1 then 'gerente_1' when 2 then 'gerente_2' when 3 then 'rh' end;
  v_cargo := case v_stage when 'rh' then 'RH' else 'Gerente' end;
  if v_stage is null then raise exception 'Etapa inválida.' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.erp_hiring_roles r
      where r.organization_id = p_organization_id and r.user_id = v_actor and r.role = v_stage) then
    raise exception 'Aguardando assinatura prioritária de: %.', coalesce((
      select string_agg(r.user_name || ' (' || v_cargo || ')', ', ') from public.erp_hiring_roles r
        where r.organization_id = p_organization_id and r.role = v_stage), v_cargo) using errcode = 'P0003';
  end if;
  if exists (select 1 from public.erp_hiring_signatures s
      where s.request_id = v_request.id and s.signer_user_id = v_actor and s.stage <> 'solicitante') then
    raise exception 'Quem já assinou uma etapa deste pedido não assina outra.' using errcode = 'P0003';
  end if;

  if p_decision = 'aprovar' then
    perform public.erp_hiring_check_signature(p_signature);
    select s.hash_validacao into v_prev from public.erp_hiring_signatures s
      where s.request_id = v_request.id and s.hash_validacao is not null order by s.signed_at desc limit 1;
    -- Hash da operação: pedido, etapa, quem, quando, dados assinados e o hash
    -- da assinatura anterior (corrente: mexer numa quebra as seguintes).
    v_hash := encode(sha256(convert_to(concat_ws('|', v_request.id, v_stage, v_actor, v_name, v_cargo,
      to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), v_request.form_hash, coalesce(v_prev, '')), 'UTF8')), 'hex');
    insert into public.erp_hiring_signatures (organization_id, request_id, stage, signer_user_id, signer_name, signer_cargo,
      method, image_data, form_hash, signed_at, hash_validacao)
    values (p_organization_id, v_request.id, v_stage, v_actor, v_name, v_cargo, p_signature->>'method',
      case when p_signature->>'method' = 'desenho' then p_signature->>'image_data' end, v_request.form_hash, v_now, v_hash);
    if v_request.etapa_atual = 3 then
      update public.erp_hiring_requests set status = 'concluido', etapa_atual = null, concluded_at = v_now,
        version = version + 1, updated_at = v_now where id = v_request.id returning * into v_request;
    else
      update public.erp_hiring_requests set status = 'etapa_' || (etapa_atual + 1), etapa_atual = etapa_atual + 1,
        version = version + 1, updated_at = v_now where id = v_request.id returning * into v_request;
    end if;
  elsif p_decision = 'recusar' then
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Escreva o motivo da recusa.' using errcode = 'P0004';
    end if;
    update public.erp_hiring_requests set status = 'recusada', etapa_atual = null, rejected_stage = v_stage,
      rejection_reason = left(trim(p_reason), 1000), version = version + 1, updated_at = v_now
      where id = v_request.id returning * into v_request;
  else
    raise exception 'Decisão inválida.' using errcode = 'P0004';
  end if;

  insert into public.erp_hiring_audit (organization_id, request_id, actor_user_id, actor_name, action, from_status, to_status, details)
  values (p_organization_id, v_request.id, v_actor, v_name,
    case when p_decision = 'aprovar' then 'assinou_' || v_stage else 'recusou_' || v_stage end,
    v_from, v_request.status,
    jsonb_strip_nulls(jsonb_build_object('cargo', v_cargo, 'hash_validacao', v_hash, 'method', p_signature->>'method',
      'reason', nullif(trim(coalesce(p_reason, '')), ''))));

  return to_jsonb(v_request);
end;
$$;

-- Só o administrador marca quem assina cada etapa.
create or replace function public.set_erp_hiring_role(
  p_organization_id text, p_actor jsonb, p_user_id uuid, p_role text, p_active boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (p_actor->>'user_id')::uuid;
  v_member record;
  v_outro text;
begin
  if not exists (select 1 from public.organization_members m
      where m.user_id = v_actor and m.organization_id = p_organization_id and m.role = 'admin') then
    raise exception 'Só o administrador define os papéis da contratação.' using errcode = 'P0003';
  end if;
  if p_role not in ('gerente_1', 'gerente_2', 'rh', 'auxiliar') then raise exception 'Papel inválido.' using errcode = 'P0004'; end if;
  select u.id, coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email) as name, coalesce(u.email, '') as email
    into v_member
    from public.organization_members m join auth.users u on u.id = m.user_id
    where m.user_id = p_user_id and m.organization_id = p_organization_id;
  if not found then raise exception 'Pessoa não encontrada nesta empresa.' using errcode = 'P0002'; end if;

  if p_active then
    if p_role in ('gerente_1', 'gerente_2') then
      select r.user_name into v_outro from public.erp_hiring_roles r
        where r.organization_id = p_organization_id and r.role = p_role and r.user_id <> p_user_id;
      if found then
        raise exception '% já está nesta assinatura. Desmarque antes de trocar.', v_outro using errcode = 'P0001';
      end if;
    end if;
    insert into public.erp_hiring_roles (organization_id, user_id, role, user_name, user_email, assigned_by)
    values (p_organization_id, p_user_id, p_role, v_member.name, v_member.email, v_actor)
    on conflict (organization_id, user_id, role) do nothing;
  else
    delete from public.erp_hiring_roles where organization_id = p_organization_id and user_id = p_user_id and role = p_role;
  end if;

  insert into public.erp_hiring_audit (organization_id, request_id, actor_user_id, actor_name, action, details)
  values (p_organization_id, null, v_actor, coalesce(p_actor->>'name', ''),
    case when p_active then 'deu_papel' else 'tirou_papel' end,
    jsonb_build_object('user_id', p_user_id, 'user_name', v_member.name, 'role', p_role));
end;
$$;

-- Mesmas travas de antes: RLS ligado, nada para anon/authenticated.
alter table public.erp_hiring_roles enable row level security;
alter table public.erp_hiring_requests enable row level security;
alter table public.erp_hiring_signatures enable row level security;
alter table public.erp_hiring_audit enable row level security;
revoke all on public.erp_hiring_roles, public.erp_hiring_requests, public.erp_hiring_signatures, public.erp_hiring_audit from public, anon, authenticated;
revoke all on function public.create_erp_hiring_request(text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.sign_erp_hiring_request(text, uuid, integer, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.set_erp_hiring_role(text, jsonb, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.create_erp_hiring_request(text, jsonb, jsonb, text, text) to service_role;
grant execute on function public.sign_erp_hiring_request(text, uuid, integer, jsonb, text, jsonb, text) to service_role;
grant execute on function public.set_erp_hiring_role(text, jsonb, uuid, text, boolean) to service_role;

commit;

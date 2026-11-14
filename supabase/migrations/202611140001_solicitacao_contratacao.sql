-- Solicitação de Contratação assinável (SGR-FRH-21-373-01-000-000-0008).
-- Fluxo rígido: solicitante assina ao pedir -> RH assina -> gerente assina.
-- A sequência, o papel de quem assina e a separação de funções (a mesma
-- pessoa não assina duas etapas do mesmo pedido) são conferidos AQUI, no
-- banco, e não só na tela. Só a API (service_role) chama as funções; o
-- navegador nunca lê nem grava estas tabelas direto.

create table if not exists public.erp_hiring_roles (
  organization_id text not null default 'renea',
  user_id uuid not null,
  role text not null check (role in ('rh', 'gerente', 'auxiliar')),
  user_name text not null,
  user_email text not null default '',
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  primary key (organization_id, user_id, role)
);

create table if not exists public.erp_hiring_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'renea',
  seq integer not null check (seq > 0),
  request_number text not null,
  requester_user_id uuid not null,
  requester_name text not null,
  form jsonb not null,
  form_hash text not null,
  client_key text not null,
  status text not null default 'aguardando_rh'
    check (status in ('aguardando_rh', 'aguardando_gerente', 'aprovada', 'recusada')),
  rejected_stage text check (rejected_stage in ('rh', 'gerente')),
  rejection_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, seq),
  unique (organization_id, request_number),
  unique (organization_id, client_key)
);

create table if not exists public.erp_hiring_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'renea',
  request_id uuid not null references public.erp_hiring_requests(id) on delete restrict,
  stage text not null check (stage in ('solicitante', 'rh', 'gerente')),
  signer_user_id uuid not null,
  signer_name text not null,
  method text not null check (method in ('desenho', 'digitado')),
  image_data text,
  form_hash text not null,
  signed_at timestamptz not null default now(),
  unique (request_id, stage),
  check (method = 'digitado' or (image_data like 'data:image/png;base64,%' and length(image_data) <= 200000))
);

create table if not exists public.erp_hiring_audit (
  id bigint generated always as identity primary key,
  organization_id text not null default 'renea',
  request_id uuid references public.erp_hiring_requests(id) on delete restrict,
  actor_user_id uuid not null,
  actor_name text not null,
  action text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists erp_hiring_requests_status_idx on public.erp_hiring_requests (organization_id, status, created_at desc);
create index if not exists erp_hiring_requests_requester_idx on public.erp_hiring_requests (organization_id, requester_user_id);
create index if not exists erp_hiring_audit_request_idx on public.erp_hiring_audit (request_id, created_at);

-- Auditoria só cresce: nem a API consegue editar ou apagar uma linha.
create or replace function public.erp_hiring_audit_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'A auditoria da contratação não pode ser alterada.' using errcode = 'P0003';
end;
$$;
drop trigger if exists erp_hiring_audit_no_change on public.erp_hiring_audit;
create trigger erp_hiring_audit_no_change before update or delete on public.erp_hiring_audit
  for each row execute function public.erp_hiring_audit_append_only();

-- Assinatura dada não muda nem some.
drop trigger if exists erp_hiring_signatures_no_change on public.erp_hiring_signatures;
create trigger erp_hiring_signatures_no_change before update or delete on public.erp_hiring_signatures
  for each row execute function public.erp_hiring_audit_append_only();

create or replace function public.erp_hiring_check_signature(p_signature jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  v_method text := coalesce(p_signature->>'method', '');
  v_image text := p_signature->>'image_data';
begin
  if v_method not in ('desenho', 'digitado') then
    raise exception 'Escolha desenhar ou digitar a assinatura.' using errcode = 'P0004';
  end if;
  if v_method = 'desenho' and (v_image is null or v_image not like 'data:image/png;base64,%' or length(v_image) > 200000) then
    raise exception 'O desenho da assinatura não veio ou é grande demais.' using errcode = 'P0004';
  end if;
end;
$$;

-- Abre o pedido e grava a assinatura do solicitante na mesma transação.
create or replace function public.create_erp_hiring_request(
  p_organization_id text, p_actor jsonb, p_form jsonb, p_form_hash text, p_signature jsonb, p_client_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (p_actor->>'user_id')::uuid;
  v_name text := coalesce(nullif(trim(p_actor->>'name'), ''), 'Sem nome');
  v_seq integer;
  v_year text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_number text;
  v_request public.erp_hiring_requests;
begin
  if v_actor is null then raise exception 'Sessão inválida.' using errcode = 'P0003'; end if;
  if not exists (select 1 from public.organization_members m where m.user_id = v_actor and m.organization_id = p_organization_id) then
    raise exception 'Sua conta não faz parte desta empresa.' using errcode = 'P0003';
  end if;
  if coalesce(p_client_key, '') !~ '^[a-zA-Z0-9_-]{12,80}$' then
    raise exception 'Envio sem identificação. Atualize a página.' using errcode = 'P0004';
  end if;
  perform public.erp_hiring_check_signature(p_signature);
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
  v_number := 'CONT-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into public.erp_hiring_requests (organization_id, seq, request_number, requester_user_id, requester_name, form, form_hash, client_key)
  values (p_organization_id, v_seq, v_number, v_actor, v_name, p_form, p_form_hash, p_client_key)
  returning * into v_request;

  insert into public.erp_hiring_signatures (organization_id, request_id, stage, signer_user_id, signer_name, method, image_data, form_hash)
  values (p_organization_id, v_request.id, 'solicitante', v_actor, v_name, p_signature->>'method',
    case when p_signature->>'method' = 'desenho' then p_signature->>'image_data' end, p_form_hash);

  insert into public.erp_hiring_audit (organization_id, request_id, actor_user_id, actor_name, action, from_status, to_status, details)
  values (p_organization_id, v_request.id, v_actor, v_name, 'criou_e_assinou', null, v_request.status,
    jsonb_build_object('form_hash', p_form_hash, 'method', p_signature->>'method'));

  return to_jsonb(v_request);
end;
$$;

-- RH ou gerente assina (aprova) ou recusa. Confere a etapa atual, o papel
-- de quem age, a versão (dois cliques ao mesmo tempo) e a separação de funções.
create or replace function public.sign_erp_hiring_request(
  p_organization_id text, p_request_id uuid, p_expected_version integer,
  p_actor jsonb, p_decision text, p_signature jsonb, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (p_actor->>'user_id')::uuid;
  v_name text := coalesce(nullif(trim(p_actor->>'name'), ''), 'Sem nome');
  v_request public.erp_hiring_requests;
  v_stage text;
  v_next text;
begin
  if v_actor is null then raise exception 'Sessão inválida.' using errcode = 'P0003'; end if;
  select * into v_request from public.erp_hiring_requests
    where id = p_request_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  if v_request.version <> p_expected_version then
    raise exception 'Este pedido mudou enquanto você olhava. Abra de novo.' using errcode = 'P0001';
  end if;

  if v_request.status = 'aguardando_rh' then v_stage := 'rh'; v_next := 'aguardando_gerente';
  elsif v_request.status = 'aguardando_gerente' then v_stage := 'gerente'; v_next := 'aprovada';
  else raise exception 'Este pedido já foi encerrado.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.erp_hiring_roles r
      where r.organization_id = p_organization_id and r.user_id = v_actor and r.role = v_stage) then
    raise exception 'Esta etapa é de %. Você não pode assinar por ela.',
      case v_stage when 'rh' then 'RH' else 'gerente de contrato' end using errcode = 'P0003';
  end if;
  if exists (select 1 from public.erp_hiring_signatures s where s.request_id = v_request.id and s.signer_user_id = v_actor) then
    raise exception 'Quem já assinou uma etapa deste pedido não assina outra.' using errcode = 'P0003';
  end if;

  if p_decision = 'aprovar' then
    perform public.erp_hiring_check_signature(p_signature);
    insert into public.erp_hiring_signatures (organization_id, request_id, stage, signer_user_id, signer_name, method, image_data, form_hash)
    values (p_organization_id, v_request.id, v_stage, v_actor, v_name, p_signature->>'method',
      case when p_signature->>'method' = 'desenho' then p_signature->>'image_data' end, v_request.form_hash);
    update public.erp_hiring_requests set status = v_next, version = version + 1, updated_at = now()
      where id = v_request.id returning * into v_request;
  elsif p_decision = 'recusar' then
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Escreva o motivo da recusa.' using errcode = 'P0004';
    end if;
    update public.erp_hiring_requests set status = 'recusada', rejected_stage = v_stage,
      rejection_reason = left(trim(p_reason), 1000), version = version + 1, updated_at = now()
      where id = v_request.id returning * into v_request;
  else
    raise exception 'Decisão inválida.' using errcode = 'P0004';
  end if;

  insert into public.erp_hiring_audit (organization_id, request_id, actor_user_id, actor_name, action, from_status, to_status, details)
  values (p_organization_id, v_request.id, v_actor, v_name,
    case when p_decision = 'aprovar' then 'assinou_' || v_stage else 'recusou_' || v_stage end,
    case v_stage when 'rh' then 'aguardando_rh' else 'aguardando_gerente' end, v_request.status,
    jsonb_strip_nulls(jsonb_build_object('method', p_signature->>'method', 'reason', nullif(trim(coalesce(p_reason, '')), ''))));

  return to_jsonb(v_request);
end;
$$;

-- Só o administrador da empresa define quem é RH, gerente ou auxiliar (só vê).
create or replace function public.set_erp_hiring_role(
  p_organization_id text, p_actor jsonb, p_user_id uuid, p_role text, p_active boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (p_actor->>'user_id')::uuid;
  v_member record;
begin
  if not exists (select 1 from public.organization_members m
      where m.user_id = v_actor and m.organization_id = p_organization_id and m.role = 'admin') then
    raise exception 'Só o administrador define os papéis da contratação.' using errcode = 'P0003';
  end if;
  if p_role not in ('rh', 'gerente', 'auxiliar') then raise exception 'Papel inválido.' using errcode = 'P0004'; end if;
  select u.id, coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email) as name, coalesce(u.email, '') as email
    into v_member
    from public.organization_members m join auth.users u on u.id = m.user_id
    where m.user_id = p_user_id and m.organization_id = p_organization_id;
  if not found then raise exception 'Pessoa não encontrada nesta empresa.' using errcode = 'P0002'; end if;

  if p_active then
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

alter table public.erp_hiring_roles enable row level security;
alter table public.erp_hiring_requests enable row level security;
alter table public.erp_hiring_signatures enable row level security;
alter table public.erp_hiring_audit enable row level security;

revoke all on public.erp_hiring_roles, public.erp_hiring_requests, public.erp_hiring_signatures, public.erp_hiring_audit from public, anon, authenticated;
revoke all on function public.create_erp_hiring_request(text, jsonb, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.sign_erp_hiring_request(text, uuid, integer, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.set_erp_hiring_role(text, jsonb, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.erp_hiring_check_signature(jsonb) from public, anon, authenticated;
grant execute on function public.create_erp_hiring_request(text, jsonb, jsonb, text, jsonb, text) to service_role;
grant execute on function public.sign_erp_hiring_request(text, uuid, integer, jsonb, text, jsonb, text) to service_role;
grant execute on function public.set_erp_hiring_role(text, jsonb, uuid, text, boolean) to service_role;
grant execute on function public.erp_hiring_check_signature(jsonb) to service_role;

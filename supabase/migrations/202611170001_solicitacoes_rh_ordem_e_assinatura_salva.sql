-- Solicitações de RH (17/11/2026):
-- 1) nova ordem das 3 assinaturas: 1ª RH -> 2ª gerente (Bruno) -> 3ª gerente
--    (Marcelo Suegama). Vale para contratação, promoção e desligamento (o tipo
--    fica dentro do formulário, campo "solicitacao"; o banco não muda por isso);
-- 2) pedidos em aberto vão para a primeira etapa da nova ordem que ainda não
--    tem assinatura (as assinaturas já feitas continuam valendo);
-- 3) assinatura salva: cada pessoa guarda o desenho para usar nas próximas.
-- Só a API (service_role) mexe nestas tabelas; o navegador nunca lê direto.

begin;

-- Assinatura salva ------------------------------------------------------------
create table if not exists public.erp_hiring_saved_signatures (
  organization_id text not null,
  user_id uuid not null,
  image_data text not null check (image_data like 'data:image/png;base64,%' and length(image_data) <= 200000),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.erp_hiring_saved_signatures enable row level security;
revoke all on public.erp_hiring_saved_signatures from public, anon, authenticated;
grant select, insert, update, delete on public.erp_hiring_saved_signatures to service_role;

-- Assinar (aprovar) ou recusar a etapa atual. Confere: etapa atual, papel de
-- quem age (rh -> gerente_1 -> gerente_2), versão (dois cliques ao mesmo
-- tempo) e que a mesma pessoa não assina duas etapas do mesmo pedido. Depois
-- de assinar, segue para a próxima etapa que ainda não tem assinatura (pedido
-- antigo que já tinha a do Bruno pula direto para a do Marcelo).
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
  v_next smallint;
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
  v_stage := case v_request.etapa_atual when 1 then 'rh' when 2 then 'gerente_1' when 3 then 'gerente_2' end;
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
    select min(e.n) into v_next
      from (values (1::smallint, 'rh'), (2::smallint, 'gerente_1'), (3::smallint, 'gerente_2')) as e(n, st)
      where e.n > v_request.etapa_atual
        and not exists (select 1 from public.erp_hiring_signatures s where s.request_id = v_request.id and s.stage = e.st);
    if v_next is null then
      update public.erp_hiring_requests set status = 'concluido', etapa_atual = null, concluded_at = v_now,
        version = version + 1, updated_at = v_now where id = v_request.id returning * into v_request;
    else
      update public.erp_hiring_requests set status = 'etapa_' || v_next, etapa_atual = v_next,
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


-- Pedidos em aberto: primeira etapa da nova ordem sem assinatura.
update public.erp_hiring_requests r set etapa_atual = p.n, status = 'etapa_' || p.n, version = r.version + 1, updated_at = now()
  from (
    select r2.id, (select min(e.n) from (values (1::smallint, 'rh'), (2::smallint, 'gerente_1'), (3::smallint, 'gerente_2')) as e(n, st)
      where not exists (select 1 from public.erp_hiring_signatures s where s.request_id = r2.id and s.stage = e.st)) as n
    from public.erp_hiring_requests r2 where r2.status in ('etapa_1', 'etapa_2', 'etapa_3')
  ) p
  where r.id = p.id and p.n is not null and p.n is distinct from r.etapa_atual;

revoke all on function public.sign_erp_hiring_request(text, uuid, integer, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.sign_erp_hiring_request(text, uuid, integer, jsonb, text, jsonb, text) to service_role;

commit;

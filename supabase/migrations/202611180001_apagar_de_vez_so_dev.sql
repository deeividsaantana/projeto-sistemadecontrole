-- Apagar de vez: só o dono do sistema (18/11/2026).
--
-- Pedido do Deivid: poder apagar de forma permanente as solicitações de
-- compra (aba Solicitações) e as de RH (aba Contratação), e mais ninguém.
-- "Dono do sistema" é quem está em erp_dev_owners (o mesmo da aba Dev). Aqui
-- o banco confere; a tela só esconde o botão.
--
-- 1) Compras e Programação: as solicitações e os lançamentos de produção
--    moram no bloco da obra (erp_snapshots, tabelas "solicitacoes" e
--    "producaoRegistros"). Todo envio passa por erp_recusar_por_perfil; ela agora
--    chama erp_recusar_apagar_so_dev, que recusa (ROLE_WRITE_DENIED) o
--    envio de quem não é dono e tira um registro dessas listas sem marca de
--    exclusão já existente, ou traz marca de exclusão nova delas. Corrigir
--    (editar) continua livre para quem já podia.
--    O resto da função é igual à de 04/11/2026.
-- 2) RH: erp_hiring_delete_request apaga o pedido, as assinaturas e o
--    histórico dele, e deixa uma linha no histórico geral dizendo quem apagou
--    o quê. Só a API (service_role) chama, e a função confere o dono de novo.

begin;

-- 1) Compras -----------------------------------------------------------------
create or replace function public.erp_recusar_apagar_so_dev(
  p_organization_id text,
  p_antes jsonb,
  p_depois jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tabelas text[] := array['solicitacoes', 'producaoRegistros'];
  v_tabela text;
  v_a jsonb;
  v_d jsonb;
  v_marcas_antes jsonb;
  v_marcas_depois jsonb;
  v_marca_nova boolean := false;
  v_saiu boolean := false;
begin
  -- Sem login (servidor com service_role) não passa por aqui.
  if auth.uid() is null then
    return;
  end if;
  if p_antes is null or jsonb_typeof(p_antes) <> 'object' or p_depois is null or jsonb_typeof(p_depois) <> 'object' then
    return;
  end if;

  v_marcas_antes := case when jsonb_typeof(p_antes -> 'exclusoes') = 'array' then p_antes -> 'exclusoes' else '[]'::jsonb end;
  v_marcas_depois := case when jsonb_typeof(p_depois -> 'exclusoes') = 'array' then p_depois -> 'exclusoes' else '[]'::jsonb end;

  if v_marcas_antes <> v_marcas_depois then
    select exists (
      select marca from jsonb_array_elements(v_marcas_depois) as depois(marca)
        where marca ->> 'tabela' = any(v_tabelas)
      except
      select marca from jsonb_array_elements(v_marcas_antes) as antes(marca)
        where marca ->> 'tabela' = any(v_tabelas)
    ) into v_marca_nova;
  end if;

  foreach v_tabela in array v_tabelas loop
    exit when v_marca_nova or v_saiu;
    v_a := case when jsonb_typeof(p_antes -> v_tabela) = 'array' then p_antes -> v_tabela else '[]'::jsonb end;
    v_d := case when jsonb_typeof(p_depois -> v_tabela) = 'array' then p_depois -> v_tabela else '[]'::jsonb end;
    continue when v_a = v_d;
    -- Saiu da lista sem marca ativa de antes (a mais recente do registro, sem
    -- restauradoEm), como em erp_recusar_por_perfil.
    select exists (
      select 1 from (
        select item ->> 'id' as id from jsonb_array_elements(v_a) item where coalesce(item ->> 'id', '') <> ''
        except
        select item ->> 'id' from jsonb_array_elements(v_d) item
      ) saiu
      where not exists (
        select 1 from (
          select distinct on (marca ->> 'registroId') marca -> 'restauradoEm' as restaurado
          from jsonb_array_elements(v_marcas_antes) marca
          where marca ->> 'tabela' = v_tabela and marca ->> 'registroId' = saiu.id
          order by marca ->> 'registroId', marca ->> 'excluidoEm' collate "C" desc nulls last
        ) ultima
        where not coalesce(jsonb_typeof(restaurado) = 'string' and restaurado #>> '{}' <> '', false)
      )
    ) into v_saiu;
  end loop;

  if (v_marca_nova or v_saiu) and not public.erp_is_dev(p_organization_id, auth.uid()) then
    raise exception 'ROLE_WRITE_DENIED'
      using detail = 'apagado de vez: só o dono do sistema apaga solicitações e lançamentos de produção';
  end if;
end;
$$;

revoke all on function public.erp_recusar_apagar_so_dev(text, jsonb, jsonb) from public, anon;

create or replace function public.erp_recusar_por_perfil(
  p_organization_id text,
  p_antes jsonb,
  p_depois jsonb
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_tabelas_gestao text[] := array['planejamentoItens', 'naoConformidades', 'medicoes', 'documentos', 'lancamentosCusto', 'orcamentoItens', 'frentesServico'];
  v_tabelas_cadastro text[] := array['empresas', 'obras', 'equipamentos', 'funcionarios', 'motoristasOperacionais', 'comboios', 'canteiros', 'combustiveis', 'lubrificantes', 'etapas', 'materiaisCadastro'];
  v_marcas_antes jsonb;
  v_marcas_depois jsonb;
  v_ativas jsonb;
  v_tabela text;
  v_a jsonb;
  v_d jsonb;
  v_gestao text[] := '{}';
  v_cadastro text[] := '{}';
  v_marcas text;
begin
  -- 18/11/2026: apagar solicitação de compra ou lançamento de produção
  -- (tirar da lista ou marcar exclusão) só o dono do sistema, qualquer perfil.
  perform public.erp_recusar_apagar_so_dev(p_organization_id, p_antes, p_depois);

  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'operador' then
    return;
  end if;
  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.role = 'editor'
  ) then
    return;
  end if;
  if p_antes is null or jsonb_typeof(p_antes) <> 'object' or p_depois is null or jsonb_typeof(p_depois) <> 'object' then
    return;
  end if;

  v_marcas_antes := case when jsonb_typeof(p_antes -> 'exclusoes') = 'array' then p_antes -> 'exclusoes' else '[]'::jsonb end;
  v_marcas_depois := case when jsonb_typeof(p_depois -> 'exclusoes') = 'array' then p_depois -> 'exclusoes' else '[]'::jsonb end;

  -- Laço por tabela, e não uma consulta só: o retrato tem vários MB e milhares
  -- de marcas. Em produção, a versão em consulta única levava 13 s ou mais,
  -- segurando a fila de envios da organização. Tabela igual sai na hora.
  foreach v_tabela in array v_tabelas_gestao || v_tabelas_cadastro loop
    v_a := case when jsonb_typeof(p_antes -> v_tabela) = 'array' then p_antes -> v_tabela else '[]'::jsonb end;
    v_d := case when jsonb_typeof(p_depois -> v_tabela) = 'array' then p_depois -> v_tabela else '[]'::jsonb end;
    continue when v_a = v_d;

    -- Marca ativa antes: a mais recente do registro, como no app (exclusoesAtivas).
    if v_ativas is null then
      select coalesce(jsonb_object_agg(tabela || chr(31) || id, true), '{}'::jsonb) into v_ativas
      from (
        select distinct on (marca ->> 'tabela', marca ->> 'registroId')
          marca ->> 'tabela' as tabela, marca ->> 'registroId' as id, marca -> 'restauradoEm' as restaurado
        from jsonb_array_elements(v_marcas_antes) marca
        where marca ->> 'tabela' is not null and marca ->> 'registroId' is not null
        order by marca ->> 'tabela', marca ->> 'registroId', marca ->> 'excluidoEm' collate "C" desc nulls last
      ) ultima
      where not coalesce(jsonb_typeof(restaurado) = 'string' and restaurado #>> '{}' <> '', false);
    end if;

    if v_tabela = any(v_tabelas_gestao) then
      -- Gestão: compara como multiconjunto (registro e quantas vezes aparece).
      -- Registro com marca ativa antes pode só sair; incluir ou alterar é recusado.
      if exists (
        select 1 from (
          select item, count(*) filter (where no_antes) as antes, count(*) filter (where not no_antes) as depois
          from (
            select item, true as no_antes from jsonb_array_elements(v_a) item
            union all
            select item, false from jsonb_array_elements(v_d) item
          ) itens
          group by item
        ) contagem
        where antes <> depois
          and not (depois < antes and v_ativas ? (v_tabela || chr(31) || coalesce(item ->> 'id', '')))
      ) then
        v_gestao := v_gestao || v_tabela;
      end if;
    elsif exists (
      -- Cadastro: registro que estava na lista e saiu.
      select 1 from (
        select item ->> 'id' as id from jsonb_array_elements(v_a) item where coalesce(item ->> 'id', '') <> ''
        except
        select item ->> 'id' from jsonb_array_elements(v_d) item
      ) saiu
      where not v_ativas ? (v_tabela || chr(31) || id)
    ) then
      v_cadastro := v_cadastro || v_tabela;
    end if;
  end loop;

  -- Marca de exclusão dessas tabelas: o app do operador manda só as que vieram
  -- da nuvem (src/cloud/tabelasPorPerfil.ts). Qualquer marca que não esteja
  -- idêntica no retrato anterior (nova, reativada ou mexida) é recusada. O
  -- except compara o jsonb inteiro: contenção (@>) aceitaria marca sem um campo.
  if v_marcas_antes <> v_marcas_depois then
    select string_agg(distinct novas.marca ->> 'tabela', ', ' order by novas.marca ->> 'tabela') into v_marcas
    from (
      select marca from jsonb_array_elements(v_marcas_depois) as depois(marca)
      except
      select marca from jsonb_array_elements(v_marcas_antes) as antes(marca)
    ) novas
    where novas.marca ->> 'tabela' = any(v_tabelas_gestao || v_tabelas_cadastro);
  end if;

  if cardinality(v_gestao) > 0 or cardinality(v_cadastro) > 0 or v_marcas is not null then
    raise exception 'ROLE_WRITE_DENIED'
      using detail = concat_ws('; ',
        case when cardinality(v_gestao) > 0 then 'gestão alterada: ' || array_to_string(v_gestao, ', ') end,
        case when cardinality(v_cadastro) > 0 then 'cadastro excluído: ' || array_to_string(v_cadastro, ', ') end,
        case when v_marcas is not null then 'exclusão marcada: ' || v_marcas end);
  end if;
end;
$$;

revoke all on function public.erp_recusar_por_perfil(text, jsonb, jsonb) from public, anon;

-- 2) RH ----------------------------------------------------------------------
-- Assinatura e histórico continuam sem mudar e sem sumir; a única exceção é o
-- apagar do dono, que liga a chave erp.apagar_pedido só dentro da própria
-- transação. O navegador não chega nestas tabelas (só a API).
create or replace function public.erp_hiring_audit_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('erp.apagar_pedido', true) = 'sim' then
    return old;
  end if;
  raise exception 'A auditoria da contratação não pode ser alterada.' using errcode = 'P0003';
end;
$$;

create or replace function public.erp_hiring_delete_request(
  p_organization_id text,
  p_actor jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := nullif(p_actor->>'user_id', '')::uuid;
  v_pedido public.erp_hiring_requests%rowtype;
begin
  if v_actor is null or not public.erp_is_dev(p_organization_id, v_actor) then
    raise exception 'Só o dono do sistema apaga solicitações.' using errcode = 'P0003';
  end if;
  select * into v_pedido from public.erp_hiring_requests
    where organization_id = p_organization_id and id = p_request_id
    for update;
  if not found then
    raise exception 'Este pedido já não existe.' using errcode = 'P0002';
  end if;

  perform set_config('erp.apagar_pedido', 'sim', true);
  delete from public.erp_hiring_signatures where request_id = p_request_id;
  delete from public.erp_hiring_audit where request_id = p_request_id;
  delete from public.erp_hiring_requests where id = p_request_id;
  perform set_config('erp.apagar_pedido', '', true);

  -- O que foi apagado fica dito no histórico geral (sem o pedido, que sumiu).
  insert into public.erp_hiring_audit (organization_id, request_id, actor_user_id, actor_name, action, from_status, to_status, details)
  values (p_organization_id, null, v_actor, coalesce(nullif(p_actor->>'name', ''), 'Dono do sistema'), 'apagado', v_pedido.status, null,
    jsonb_build_object(
      'request_number', v_pedido.request_number,
      'tipo', coalesce(v_pedido.form->>'solicitacao', 'contratacao'),
      'pessoa', coalesce(v_pedido.form->>'candidato', '')
    ));

  return jsonb_build_object('request_number', v_pedido.request_number);
end;
$$;

revoke all on function public.erp_hiring_delete_request(text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.erp_hiring_delete_request(text, jsonb, uuid) to service_role;

commit;

-- Voltar atrás: rode de novo erp_recusar_por_perfil de
-- 202611040003_publicacao_por_perfil.sql e erp_hiring_audit_append_only de
-- 202611140001_solicitacao_contratacao.sql; depois
-- drop function public.erp_hiring_delete_request(text, jsonb, uuid);
-- drop function public.erp_recusar_apagar_so_dev(text, jsonb, jsonb);

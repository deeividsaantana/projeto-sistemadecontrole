-- Autorização por perfil no banco (auditoria de 04/11/2026, achado 005).
--
-- O operador entra no banco como "editor" (app_metadata.role = 'operador') e
-- publica o retrato inteiro da organização. Até aqui só o app escondia o que ele
-- não pode mexer (src/utils/permissoes.ts): módulos de gestão e exclusão de
-- cadastro. Agora o banco recusa, com ROLE_WRITE_DENIED, e não grava nada.
--
-- Vale só para editor com perfil operador; gestor (editor sem esse perfil) e
-- admin seguem como antes. Para o operador:
-- - gestão: nenhum registro novo, alterado, duplicado ou removido;
-- - cadastro: pode atualizar (importação do SGE, ajustes da presença), não pode
--   tirar registro da lista;
-- - marca de exclusão nova, em gestão ou cadastro, não entra.
-- Tabela que falta ou não é lista no envio conta como vazia (o envio inteiro
-- troca o retrato). Registro que já tinha marca de exclusão ativa antes (a mais
-- recente do registro, sem restauradoEm preenchido) pode sair: a saída já estava
-- decidida. O app do operador não envia as
-- tabelas de gestão e fica com a versão da nuvem (src/cloud/tabelasPorPerfil.ts),
-- para uma diferença que ele não causou não travar os envios dele.

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
  v_gestao text;
  v_cadastro text;
  v_marcas text;
begin
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

  -- Gestão: compara como multiconjunto (registro e quantas vezes aparece).
  with marcadas_antes as (
    select tabela, id from (
      select distinct on (marca ->> 'tabela', marca ->> 'registroId')
        marca ->> 'tabela' as tabela, marca ->> 'registroId' as id, marca -> 'restauradoEm' as restaurado
      from jsonb_array_elements(case when jsonb_typeof(p_antes -> 'exclusoes') = 'array' then p_antes -> 'exclusoes' else '[]'::jsonb end) marca
      order by marca ->> 'tabela', marca ->> 'registroId', marca ->> 'excluidoEm' collate "C" desc nulls last
    ) ultima
    where not coalesce(jsonb_typeof(restaurado) = 'string' and restaurado #>> '{}' <> '', false)
  ),
  tabelas as (
    select tabela,
      case when jsonb_typeof(p_antes -> tabela) = 'array' then p_antes -> tabela else '[]'::jsonb end as antes,
      case when jsonb_typeof(p_depois -> tabela) = 'array' then p_depois -> tabela else '[]'::jsonb end as depois
    from unnest(v_tabelas_gestao) tabela
  ),
  diferentes as (
    select tabela, antes, depois from tabelas where antes is distinct from depois
  ),
  itens as (
    select d.tabela, true as no_antes, item from diferentes d, jsonb_array_elements(d.antes) item
    union all
    select d.tabela, false, item from diferentes d, jsonb_array_elements(d.depois) item
  ),
  contagem as (
    select i.tabela, i.item, count(*) filter (where i.no_antes) as antes, count(*) filter (where not i.no_antes) as depois,
      bool_or(m.id is not null) as marcado
    from itens i
    left join marcadas_antes m on m.tabela = i.tabela and m.id = i.item ->> 'id'
    group by i.tabela, i.item
  )
  select string_agg(distinct tabela, ', ' order by tabela) into v_gestao
  from contagem
  -- Registro com marca ativa antes pode só sair; incluir ou alterar continua recusado.
  where antes <> depois and not (marcado and depois < antes);

  -- Cadastro: registro que estava na lista e saiu.
  with marcadas_antes as (
    select tabela, id from (
      select distinct on (marca ->> 'tabela', marca ->> 'registroId')
        marca ->> 'tabela' as tabela, marca ->> 'registroId' as id, marca -> 'restauradoEm' as restaurado
      from jsonb_array_elements(case when jsonb_typeof(p_antes -> 'exclusoes') = 'array' then p_antes -> 'exclusoes' else '[]'::jsonb end) marca
      order by marca ->> 'tabela', marca ->> 'registroId', marca ->> 'excluidoEm' collate "C" desc nulls last
    ) ultima
    where not coalesce(jsonb_typeof(restaurado) = 'string' and restaurado #>> '{}' <> '', false)
  ),
  tabelas as (
    select tabela,
      case when jsonb_typeof(p_antes -> tabela) = 'array' then p_antes -> tabela else '[]'::jsonb end as antes,
      case when jsonb_typeof(p_depois -> tabela) = 'array' then p_depois -> tabela else '[]'::jsonb end as depois
    from unnest(v_tabelas_cadastro) tabela
  ),
  diferentes as (
    select tabela, antes, depois from tabelas where antes is distinct from depois
  ),
  ids_antes as (
    select d.tabela, item ->> 'id' as id
    from diferentes d, jsonb_array_elements(d.antes) item
    where coalesce(item ->> 'id', '') <> ''
  ),
  ids_depois as (
    select distinct d.tabela, item ->> 'id' as id
    from diferentes d, jsonb_array_elements(d.depois) item
    where coalesce(item ->> 'id', '') <> ''
  )
  select string_agg(distinct a.tabela, ', ' order by a.tabela) into v_cadastro
  from ids_antes a
  left join ids_depois n on n.tabela = a.tabela and n.id = a.id
  left join marcadas_antes m on m.tabela = a.tabela and m.id = a.id
  where n.id is null and m.id is null;

  -- Marca de exclusão dessas tabelas: o app do operador manda só as que vieram
  -- da nuvem (src/cloud/tabelasPorPerfil.ts). Qualquer marca que não esteja
  -- idêntica no retrato anterior (nova, reativada ou mexida) é recusada.
  select string_agg(distinct marca ->> 'tabela', ', ' order by marca ->> 'tabela') into v_marcas
  from jsonb_array_elements(case when jsonb_typeof(p_depois -> 'exclusoes') = 'array' then p_depois -> 'exclusoes' else '[]'::jsonb end) marca
  where marca ->> 'tabela' = any(v_tabelas_gestao || v_tabelas_cadastro)
    -- Igualdade exata: contenção (@>) aceitaria a marca sem um campo, como restauradoEm.
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_antes -> 'exclusoes') = 'array' then p_antes -> 'exclusoes' else '[]'::jsonb end) anterior
      where anterior = marca
    );

  if v_gestao is not null or v_cadastro is not null or v_marcas is not null then
    raise exception 'ROLE_WRITE_DENIED'
      using detail = concat_ws('; ',
        case when v_gestao is not null then 'gestão alterada: ' || v_gestao end,
        case when v_cadastro is not null then 'cadastro excluído: ' || v_cadastro end,
        case when v_marcas is not null then 'exclusão marcada: ' || v_marcas end);
  end if;
end;
$$;

revoke all on function public.erp_recusar_por_perfil(text, jsonb, jsonb) from public, anon;

-- Envio inteiro: o mesmo de 14/09/2026, com a trava antes de gravar.
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
  v_current_payload jsonb;
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

  select snapshot.updated_at, snapshot.payload
    into v_current_updated_at, v_current_payload
    from public.erp_snapshots snapshot
    where snapshot.organization_id = p_organization_id
    for update;

  if v_current_updated_at is not null
     and (p_known_updated_at is null or v_current_updated_at <> p_known_updated_at) then
    raise exception 'CLOUD_VERSION_CONFLICT';
  end if;

  perform public.erp_recusar_encolhimento(v_current_payload, p_payload);
  perform public.erp_recusar_por_perfil(p_organization_id, v_current_payload, p_payload);

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

revoke all on function public.publish_erp_snapshot(text, timestamptz, jsonb) from public, anon;
grant execute on function public.publish_erp_snapshot(text, timestamptz, jsonb) to authenticated;

-- Envio por mudança: o mesmo de 16/10/2026, com a trava nas tabelas que
-- tiveram saída, antes de gravar.
create or replace function public.apply_erp_snapshot_changes(
  p_organization_id text,
  p_changes jsonb
)
returns table (published_at timestamptz, snapshot_version uuid, total_records integer, previous_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_original jsonb;
  v_previous timestamptz;
  v_tabela text;
  v_mudanca jsonb;
  v_upsert jsonb;
  v_saidas text[];
  v_com_saida text[] := array[]::text[];
  v_lista jsonb;
  v_record_count integer;
  v_version uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
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

  if jsonb_typeof(p_changes) <> 'object' then
    raise exception 'INVALID_SNAPSHOT_CHANGES';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id, 0));

  select snapshot.payload, snapshot.updated_at
    into v_payload, v_previous
    from public.erp_snapshots snapshot
    where snapshot.organization_id = p_organization_id
    for update;

  if v_payload is null then
    raise exception 'CLOUD_SNAPSHOT_MISSING';
  end if;
  v_original := v_payload;

  -- As marcas de exclusão entram primeiro: valem para os outros registros
  -- desta mesma chamada.
  for v_tabela, v_mudanca in
    select entry.key, entry.value from jsonb_each(p_changes) entry
    order by (entry.key = 'exclusoes') desc, entry.key
  loop
    v_upsert := case when jsonb_typeof(v_mudanca->'upsert') = 'array' then v_mudanca->'upsert' else '[]'::jsonb end;
    v_saidas := case
      when v_tabela in ('exclusoes', 'historyLogs', 'presencasLink') then array[]::text[]
      when jsonb_typeof(v_mudanca->'delete') = 'array' then array(select jsonb_array_elements_text(v_mudanca->'delete'))
      else array[]::text[]
    end;
    if cardinality(v_saidas) > 0 then
      v_com_saida := v_com_saida || v_tabela;
    end if;

    with marcas as (
      select distinct on (marca->>'tabela', marca->>'registroId')
        marca->>'tabela' as tabela, marca->>'registroId' as registro_id, marca->>'restauradoEm' as restaurado
      from jsonb_array_elements(coalesce(v_payload->'exclusoes', '[]'::jsonb)) marca
      order by marca->>'tabela', marca->>'registroId', marca->>'excluidoEm' desc
    ),
    ativas as (
      select registro_id from marcas where tabela = v_tabela and restaurado is null
    ),
    existentes as (
      select item, ordem
      from jsonb_array_elements(case when jsonb_typeof(v_payload->v_tabela) = 'array' then v_payload->v_tabela else '[]'::jsonb end)
        with ordinality as linha(item, ordem)
    ),
    chegando as (
      select item
      from jsonb_array_elements(v_upsert) item
      where jsonb_typeof(item) = 'object'
        and coalesce(item->>'id', '') <> ''
        and (v_tabela = 'exclusoes' or not exists (select 1 from ativas where ativas.registro_id = item->>'id'))
    ),
    mantidos as (
      select
        case
          when novo.item is not null
            and not coalesce(public.erp_registro_momento(atual.item) > public.erp_registro_momento(novo.item), false)
          then novo.item
          else atual.item
        end as item,
        atual.ordem
      from existentes atual
      left join chegando novo on novo.item->>'id' = atual.item->>'id'
      where not coalesce(atual.item->>'id' = any(v_saidas), false)
        and (v_tabela = 'exclusoes' or not exists (select 1 from ativas where ativas.registro_id = atual.item->>'id'))
    ),
    novos as (
      select chegando.item
      from chegando
      where not exists (select 1 from existentes where existentes.item->>'id' = chegando.item->>'id')
    )
    select coalesce(jsonb_agg(resultado.item order by resultado.grupo, resultado.ordem), '[]'::jsonb)
      into v_lista
      from (
        select item, 0 as grupo, 0::bigint as ordem from novos
        union all
        select item, 1, ordem from mantidos
      ) resultado;

    v_payload := jsonb_set(v_payload, array[v_tabela], v_lista, true);
  end loop;

  -- Saída pelo id sem marca, em quantidade, não entra (A14). O que sai por
  -- marca de exclusão continua passando.
  if cardinality(v_com_saida) > 0 then
    perform public.erp_recusar_encolhimento(v_original, v_payload, v_com_saida);
  end if;

  perform public.erp_recusar_por_perfil(p_organization_id, v_original, v_payload);

  select coalesce(sum(jsonb_array_length(entry.value)), 0)::integer
    into v_record_count
    from jsonb_each(v_payload) entry
    where jsonb_typeof(entry.value) = 'array';

  update public.erp_snapshots set
    version = v_version,
    updated_at = v_now,
    updated_by = auth.uid(),
    record_count = v_record_count,
    payload = v_payload
  where organization_id = p_organization_id;

  return query select v_now, v_version, v_record_count, v_previous;
end;
$$;

revoke all on function public.apply_erp_snapshot_changes(text, jsonb) from public, anon;
grant execute on function public.apply_erp_snapshot_changes(text, jsonb) to authenticated;

-- create or replace refaz a configuração das funções: devolve a espera da fila
-- de envio (202610280001).
alter function public.apply_erp_snapshot_changes(text, jsonb) set lock_timeout = '25s';
alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set lock_timeout = '25s';

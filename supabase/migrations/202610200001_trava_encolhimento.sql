-- Trava no banco contra retrato encolhido (A12 a A14, auditoria de 16/10/2026).
--
-- O app já segura o envio que apagaria registros sem marca de exclusão
-- (src/cloud/protecaoEncolhimento.ts e src/cloud/mudancasNuvem.ts). Esta é a
-- última linha: um aparelho com versão antiga do app em cache, ou qualquer
-- chamada direta, não consegue mais publicar uma tabela vazia ou muito menor
-- por cima da nuvem. Foi assim que em 15/10/2026 sumiram abastecimentos,
-- materiais e 185 equipamentos.
--
-- Um registro "sumiu sem explicação" quando estava na nuvem, não está no que
-- chega, não tem marca de exclusão ativa (na nuvem ou no que chega) e não foi
-- para um período arquivado. A tabela é recusada quando:
-- - ficaria vazia e algum registro sumiu sem explicação; ou
-- - sumiram sem explicação 20 ou mais registros, 20% ou mais da tabela, e a
--   tabela de fato diminuiu nessa mesma quantidade (o mesmo abastecimento com
--   outro id não conta como perda).
-- As marcas de exclusão nunca diminuem. Histórico, presença do link, avisos e
-- fila de revisão ficam de fora, como no app.
--
-- Recusa com CLOUD_SHRINK_REFUSED e não grava nada: a nuvem fica como estava.

create or replace function public.erp_tabelas_encolhidas(
  p_antes jsonb,
  p_depois jsonb,
  p_tabelas text[] default null
)
returns table (tabela text, antes integer, depois integer, sumidos integer)
language sql
stable
set search_path = public
as $$
  with marcas as (
    select distinct on (marca->>'tabela', marca->>'registroId')
      marca->>'tabela' as tabela, marca->>'registroId' as registro_id, marca->>'restauradoEm' as restaurado
    from jsonb_array_elements(
      (case when jsonb_typeof(p_depois->'exclusoes') = 'array' then p_depois->'exclusoes' else '[]'::jsonb end)
      || (case when jsonb_typeof(p_antes->'exclusoes') = 'array' then p_antes->'exclusoes' else '[]'::jsonb end)
    ) marca
    order by marca->>'tabela', marca->>'registroId', marca->>'excluidoEm' desc
  ),
  ativas as (
    select tabela, registro_id from marcas where restaurado is null
  ),
  dados_arquivados as (
    select dado.key, dado.value
    from jsonb_array_elements(case when jsonb_typeof(p_depois->'periodosArquivados') = 'array' then p_depois->'periodosArquivados' else '[]'::jsonb end) periodo,
      jsonb_each(case when jsonb_typeof(periodo->'dados') = 'object' then periodo->'dados' else '{}'::jsonb end) dado
  ),
  arquivados as (
    select arquivo.tabela, item->>'id' as id
    from (
      select key as tabela, value as itens from dados_arquivados where key <> 'estacas'
      union all
      select 'estacaLotes', value->'lotes' from dados_arquivados where key = 'estacas'
      union all
      select 'estacaCravacoes', value->'cravacoes' from dados_arquivados where key = 'estacas'
    ) arquivo,
      jsonb_array_elements(case when jsonb_typeof(arquivo.itens) = 'array' then arquivo.itens else '[]'::jsonb end) item
  ),
  tabelas as (
    select entry.key as tabela, entry.value as itens_antes,
      case when jsonb_typeof(p_depois->entry.key) = 'array' then p_depois->entry.key else '[]'::jsonb end as itens_depois
    from jsonb_each(p_antes) entry
    where jsonb_typeof(entry.value) = 'array'
      and jsonb_array_length(entry.value) > 0
      and entry.key not in ('historyLogs', 'notifications', 'presencasLink', 'masterDataReviewQueue')
      and (p_tabelas is null or entry.key = any(p_tabelas))
      -- Valor que não é lista do lado de quem publica não é comparado, como no app.
      and (p_depois->entry.key is null or jsonb_typeof(p_depois->entry.key) = 'array')
  ),
  ids_antes as (
    select t.tabela, velho->>'id' as id
    from tabelas t, jsonb_array_elements(t.itens_antes) velho
    where coalesce(velho->>'id', '') <> ''
  ),
  ids_depois as (
    select distinct t.tabela, novo->>'id' as id
    from tabelas t, jsonb_array_elements(t.itens_depois) novo
    where coalesce(novo->>'id', '') <> ''
  ),
  sumidos as (
    select velho.tabela, count(*)::integer as total
    from ids_antes velho
    left join ids_depois novo on novo.tabela = velho.tabela and novo.id = velho.id
    left join ativas on velho.tabela <> 'exclusoes' and ativas.tabela = velho.tabela and ativas.registro_id = velho.id
    left join (select distinct tabela, id from arquivados) arquivo
      on velho.tabela <> 'exclusoes' and arquivo.tabela = velho.tabela and arquivo.id = velho.id
    where novo.id is null and ativas.registro_id is null and arquivo.id is null
    group by velho.tabela
  ),
  contagem as (
    select t.tabela,
      jsonb_array_length(t.itens_antes) as antes,
      jsonb_array_length(t.itens_depois) as depois,
      coalesce(s.total, 0) as sumidos
    from tabelas t
    left join sumidos s on s.tabela = t.tabela
  )
  select tabela, antes, depois, sumidos
  from contagem
  where sumidos > 0
    and (
      tabela = 'exclusoes'
      or depois = 0
      or (least(sumidos, antes - depois) >= 20 and least(sumidos, antes - depois) >= antes * 0.2)
    );
$$;

revoke all on function public.erp_tabelas_encolhidas(jsonb, jsonb, text[]) from public, anon;

create or replace function public.erp_recusar_encolhimento(
  p_antes jsonb,
  p_depois jsonb,
  p_tabelas text[] default null
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_detalhe text;
begin
  if p_antes is null or jsonb_typeof(p_antes) <> 'object' then
    return;
  end if;
  select string_agg(format('%s: %s de %s sem marca de exclusão', tabela, sumidos, antes), '; ' order by tabela)
    into v_detalhe
    from public.erp_tabelas_encolhidas(p_antes, p_depois, p_tabelas);
  if v_detalhe is not null then
    raise exception 'CLOUD_SHRINK_REFUSED' using detail = v_detalhe;
  end if;
end;
$$;

revoke all on function public.erp_recusar_encolhimento(jsonb, jsonb, text[]) from public, anon;

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

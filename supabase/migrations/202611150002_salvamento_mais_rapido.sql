-- Salvamento mais rápido, com as mesmas regras (15/11/2026).
--
-- Medido em produção de 13 a 15/11/2026 (pg_stat_statements): cada salvamento
-- de lançamento levava 3,2 s em média no banco, com pico de 13,8 s. Num banco
-- de teste com um bloco do mesmo tamanho (15 MB, 22 mil registros e 6.601
-- marcas de exclusão) o mesmo salvamento leva 190 a 400 ms; o servidor de
-- produção é cerca de 10 vezes mais lento.
--
-- Para cada tabela que mudou, a função fazia três coisas pesadas que só
-- precisam ser feitas uma vez por salvamento:
-- 1. lia e ordenava as 6.601 marcas de exclusão de novo, tabela por tabela;
-- 2. regravava o bloco inteiro de 15 MB (jsonb_set) a cada tabela;
-- 3. no fim, contava os registros de todas as tabelas do bloco.
-- Um lançamento comum mexe em 2 ou 3 tabelas (o registro e o histórico).
--
-- Agora as marcas ativas são lidas uma vez (depois de aplicar as marcas que
-- chegaram), as tabelas novas entram no bloco de uma vez só, e a contagem soma
-- só a diferença das tabelas que mudaram.
--
-- As regras não mudam: marca de exclusão nunca sai; histórico e presença do
-- link só ganham linhas; registro com marca ativa não volta; entre duas
-- versões do mesmo registro fica a mais nova; as travas de encolhimento e de
-- perfil continuam antes de gravar. tests/salvamentoMaisRapido.sql confere o
-- resultado lado a lado com a função antiga.
--
-- Voltar atrás: rodar de novo a função de 202611040003_publicacao_por_perfil.sql
-- e os alter function de 202611110001_salvamento_leve_sem_fila.sql.

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
  v_contagem integer;
  v_tabela text;
  v_mudanca jsonb;
  v_upsert jsonb;
  v_saidas text[];
  v_com_saida text[] := array[]::text[];
  v_lista jsonb;
  v_atual jsonb;
  v_novas jsonb := '{}'::jsonb;
  v_ativas jsonb;
  v_so_novos boolean;
  v_diferenca integer := 0;
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

  select snapshot.payload, snapshot.updated_at, snapshot.record_count
    into v_payload, v_previous, v_contagem
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

    -- Marcas ativas, uma vez só, já com as marcas que chegaram nesta chamada.
    if v_tabela <> 'exclusoes' and v_ativas is null then
      select coalesce(jsonb_object_agg(marcas.tabela || chr(31) || marcas.registro_id, true), '{}'::jsonb)
        into v_ativas
        from (
          select distinct on (marca->>'tabela', marca->>'registroId')
            marca->>'tabela' as tabela, marca->>'registroId' as registro_id, marca->>'restauradoEm' as restaurado
          from jsonb_array_elements(coalesce(v_novas->'exclusoes', v_payload->'exclusoes', '[]'::jsonb)) marca
          order by marca->>'tabela', marca->>'registroId', marca->>'excluidoEm' desc
        ) marcas
        where marcas.restaurado is null
          and marcas.tabela is not null
          and marcas.registro_id is not null;
    end if;

    v_atual := case when jsonb_typeof(v_payload->v_tabela) = 'array' then v_payload->v_tabela else '[]'::jsonb end;

    -- Caminho curto, o do lançamento comum: só registros novos, nenhuma
    -- saída. Os novos vão na frente da lista, como no caminho completo, sem
    -- desmontar e remontar a tabela inteira.
    if cardinality(v_saidas) = 0 then
      select coalesce(jsonb_agg(item order by ordem), '[]'::jsonb),
             coalesce(bool_and(not (v_atual @> jsonb_build_array(jsonb_build_object('id', item->>'id')))), true)
        into v_lista, v_so_novos
        from jsonb_array_elements(v_upsert) with ordinality as linha(item, ordem)
        where jsonb_typeof(item) = 'object'
          and coalesce(item->>'id', '') <> ''
          and (v_tabela = 'exclusoes' or not (v_ativas ? (v_tabela || chr(31) || (item->>'id'))));
      if v_so_novos then
        v_lista := v_lista || v_atual;
        v_diferenca := v_diferenca + jsonb_array_length(v_lista) - jsonb_array_length(v_atual);
        v_novas := v_novas || jsonb_build_object(v_tabela, v_lista);
        continue;
      end if;
    end if;

    with existentes as (
      select item, ordem
      from jsonb_array_elements(v_atual) with ordinality as linha(item, ordem)
    ),
    chegando as (
      select item
      from jsonb_array_elements(v_upsert) item
      where jsonb_typeof(item) = 'object'
        and coalesce(item->>'id', '') <> ''
        and (v_tabela = 'exclusoes' or not (v_ativas ? (v_tabela || chr(31) || (item->>'id'))))
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
        and (v_tabela = 'exclusoes' or atual.item->>'id' is null
          or not (v_ativas ? (v_tabela || chr(31) || (atual.item->>'id'))))
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

    v_diferenca := v_diferenca + jsonb_array_length(v_lista) - jsonb_array_length(v_atual);
    v_novas := v_novas || jsonb_build_object(v_tabela, v_lista);
  end loop;

  -- O bloco de 15 MB é refeito uma vez só, com todas as tabelas novas.
  v_payload := v_payload || v_novas;

  -- Saída pelo id sem marca, em quantidade, não entra (A14). O que sai por
  -- marca de exclusão continua passando.
  if cardinality(v_com_saida) > 0 then
    perform public.erp_recusar_encolhimento(v_original, v_payload, v_com_saida);
  end if;

  perform public.erp_recusar_por_perfil(p_organization_id, v_original, v_payload);

  -- Contagem pela diferença; só conta tudo se a contagem guardada faltar.
  if v_contagem is null then
    select coalesce(sum(jsonb_array_length(entry.value)), 0)::integer
      into v_record_count
      from jsonb_each(v_payload) entry
      where jsonb_typeof(entry.value) = 'array';
  else
    v_record_count := v_contagem + v_diferenca;
  end if;

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

-- create or replace refaz a configuração da função: repete a fila curta e a
-- memória das ordenações (202611110001).
alter function public.apply_erp_snapshot_changes(text, jsonb) set lock_timeout = '5s';
alter function public.apply_erp_snapshot_changes(text, jsonb) set work_mem = '32MB';

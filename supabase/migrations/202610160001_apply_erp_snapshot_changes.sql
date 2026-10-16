-- Envio só do que mudou.
--
-- Até 16/10/2026 cada salvamento do app baixava o retrato inteiro
-- (erp_snapshots, 14,7 MB de JSON) e publicava o retrato inteiro de volta.
-- Esta função recebe só os registros novos ou alterados e os ids que saíram,
-- e aplica no retrato dentro do banco.
--
-- Regras, as mesmas do envio inteiro:
-- - marca de exclusão nunca sai; histórico e presença do link só ganham linhas;
-- - registro com marca de exclusão ativa não volta, venha de onde vier;
-- - entre duas versões do mesmo registro com data (atualizadoEm/updatedAt),
--   a mais nova fica; sem data comparável, fica a que chegou.
--
-- A função não recusa por versão: as mudanças valem registro por registro.
-- Ela devolve a versão que estava na nuvem antes (previous_updated_at); se não
-- for a que o aparelho conhecia, o app baixa a nuvem em seguida. O gatilho de
-- erp_snapshot_history continua guardando a versão anterior a cada troca.

create or replace function public.erp_registro_momento(p_registro jsonb)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  v_texto text := coalesce(nullif(p_registro->>'atualizadoEm', ''), nullif(p_registro->>'updatedAt', ''));
begin
  if v_texto is null then
    return null;
  end if;
  return v_texto::timestamptz;
exception when others then
  return null;
end;
$$;

revoke all on function public.erp_registro_momento(jsonb) from public, anon;

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
  v_previous timestamptz;
  v_tabela text;
  v_mudanca jsonb;
  v_upsert jsonb;
  v_saidas text[];
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

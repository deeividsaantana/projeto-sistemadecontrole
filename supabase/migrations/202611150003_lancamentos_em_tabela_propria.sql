-- Lançamentos fora do bloco, um registro por linha (15/11/2026).
--
-- Cada lançamento regravava o bloco inteiro da obra (erp_snapshots.payload,
-- 15 MB). Quatro coleções somam 11 MB desse bloco e são o que mais se lança:
-- abastecimentos (6.234 registros, 5,7 MB), controleEquipamentosDiario (1.777,
-- 2,3 MB), presencasLink (3.380, 2 MB) e historyLogs (2.941, 1,3 MB; todo
-- lançamento ganha uma linha aqui). Elas passam para public.erp_registros, uma
-- linha por registro: lançar grava as linhas novas, sem tocar no bloco.
--
-- O app não muda o jeito de enviar: apply_erp_snapshot_changes e
-- publish_erp_snapshot recebem o mesmo formato e mandam a coleção para a
-- tabela. Para baixar, o app chama ler_erp_snapshot, que devolve o bloco com
-- os abastecimentos de volta, na mesma ordem. Enquanto o app novo não chega,
-- o app antigo baixa o bloco sem a coleção e mantém a cópia que já tem.
--
-- Regras iguais às do bloco: registro com marca de exclusão ativa não entra e
-- sai; entre duas versões fica a mais nova; saída em massa sem marca é
-- recusada (CLOUD_SHRINK_REFUSED). Cada versão trocada ou apagada fica em
-- erp_registros_historico por 45 dias.
--
-- Separação por organização: se o bloco tiver a chave "abastecimentos" (por
-- exemplo, uma lista com registro sem id), vale o bloco, como antes.
--
-- Backup antes de mover: backup_lancamentos_20261115 guarda as quatro
-- listas como estavam. Voltar atrás: ver o fim deste arquivo.

create table if not exists public.erp_registros (
  organization_id text not null references public.organizations(id) on delete cascade,
  colecao text not null,
  id text not null,
  registro jsonb not null,
  ordem bigint not null,
  criado_em timestamptz not null default clock_timestamp(),
  atualizado_em timestamptz not null default clock_timestamp(),
  atualizado_por uuid,
  primary key (organization_id, colecao, id),
  constraint erp_registros_registro_objeto check (jsonb_typeof(registro) = 'object'),
  constraint erp_registros_id_igual check (registro ->> 'id' = id)
);

create index if not exists erp_registros_ordem on public.erp_registros (organization_id, colecao, ordem);

-- Só as funções do banco (security definer) leem e gravam.
alter table public.erp_registros enable row level security;
revoke all on public.erp_registros from anon, authenticated;

create table if not exists public.erp_registros_historico (
  historico_id bigint generated always as identity primary key,
  organization_id text not null,
  colecao text not null,
  id text not null,
  registro jsonb not null,
  operacao text not null check (operacao in ('alterado', 'apagado')),
  trocado_em timestamptz not null default clock_timestamp(),
  trocado_por uuid
);

create index if not exists erp_registros_historico_registro on public.erp_registros_historico (organization_id, colecao, id, trocado_em desc);
create index if not exists erp_registros_historico_data on public.erp_registros_historico (trocado_em);

alter table public.erp_registros_historico enable row level security;
revoke all on public.erp_registros_historico from anon, authenticated;

create or replace function public.erp_guardar_registro_anterior()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.registro is not distinct from new.registro then
    return new;
  end if;
  insert into public.erp_registros_historico (organization_id, colecao, id, registro, operacao, trocado_por)
  values (old.organization_id, old.colecao, old.id, old.registro, case when tg_op = 'DELETE' then 'apagado' else 'alterado' end, auth.uid());
  -- Poda de vez em quando (cerca de 1 em 200 trocas): fica o que tem até 45 dias.
  if random() < 0.005 then
    delete from public.erp_registros_historico where trocado_em < clock_timestamp() - interval '45 days';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.erp_guardar_registro_anterior() from public, anon, authenticated;

drop trigger if exists erp_registros_guarda_anterior on public.erp_registros;
create trigger erp_registros_guarda_anterior
after update or delete on public.erp_registros
for each row execute function public.erp_guardar_registro_anterior();

-- Coleções que moram em erp_registros.
create or replace function public.erp_colecoes_separadas()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['abastecimentos', 'historyLogs', 'presencasLink', 'controleEquipamentosDiario']::text[];
$$;

-- Aproveita para fixar o search_path da irmã (aviso do Supabase).
alter function public.erp_colecoes_fora_do_bloco() set search_path = public;

-- Registros em erp_registros das coleções que não estão no bloco.
create or replace function public.erp_contar_separados(p_organization_id text, p_payload jsonb)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.erp_registros registro
  where registro.organization_id = p_organization_id
    and registro.colecao = any(public.erp_colecoes_separadas())
    and not coalesce(p_payload ? registro.colecao, false);
$$;

revoke all on function public.erp_contar_separados(text, jsonb) from public, anon, authenticated;

-- O bloco com as coleções separadas de volta, na ordem guardada.
create or replace function public.erp_montar_bloco(p_organization_id text, p_payload jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p_payload is null then null else p_payload || coalesce((
    select jsonb_object_agg(registro.colecao, registro.lista)
    from (
      select registro.colecao, jsonb_agg(registro.registro order by registro.ordem, registro.id) as lista
      from public.erp_registros registro
      where registro.organization_id = p_organization_id
        and registro.colecao = any(public.erp_colecoes_separadas())
        and not (p_payload ? registro.colecao)
      group by registro.colecao
    ) registro
  ), '{}'::jsonb) end;
$$;

revoke all on function public.erp_montar_bloco(text, jsonb) from public, anon, authenticated;

-- Leitura do app: o mesmo que o select em erp_snapshots, com a coleção montada.
create or replace function public.ler_erp_snapshot(p_organization_id text)
returns table (payload jsonb, updated_at timestamptz, record_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id and member.user_id = auth.uid()
  ) then
    return;
  end if;
  return query
    select public.erp_montar_bloco(snapshot.organization_id, snapshot.payload), snapshot.updated_at, snapshot.record_count
    from public.erp_snapshots snapshot
    where snapshot.organization_id = p_organization_id;
end;
$$;

revoke all on function public.ler_erp_snapshot(text) from public, anon;
grant execute on function public.ler_erp_snapshot(text) to authenticated;

-- Gatilho: coleção separada que chega inteira no bloco (envio inteiro, ou a
-- mudança deste arquivo) vai para a tabela e sai do bloco. A lista que chega
-- vale como está: o que não veio sai da tabela, como saía do bloco.
create or replace function public.erp_separar_colecoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colecao text;
  v_lista jsonb;
begin
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  foreach v_colecao in array public.erp_colecoes_separadas() loop
    continue when not (new.payload ? v_colecao);
    v_lista := new.payload -> v_colecao;

    -- Só separa lista de registros com id próprio e único; senão o bloco vale.
    if jsonb_typeof(v_lista) <> 'array' or exists (
      select 1 from jsonb_array_elements(v_lista) item
      where jsonb_typeof(item) <> 'object' or coalesce(item ->> 'id', '') = ''
    ) or (
      select count(distinct item ->> 'id') from jsonb_array_elements(v_lista) item
    ) <> jsonb_array_length(v_lista) then
      delete from public.erp_registros where organization_id = new.organization_id and colecao = v_colecao;
      continue;
    end if;

    delete from public.erp_registros registro
    using (
      select atual.id from public.erp_registros atual
      where atual.organization_id = new.organization_id and atual.colecao = v_colecao
      except
      select item ->> 'id' from jsonb_array_elements(v_lista) item
    ) saiu
    where registro.organization_id = new.organization_id
      and registro.colecao = v_colecao
      and registro.id = saiu.id;

    insert into public.erp_registros as atual (organization_id, colecao, id, registro, ordem, atualizado_por)
    select new.organization_id, v_colecao, linha.item ->> 'id', linha.item, linha.ordem, auth.uid()
    from jsonb_array_elements(v_lista) with ordinality as linha(item, ordem)
    on conflict (organization_id, colecao, id) do update set
      registro = excluded.registro,
      ordem = excluded.ordem,
      atualizado_em = case when atual.registro is distinct from excluded.registro then clock_timestamp() else atual.atualizado_em end,
      atualizado_por = case when atual.registro is distinct from excluded.registro then excluded.atualizado_por else atual.atualizado_por end
    where atual.registro is distinct from excluded.registro or atual.ordem is distinct from excluded.ordem;

    new.payload := new.payload - v_colecao;
  end loop;

  return new;
end;
$$;

revoke all on function public.erp_separar_colecoes() from public, anon, authenticated;

-- Depois de erp_snapshots_tira_colecoes_removidas (gatilhos rodam em ordem
-- alfabética), para a contagem dela ainda ver a coleção no bloco.
drop trigger if exists erp_snapshots_zz_separa_colecoes on public.erp_snapshots;
create trigger erp_snapshots_zz_separa_colecoes
before insert or update of payload on public.erp_snapshots
for each row execute function public.erp_separar_colecoes();

-- A contagem da limpeza de coleções removidas soma também a tabela.
create or replace function public.erp_tirar_colecoes_removidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fora text[] := public.erp_colecoes_fora_do_bloco();
  v_colecao text;
  v_marcas jsonb;
  v_marcas_antes jsonb;
begin
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  v_marcas := case when jsonb_typeof(new.payload -> 'exclusoes') = 'array' then new.payload -> 'exclusoes' end;
  v_marcas_antes := case when tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'exclusoes') = 'array'
    then old.payload -> 'exclusoes' end;

  -- Salvamento comum (nada das coleções removidas e marcas iguais) sai na hora.
  -- A limpeza inicial (fim deste arquivo) passa por tudo.
  if not (new.payload ?| v_fora)
     and (v_marcas is null or v_marcas is not distinct from v_marcas_antes)
     and coalesce(current_setting('erp.limpar_colecoes_removidas', true), '') <> 'on' then
    return new;
  end if;

  -- 1. Guarda as coleções que vieram no bloco e as tira dele.
  foreach v_colecao in array v_fora loop
    continue when not (new.payload ? v_colecao);
    if jsonb_typeof(new.payload -> v_colecao) = 'array' then
      insert into public.erp_colecoes_removidas as arquivo (organization_id, colecao, id, registro)
      select distinct on (item ->> 'id') new.organization_id, v_colecao, item ->> 'id', item
      from jsonb_array_elements(new.payload -> v_colecao) item
      where jsonb_typeof(item) = 'object' and coalesce(item ->> 'id', '') <> ''
      order by item ->> 'id', public.erp_registro_momento(item) desc nulls last
      on conflict (organization_id, colecao, id) do update set
        registro = excluded.registro,
        removido_em = excluded.removido_em
      where arquivo.registro is distinct from excluded.registro
        and coalesce(public.erp_registro_momento(excluded.registro) >= public.erp_registro_momento(arquivo.registro), true);
    end if;
    new.payload := new.payload - v_colecao;
  end loop;

  -- 2. Marcas de exclusão dessas coleções: guarda e tira do bloco.
  if v_marcas is not null and exists (
    select 1 from jsonb_array_elements(v_marcas) marca where marca ->> 'tabela' = any(v_fora)
  ) then
    insert into public.erp_colecoes_removidas as arquivo (organization_id, colecao, id, registro)
    select distinct on (marca ->> 'id') new.organization_id, 'exclusoes', marca ->> 'id', marca
    from jsonb_array_elements(v_marcas) marca
    where marca ->> 'tabela' = any(v_fora)
      and jsonb_typeof(marca) = 'object' and coalesce(marca ->> 'id', '') <> ''
    order by marca ->> 'id', public.erp_registro_momento(marca) desc nulls last
    on conflict (organization_id, colecao, id) do update set
      registro = excluded.registro,
      removido_em = excluded.removido_em
    where arquivo.registro is distinct from excluded.registro
      and coalesce(public.erp_registro_momento(excluded.registro) >= public.erp_registro_momento(arquivo.registro), true);

    new.payload := jsonb_set(new.payload, '{exclusoes}', coalesce((
      select jsonb_agg(marca order by ordem)
      from jsonb_array_elements(v_marcas) with ordinality as linha(marca, ordem)
      where not coalesce(marca ->> 'tabela' = any(v_fora), false)
    ), '[]'::jsonb));
  end if;

  -- A contagem segue o que ficou no bloco: sem isso o próximo salvamento
  -- pareceria encolher e copiaria o bloco inteiro no histórico.
  select coalesce(sum(jsonb_array_length(entry.value)), 0)::integer
      + public.erp_contar_separados(new.organization_id, new.payload)
    into new.record_count
    from jsonb_each(new.payload) entry
    where jsonb_typeof(entry.value) = 'array';

  return new;
end;
$$;

-- Envio inteiro: compara com o bloco montado (com os abastecimentos); o
-- gatilho manda a coleção para a tabela ao gravar.
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

  select snapshot.updated_at, public.erp_montar_bloco(snapshot.organization_id, snapshot.payload)
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
alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set lock_timeout = '5s';
alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set work_mem = '32MB';

-- Envio por mudança: o de 202611150002, com a coleção separada gravada por linha.
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
  v_separadas text[] := public.erp_colecoes_separadas();
  v_antes integer;
  v_depois integer;
  v_sumidos integer;
  v_inseridos integer;
  v_menor bigint;
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
    if cardinality(v_saidas) > 0 and not (v_tabela = any(v_separadas) and not (v_payload ? v_tabela)) then
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

    -- Coleção que mora em erp_registros: grava só as linhas que mudaram.
    -- Mesmas regras do bloco, registro por registro.
    if v_tabela = any(v_separadas) and not (v_payload ? v_tabela) then
      select count(*) into v_antes
        from public.erp_registros where organization_id = p_organization_id and colecao = v_tabela;

      -- Registro com marca de exclusão ativa sai.
      delete from public.erp_registros registro
        where registro.organization_id = p_organization_id and registro.colecao = v_tabela
          and v_ativas ? (v_tabela || chr(31) || registro.id);

      -- Saída pelo id; conta as que não têm marca nem estão arquivadas (A14).
      with sairam as (
        delete from public.erp_registros registro
          where registro.organization_id = p_organization_id and registro.colecao = v_tabela
            and registro.id = any(v_saidas)
          returning registro.id
      ),
      arquivados as (
        select item->>'id' as id
        from jsonb_array_elements(case when jsonb_typeof(v_payload->'periodosArquivados') = 'array' then v_payload->'periodosArquivados' else '[]'::jsonb end) periodo,
          jsonb_array_elements(case when jsonb_typeof(periodo->'dados'->v_tabela) = 'array' then periodo->'dados'->v_tabela else '[]'::jsonb end) item
      )
      select count(*) into v_sumidos
        from sairam where not exists (select 1 from arquivados where arquivados.id = sairam.id);

      -- Novos entram na frente, na ordem em que chegaram; o mais novo vence.
      select coalesce(min(ordem), 1) into v_menor
        from public.erp_registros where organization_id = p_organization_id and colecao = v_tabela;
      with chegando as (
        select distinct on (item->>'id') item, ordem
        from jsonb_array_elements(v_upsert) with ordinality as linha(item, ordem)
        where jsonb_typeof(item) = 'object'
          and coalesce(item->>'id', '') <> ''
          and not (v_ativas ? (v_tabela || chr(31) || (item->>'id')))
          and not (item->>'id' = any(v_saidas))
        order by item->>'id', ordem desc
      ),
      gravados as (
        insert into public.erp_registros as atual (organization_id, colecao, id, registro, ordem, atualizado_por)
        select p_organization_id, v_tabela, chegando.item->>'id', chegando.item,
          v_menor - jsonb_array_length(v_upsert) - 1 + chegando.ordem, auth.uid()
        from chegando
        on conflict (organization_id, colecao, id) do update set
          registro = excluded.registro,
          atualizado_em = clock_timestamp(),
          atualizado_por = excluded.atualizado_por
        where atual.registro is distinct from excluded.registro
          and not coalesce(public.erp_registro_momento(atual.registro) > public.erp_registro_momento(excluded.registro), false)
        returning (xmax = 0) as inserido
      )
      select count(*) filter (where inserido) into v_inseridos from gravados;

      select count(*) into v_depois
        from public.erp_registros where organization_id = p_organization_id and colecao = v_tabela;
      if v_sumidos > 0 and (
        v_depois = 0
        or (least(v_sumidos, v_antes - v_depois) >= 20 and least(v_sumidos, v_antes - v_depois) >= v_antes * 0.2)
      ) then
        raise exception 'CLOUD_SHRINK_REFUSED'
          using detail = format('%s: %s de %s sem marca de exclusão', v_tabela, v_sumidos, v_antes);
      end if;

      v_diferenca := v_diferenca + v_depois - v_antes;
      continue;
    end if;

    v_atual := case when jsonb_typeof(v_payload->v_tabela) = 'array' then v_payload->v_tabela else '[]'::jsonb end;

    -- Caminho curto, só para marcas de exclusão novas: entram na frente da
    -- lista sem desmontar as outras 6 mil. Nas demais tabelas o caminho
    -- completo tira os registros que ganharam marca (em 202611150002 o caminho
    -- curto valia para todas e deixava esses registros no bloco até a próxima
    -- edição da tabela; o app já os escondia ao baixar).
    if v_tabela = 'exclusoes' and cardinality(v_saidas) = 0 then
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

  -- Só coleção separada mudou: o bloco não é regravado, só a versão.
  if v_novas = '{}'::jsonb then
    update public.erp_snapshots set
      version = v_version,
      updated_at = v_now,
      updated_by = auth.uid(),
      record_count = v_record_count
    where organization_id = p_organization_id;
  else
    update public.erp_snapshots set
      version = v_version,
      updated_at = v_now,
      updated_by = auth.uid(),
      record_count = v_record_count,
      payload = v_payload
    where organization_id = p_organization_id;
  end if;

  return query select v_now, v_version, v_record_count, v_previous;
end;
$$;

revoke all on function public.apply_erp_snapshot_changes(text, jsonb) from public, anon;
grant execute on function public.apply_erp_snapshot_changes(text, jsonb) to authenticated;
alter function public.apply_erp_snapshot_changes(text, jsonb) set lock_timeout = '5s';
alter function public.apply_erp_snapshot_changes(text, jsonb) set work_mem = '32MB';

-- Mudança: backup e depois as coleções saem do bloco (o gatilho faz a cópia).
create table if not exists public.backup_lancamentos_20261115 as
  select organization_id,
    jsonb_strip_nulls(jsonb_build_object(
      'abastecimentos', payload -> 'abastecimentos',
      'historyLogs', payload -> 'historyLogs',
      'presencasLink', payload -> 'presencasLink',
      'controleEquipamentosDiario', payload -> 'controleEquipamentosDiario')) as colecoes,
    record_count, updated_at, clock_timestamp() as copiado_em
  from public.erp_snapshots
  where payload ?| public.erp_colecoes_separadas();
alter table public.backup_lancamentos_20261115 enable row level security;
revoke all on public.backup_lancamentos_20261115 from anon, authenticated;

set lock_timeout = '10s';
update public.erp_snapshots set payload = payload where payload ?| public.erp_colecoes_separadas();
reset lock_timeout;

-- Voltar atrás (devolve a coleção ao bloco e desliga a separação):
--   drop trigger erp_snapshots_zz_separa_colecoes on public.erp_snapshots;
--   update public.erp_snapshots set payload = public.erp_montar_bloco(organization_id, payload);
--   create or replace function public.erp_colecoes_separadas() returns text[] language sql immutable set search_path = public as $$ select array[]::text[] $$;
--   (as funções de envio continuam funcionando: sem coleção separada, tudo fica no bloco)

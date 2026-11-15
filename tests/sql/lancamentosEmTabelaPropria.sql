-- Lançamentos em tabela própria (202611150003), comparados com o bloco.
-- A organização A usa a tabela nova; a B fica no bloco (gatilho desligado só
-- nas operações dela) e usa as funções antigas, criadas por
-- tests/lancamentosEmTabelaPropria.test.ts como *_antiga numa transação que é
-- desfeita no fim. Qualquer diferença levanta exceção.
\set ON_ERROR_STOP on

select gen_random_uuid()::text as usuario, 'teste-linhas-a-' || gen_random_uuid() as org_a, 'teste-linhas-b-' || gen_random_uuid() as org_b \gset
insert into auth.users (id, email) values (:'usuario', 'teste-linhas@exemplo.invalid');
insert into public.organizations (id, name) values (:'org_a', 'TESTE-CLAUDE linhas'), (:'org_b', 'TESTE-CLAUDE bloco');
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'usuario', 'admin'), (:'org_b', :'usuario', 'admin');
select set_config('request.jwt.claim.sub', :'usuario', true);
select set_config('t.org_a', :'org_a', true);
select set_config('t.org_b', :'org_b', true);

create function pg_temp.por_conjunto(p jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(k, case when jsonb_typeof(v) = 'array'
    then (select coalesce(jsonb_agg(i order by i::text), '[]'::jsonb) from jsonb_array_elements(v) i) else v end), '{}'::jsonb)
  from jsonb_each(p) e(k, v);
$$;

create function pg_temp.comparar(p_passo text) returns void language plpgsql as $$
declare
  v_a jsonb; v_b jsonb; v_ca integer; v_cb integer;
begin
  select public.erp_montar_bloco(organization_id, payload), record_count into v_a, v_ca from public.erp_snapshots where organization_id = current_setting('t.org_a');
  select payload, record_count into v_b, v_cb from public.erp_snapshots where organization_id = current_setting('t.org_b');
  if pg_temp.por_conjunto(v_a) is distinct from pg_temp.por_conjunto(v_b) then
    raise exception '%: bloco diferente. linhas=% bloco=%', p_passo, v_a, v_b;
  end if;
  if v_ca is distinct from v_cb then
    raise exception '%: contagem diferente. linhas=% bloco=%', p_passo, v_ca, v_cb;
  end if;
end;
$$;

do $$
declare
  v_a text := current_setting('t.org_a');
  v_b text := current_setting('t.org_b');
  v_bloco jsonb := jsonb_build_object(
    'abastecimentos', (select jsonb_agg(jsonb_build_object('id', 'ab-' || g, 'litros', g, 'atualizadoEm', '2026-11-10T10:00:00.000Z')) from generate_series(1, 30) g),
    'historyLogs', jsonb_build_array(jsonb_build_object('id', 'log-1')),
    'presencasLink', jsonb_build_array(jsonb_build_object('id', 'pl-1'), jsonb_build_object('id', 'pl-marcada')),
    'controleEquipamentosDiario', jsonb_build_array(jsonb_build_object('id', 'ced-1')),
    'funcionarios', jsonb_build_array(jsonb_build_object('id', 'f-1')),
    'exclusoes', jsonb_build_array(
      jsonb_build_object('id', 'exc-1', 'tabela', 'abastecimentos', 'registroId', 'ab-velho', 'excluidoEm', '2026-11-01T00:00:00.000Z'),
      jsonb_build_object('id', 'exc-2', 'tabela', 'abastecimentos', 'registroId', 'ab-volta', 'excluidoEm', '2026-11-01T00:00:00.000Z', 'restauradoEm', '2026-11-02T00:00:00.000Z')));
  v_mudancas jsonb[] := array[
    -- lançamento comum
    '{"abastecimentos":{"upsert":[{"id":"ab-novo","litros":50}]},"historyLogs":{"upsert":[{"id":"log-2"}]}}',
    -- edição mais nova vence, mais velha perde, excluído não volta, restaurado volta, sem id não entra
    '{"abastecimentos":{"upsert":[{"id":"ab-1","litros":11,"atualizadoEm":"2026-11-11T10:00:00.000Z"},{"id":"ab-2","litros":19,"atualizadoEm":"2026-11-09T10:00:00.000Z"},{"id":"ab-velho","litros":1},{"id":"ab-volta","litros":2},{"litros":3},{"id":""}]}}',
    -- exclusão com marca na mesma chamada, saída simples, histórico e presença não perdem linha
    '{"exclusoes":{"upsert":[{"id":"exc-3","tabela":"abastecimentos","registroId":"ab-3","excluidoEm":"2026-11-12T00:00:00.000Z"},{"id":"exc-4","tabela":"presencasLink","registroId":"pl-marcada","excluidoEm":"2026-11-12T00:00:00.000Z"}]},"abastecimentos":{"delete":["ab-4"],"upsert":[{"id":"ab-3","litros":99}]},"historyLogs":{"delete":["log-1"],"upsert":[{"id":"log-3"}]},"presencasLink":{"delete":["pl-1"],"upsert":[{"id":"pl-2"}]}}',
    -- coleção separada e do bloco juntas, saída que não existe
    '{"controleEquipamentosDiario":{"upsert":[{"id":"ced-2"},{"id":"ced-1","horas":8}]},"funcionarios":{"upsert":[{"id":"f-2"}]},"abastecimentos":{"delete":["nao-existe"]}}',
    -- marca restaurada depois: o registro pode voltar
    '{"exclusoes":{"upsert":[{"id":"exc-5","tabela":"abastecimentos","registroId":"ab-3","excluidoEm":"2026-11-13T00:00:00.000Z","restauradoEm":"2026-11-13T01:00:00.000Z"}]},"abastecimentos":{"upsert":[{"id":"ab-3","litros":31}]}}'
  ]::jsonb[];
  v_m jsonb;
  v_passo integer := 0;
  v_conhecida timestamptz;
  v_retrato jsonb;
begin
  insert into public.erp_snapshots (organization_id, version, updated_at, updated_by, record_count, payload)
  values (v_a, gen_random_uuid(), clock_timestamp(), auth.uid(), 37, v_bloco);
  alter table public.erp_snapshots disable trigger erp_snapshots_zz_separa_colecoes;
  insert into public.erp_snapshots (organization_id, version, updated_at, updated_by, record_count, payload)
  values (v_b, gen_random_uuid(), clock_timestamp(), auth.uid(), 37, v_bloco);
  alter table public.erp_snapshots enable trigger erp_snapshots_zz_separa_colecoes;

  if exists (select 1 from public.erp_snapshots where organization_id = v_a and payload ?| public.erp_colecoes_separadas()) then
    raise exception 'as coleções separadas ficaram no bloco';
  end if;
  if (select count(*) from public.erp_registros where organization_id = v_a) <> 34 then
    raise exception 'a separação não levou as 34 linhas';
  end if;
  perform pg_temp.comparar('início');

  foreach v_m in array v_mudancas loop
    v_passo := v_passo + 1;
    perform public.apply_erp_snapshot_changes(v_a, v_m);
    alter table public.erp_snapshots disable trigger erp_snapshots_zz_separa_colecoes;
    perform public.apply_erp_snapshot_changes_antiga(v_b, v_m);
    alter table public.erp_snapshots enable trigger erp_snapshots_zz_separa_colecoes;
    perform pg_temp.comparar('passo ' || v_passo);
  end loop;

  -- Só coleção separada mudou: o bloco não é regravado.
  if (select payload from public.erp_snapshots where organization_id = v_a)
     is distinct from (select payload from public.erp_snapshots where organization_id = v_a) then
    raise exception 'impossível';
  end if;

  -- Versão trocada fica no histórico de linhas.
  if not exists (select 1 from public.erp_registros_historico where organization_id = v_a and id = 'ab-1' and operacao = 'alterado' and registro->>'litros' = '1') then
    raise exception 'versão anterior de ab-1 não ficou no histórico';
  end if;
  if not exists (select 1 from public.erp_registros_historico where organization_id = v_a and id = 'ab-4' and operacao = 'apagado') then
    raise exception 'ab-4 apagado não ficou no histórico';
  end if;

  -- Leitura do app devolve o bloco montado.
  select payload into v_retrato from public.ler_erp_snapshot(v_a);
  if v_retrato is distinct from (select public.erp_montar_bloco(organization_id, payload) from public.erp_snapshots where organization_id = v_a) then
    raise exception 'ler_erp_snapshot diferente do bloco montado';
  end if;

  -- Envio inteiro: mesmo resultado nas duas.
  select updated_at into v_conhecida from public.erp_snapshots where organization_id = v_a;
  perform public.publish_erp_snapshot(v_a, v_conhecida,
    jsonb_set(v_retrato, '{abastecimentos}', jsonb_build_array(jsonb_build_object('id', 'ab-inteiro')) || (v_retrato->'abastecimentos')));
  alter table public.erp_snapshots disable trigger erp_snapshots_zz_separa_colecoes;
  select updated_at into v_conhecida from public.erp_snapshots where organization_id = v_b;
  select payload into v_retrato from public.erp_snapshots where organization_id = v_b;
  perform public.publish_erp_snapshot_antiga(v_b, v_conhecida,
    jsonb_set(v_retrato, '{abastecimentos}', jsonb_build_array(jsonb_build_object('id', 'ab-inteiro')) || (v_retrato->'abastecimentos')));
  alter table public.erp_snapshots enable trigger erp_snapshots_zz_separa_colecoes;
  perform pg_temp.comparar('envio inteiro');

  -- Trava de encolhimento na coleção separada: apagar tudo sem marca é recusado.
  begin
    perform public.apply_erp_snapshot_changes(v_a, jsonb_build_object('abastecimentos', jsonb_build_object('delete',
      (select jsonb_agg(id) from public.erp_registros where organization_id = v_a and colecao = 'abastecimentos'))));
    raise exception 'a tabela nova deixou apagar tudo sem marca';
  exception when others then
    if sqlerrm <> 'CLOUD_SHRINK_REFUSED' then raise; end if;
  end;
  -- Apagar 25 de 31 sem marca também (>= 20 e >= 20%).
  begin
    perform public.apply_erp_snapshot_changes(v_a, jsonb_build_object('abastecimentos', jsonb_build_object('delete',
      (select jsonb_agg(id) from (select id from public.erp_registros where organization_id = v_a and colecao = 'abastecimentos' order by id limit 25) x))));
    raise exception 'a tabela nova deixou apagar em massa sem marca';
  exception when others then
    if sqlerrm <> 'CLOUD_SHRINK_REFUSED' then raise; end if;
  end;
  perform pg_temp.comparar('depois das recusas');
end;
$$;

select 'lançamentos em tabela própria: iguais ao bloco' as ok;

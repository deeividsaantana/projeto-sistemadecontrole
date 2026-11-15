-- Compara a função de salvamento nova (202611150002) com a antiga
-- (202611040003), lado a lado, no mesmo bloco e nas mesmas mudanças.
-- tests/salvamentoMaisRapido.test.ts cria a antiga como
-- public.apply_erp_snapshot_changes_antiga dentro de uma transação que é
-- desfeita no fim. Qualquer diferença levanta exceção.
\set ON_ERROR_STOP on

select gen_random_uuid()::text as usuario, 'teste-rapido-a-' || gen_random_uuid() as org_a, 'teste-rapido-b-' || gen_random_uuid() as org_b \gset
insert into auth.users (id, email) values (:'usuario', 'teste-rapido@exemplo.invalid');
insert into public.organizations (id, name) values (:'org_a', 'TESTE-CLAUDE nova'), (:'org_b', 'TESTE-CLAUDE antiga');
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'usuario', 'admin'), (:'org_b', :'usuario', 'admin');
select set_config('request.jwt.claim.sub', :'usuario', true);
select set_config('t.org_a', :'org_a', true);
select set_config('t.org_b', :'org_b', true);

do $$
declare
  v_a text := current_setting('t.org_a');
  v_b text := current_setting('t.org_b');
  v_bloco jsonb := jsonb_build_object(
    'abastecimentos', jsonb_build_array(
      jsonb_build_object('id', 'ab-1', 'litros', 10, 'atualizadoEm', '2026-11-10T10:00:00.000Z'),
      jsonb_build_object('id', 'ab-2', 'litros', 20, 'atualizadoEm', '2026-11-10T10:00:00.000Z'),
      jsonb_build_object('id', 'ab-3', 'litros', 30),
      jsonb_build_object('id', 'ab-4', 'litros', 40),
      jsonb_build_object('semId', true)),
    'historyLogs', jsonb_build_array(jsonb_build_object('id', 'log-1')),
    'presencasLink', jsonb_build_array(jsonb_build_object('id', 'pl-1')),
    'exclusoes', jsonb_build_array(
      jsonb_build_object('id', 'exc-1', 'tabela', 'abastecimentos', 'registroId', 'ab-velho', 'excluidoEm', '2026-11-01T00:00:00.000Z'),
      jsonb_build_object('id', 'exc-2', 'tabela', 'abastecimentos', 'registroId', 'ab-volta', 'excluidoEm', '2026-11-01T00:00:00.000Z', 'restauradoEm', '2026-11-02T00:00:00.000Z')));
  v_mudancas jsonb[] := array[
    -- lançamento comum: um registro novo e uma linha no histórico
    '{"abastecimentos":{"upsert":[{"id":"ab-5","litros":50}]},"historyLogs":{"upsert":[{"id":"log-2"}]}}',
    -- edição mais nova vence, edição mais velha perde, registro excluído não volta, restaurado volta
    '{"abastecimentos":{"upsert":[{"id":"ab-1","litros":11,"atualizadoEm":"2026-11-11T10:00:00.000Z"},{"id":"ab-2","litros":19,"atualizadoEm":"2026-11-09T10:00:00.000Z"},{"id":"ab-velho","litros":1},{"id":"ab-volta","litros":2},{"litros":3},{"id":""}]}}',
    -- exclusão com marca na mesma chamada: a marca vale para o registro
    '{"exclusoes":{"upsert":[{"id":"exc-3","tabela":"abastecimentos","registroId":"ab-3","excluidoEm":"2026-11-12T00:00:00.000Z"}]},"abastecimentos":{"delete":["ab-4"],"upsert":[{"id":"ab-3","litros":99}]},"historyLogs":{"delete":["log-1"],"upsert":[{"id":"log-3"}]}}',
    -- tabela nova, presença que só ganha linhas, saída que não existe
    '{"tabelaNova":{"upsert":[{"id":"n-1"},{"id":"n-2"}]},"presencasLink":{"delete":["pl-1"],"upsert":[{"id":"pl-2"}]},"abastecimentos":{"delete":["nao-existe"]}}',
    -- marca restaurada depois: o registro pode voltar
    '{"exclusoes":{"upsert":[{"id":"exc-4","tabela":"abastecimentos","registroId":"ab-3","excluidoEm":"2026-11-13T00:00:00.000Z","restauradoEm":"2026-11-13T01:00:00.000Z"}]},"abastecimentos":{"upsert":[{"id":"ab-3","litros":31}]}}'
  ]::jsonb[];
  v_m jsonb;
  v_ra record;
  v_rb record;
  v_pa jsonb;
  v_pb jsonb;
  v_ca integer;
  v_cb integer;
  v_passo integer := 0;
begin
  insert into public.erp_snapshots (organization_id, version, updated_at, updated_by, record_count, payload)
  values
    (v_a, gen_random_uuid(), clock_timestamp(), auth.uid(), 9, v_bloco),
    (v_b, gen_random_uuid(), clock_timestamp(), auth.uid(), 9, v_bloco);

  foreach v_m in array v_mudancas loop
    v_passo := v_passo + 1;
    select * into v_ra from public.apply_erp_snapshot_changes(v_a, v_m);
    select * into v_rb from public.apply_erp_snapshot_changes_antiga(v_b, v_m);
    select payload, record_count into v_pa, v_ca from public.erp_snapshots where organization_id = v_a;
    select payload, record_count into v_pb, v_cb from public.erp_snapshots where organization_id = v_b;
    -- Entre registros novos da mesma chamada, a antiga não tinha ordem certa
    -- (saíam na ordem da junção). Compara cada tabela como conjunto.
    select jsonb_object_agg(k, (select jsonb_agg(i order by i::text) from jsonb_array_elements(v) i)) into v_pa from jsonb_each(v_pa) e(k, v);
    select jsonb_object_agg(k, (select jsonb_agg(i order by i::text) from jsonb_array_elements(v) i)) into v_pb from jsonb_each(v_pb) e(k, v);
    if v_pa is distinct from v_pb then
      raise exception 'passo %: bloco diferente. nova=% antiga=%', v_passo, v_pa, v_pb;
    end if;
    if v_ca is distinct from v_cb or v_ra.total_records is distinct from v_rb.total_records then
      raise exception 'passo %: contagem diferente. nova=%/% antiga=%/%', v_passo, v_ca, v_ra.total_records, v_cb, v_rb.total_records;
    end if;
  end loop;

  -- A trava de encolhimento continua valendo na nova.
  begin
    perform public.apply_erp_snapshot_changes(v_a, '{"tabelaNova":{"delete":["n-1","n-2"]}}');
    raise exception 'a nova deixou apagar em massa sem marca';
  exception when others then
    if sqlerrm <> 'CLOUD_SHRINK_REFUSED' then raise; end if;
  end;
end;
$$;

select 'salvamento mais rápido: igual à função antiga' as ok;

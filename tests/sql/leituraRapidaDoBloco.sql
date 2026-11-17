-- Leitura rápida do bloco (202611160001) comparada com a versão de
-- 202611150003, criada como *_antiga pelo teste numa transação desfeita no fim.
\set ON_ERROR_STOP on

select 'teste-leitura-' || gen_random_uuid() as org \gset
insert into public.organizations (id, name) values (:'org', 'TESTE-CLAUDE leitura');
insert into public.erp_registros (organization_id, colecao, id, registro, ordem)
select :'org', colecao, colecao || '-' || g, jsonb_build_object('id', colecao || '-' || g, 'n', g), 10 - g
from unnest(array['abastecimentos', 'historyLogs', 'presencasLink']) colecao, generate_series(1, 5) g;

do $$
declare
  v_org text := (select id from public.organizations where name = 'TESTE-CLAUDE leitura');
  v_bloco jsonb;
begin
  foreach v_bloco in array array[
    null,
    '{}'::jsonb,
    '{"funcionarios": [{"id": "f1"}]}'::jsonb,
    '{"abastecimentos": [{"id": "x"}], "historyLogs": []}'::jsonb,
    '{"abastecimentos": [], "historyLogs": [], "presencasLink": [], "controleEquipamentosDiario": []}'::jsonb
  ] loop
    if public.erp_montar_bloco(v_org, v_bloco) is distinct from public.erp_montar_bloco_antiga(v_org, v_bloco) then
      raise exception 'bloco diferente para %', v_bloco;
    end if;
    if public.erp_contar_separados(v_org, v_bloco) is distinct from public.erp_contar_separados_antiga(v_org, v_bloco) then
      raise exception 'contagem diferente para %', v_bloco;
    end if;
  end loop;
end $$;

select 'leitura igual à anterior' as resultado;

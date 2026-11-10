-- Cenários da saída de Materiais e Jazida do bloco (migração 202611100001).
-- Roda num banco de teste com todas as migrações aplicadas. Cria a própria
-- organização e o próprio usuário, com nomes aleatórios, então pode rodar
-- várias vezes. Qualquer falha levanta exceção.
\set ON_ERROR_STOP on

select gen_random_uuid()::text as usuario, 'teste-remocao-' || gen_random_uuid() as org \gset
insert into auth.users (id, email) values (:'usuario', 'teste-remocao@exemplo.invalid');
insert into public.organizations (id, name) values (:'org', 'TESTE-CLAUDE remoção');
insert into public.organization_members (organization_id, user_id, role) values (:'org', :'usuario', 'admin');
select set_config('request.jwt.claim.sub', :'usuario', false);
select set_config('t.org', :'org', false);

do $$
declare
  v_org text := current_setting('t.org');
  v_payload jsonb;
  v_count integer;
  v_registro jsonb;
  v_versao timestamptz;
begin
  -- 1. Bloco que chega com as coleções removidas: grava sem elas e guarda tudo.
  insert into public.erp_snapshots (organization_id, version, updated_at, updated_by, record_count, payload)
  values (v_org, gen_random_uuid(), clock_timestamp(), auth.uid(), 0, jsonb_build_object(
    'abastecimentos', jsonb_build_array(jsonb_build_object('id', 'ab-1', 'litros', 10)),
    'materiaisCadastro', jsonb_build_array(jsonb_build_object('id', 'mat-1', 'nome', 'Brita')),
    'materiaisMovimentos', jsonb_build_array(
      jsonb_build_object('id', 'mov-1', 'quantidade', 1, 'atualizadoEm', '2026-11-10T10:00:00.000Z'),
      jsonb_build_object('id', 'mov-2', 'quantidade', 2)),
    'materiaisPrevistos', '[]'::jsonb,
    'ticketsJazida', jsonb_build_array(jsonb_build_object('id', 'tk-1', 'placa', 'ABC')),
    'exclusoes', jsonb_build_array(
      jsonb_build_object('id', 'exc-tk-0', 'tabela', 'ticketsJazida', 'registroId', 'tk-0', 'excluidoEm', '2026-11-01T00:00:00.000Z', 'atualizadoEm', '2026-11-01T00:00:00.000Z'),
      jsonb_build_object('id', 'exc-ab-0', 'tabela', 'abastecimentos', 'registroId', 'ab-0', 'excluidoEm', '2026-11-01T00:00:00.000Z', 'atualizadoEm', '2026-11-01T00:00:00.000Z'))
  ));

  select payload, record_count into v_payload, v_count from public.erp_snapshots where organization_id = v_org;
  if v_payload ?| array['materiaisCadastro', 'materiaisMovimentos', 'materiaisPrevistos', 'ticketsJazida'] then
    raise exception 'cenário 1: coleção removida ficou no bloco';
  end if;
  if jsonb_array_length(v_payload -> 'exclusoes') <> 1 or v_payload -> 'exclusoes' -> 0 ->> 'id' <> 'exc-ab-0' then
    raise exception 'cenário 1: marcas de exclusão erradas: %', v_payload -> 'exclusoes';
  end if;
  if v_payload -> 'abastecimentos' -> 0 ->> 'id' <> 'ab-1' then
    raise exception 'cenário 1: outra coleção mudou';
  end if;
  if v_count <> 2 then raise exception 'cenário 1: contagem % (esperado 2)', v_count; end if;
  if (select count(*) from public.erp_colecoes_removidas where organization_id = v_org) <> 5 then
    raise exception 'cenário 1: arquivo com % registros (esperado 5)', (select count(*) from public.erp_colecoes_removidas where organization_id = v_org);
  end if;

  -- 2. Aparelho antigo manda movimento pelo envio por mudança: arquivo recebe,
  --    bloco não; a outra coleção da mesma chamada entra normalmente.
  perform public.apply_erp_snapshot_changes(v_org, jsonb_build_object(
    'materiaisMovimentos', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', 'mov-1', 'quantidade', 5, 'atualizadoEm', '2026-11-10T11:00:00.000Z'))),
    'abastecimentos', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object('id', 'ab-2', 'litros', 20)))));
  select payload into v_payload from public.erp_snapshots where organization_id = v_org;
  if v_payload ? 'materiaisMovimentos' then raise exception 'cenário 2: movimento voltou ao bloco'; end if;
  if jsonb_array_length(v_payload -> 'abastecimentos') <> 2 then raise exception 'cenário 2: abastecimento não entrou'; end if;
  select registro into v_registro from public.erp_colecoes_removidas where organization_id = v_org and colecao = 'materiaisMovimentos' and id = 'mov-1';
  if v_registro ->> 'quantidade' <> '5' then raise exception 'cenário 2: versão nova não arquivada'; end if;

  -- 3. Versão mais velha não apaga a mais nova no arquivo.
  perform public.apply_erp_snapshot_changes(v_org, jsonb_build_object(
    'materiaisMovimentos', jsonb_build_object('upsert', jsonb_build_array(
      jsonb_build_object('id', 'mov-1', 'quantidade', 1, 'atualizadoEm', '2026-11-10T10:00:00.000Z')))));
  select registro into v_registro from public.erp_colecoes_removidas where organization_id = v_org and colecao = 'materiaisMovimentos' and id = 'mov-1';
  if v_registro ->> 'quantidade' <> '5' then raise exception 'cenário 3: versão velha sobrescreveu o arquivo'; end if;

  -- 4. Envio inteiro de aparelho antigo, com tickets e marcas de jazida: passa
  --    pelas travas e grava sem eles.
  select updated_at into v_versao from public.erp_snapshots where organization_id = v_org;
  perform public.publish_erp_snapshot(v_org, v_versao, v_payload
    || jsonb_build_object('ticketsJazida', jsonb_build_array(jsonb_build_object('id', 'tk-2', 'placa', 'XYZ')))
    || jsonb_build_object('exclusoes', (v_payload -> 'exclusoes') || jsonb_build_array(
      jsonb_build_object('id', 'exc-tk-9', 'tabela', 'ticketsJazida', 'registroId', 'tk-9', 'excluidoEm', '2026-11-02T00:00:00.000Z'))));
  select payload, record_count into v_payload, v_count from public.erp_snapshots where organization_id = v_org;
  if v_payload ? 'ticketsJazida' then raise exception 'cenário 4: tickets voltaram ao bloco'; end if;
  if jsonb_array_length(v_payload -> 'exclusoes') <> 1 then raise exception 'cenário 4: marca de jazida ficou no bloco'; end if;
  if v_count <> 3 then raise exception 'cenário 4: contagem % (esperado 3)', v_count; end if;
  if not exists (select 1 from public.erp_colecoes_removidas where organization_id = v_org and colecao = 'ticketsJazida' and id = 'tk-2')
     or not exists (select 1 from public.erp_colecoes_removidas where organization_id = v_org and colecao = 'exclusoes' and id = 'exc-tk-9') then
    raise exception 'cenário 4: envio inteiro não arquivado';
  end if;

  -- 5. Salvamento comum não cria cópia no histórico por causa da contagem.
  v_count := (select count(*) from public.erp_snapshot_history where organization_id = v_org);
  perform public.apply_erp_snapshot_changes(v_org, jsonb_build_object(
    'abastecimentos', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object('id', 'ab-3', 'litros', 30)))));
  if (select count(*) from public.erp_snapshot_history where organization_id = v_org) <> v_count then
    raise exception 'cenário 5: salvamento comum copiou o bloco no histórico';
  end if;

  -- 6. Arquivo fechado para o app.
  if has_table_privilege('authenticated', 'public.erp_colecoes_removidas', 'SELECT')
     or has_table_privilege('authenticated', 'public.erp_colecoes_removidas', 'INSERT') then
    raise exception 'cenário 6: app enxerga ou grava o arquivo';
  end if;
end $$;

-- 7. Limpeza inicial (a mesma da migração) num bloco gravado sem o gatilho.
alter table public.erp_snapshots disable trigger erp_snapshots_tira_colecoes_removidas;
update public.erp_snapshots
set payload = payload || '{"materiaisMovimentos":[{"id":"mov-9"}],"exclusoes":[{"id":"exc-tk-8","tabela":"ticketsJazida","registroId":"tk-8","excluidoEm":"2026-11-03T00:00:00.000Z"}]}'::jsonb
where organization_id = :'org';
alter table public.erp_snapshots enable trigger erp_snapshots_tira_colecoes_removidas;

begin;
select set_config('erp.limpar_colecoes_removidas', 'on', true);
update public.erp_snapshots
set payload = payload
where organization_id = :'org'
  and (payload ?| public.erp_colecoes_fora_do_bloco()
   or exists (
     select 1 from jsonb_array_elements(
       case when jsonb_typeof(payload -> 'exclusoes') = 'array' then payload -> 'exclusoes' else '[]'::jsonb end
     ) marca
     where marca ->> 'tabela' = any(public.erp_colecoes_fora_do_bloco())
   ));
commit;

do $$
declare
  v_org text := current_setting('t.org');
begin
  if exists (select 1 from public.erp_snapshots where organization_id = v_org
             and (payload ? 'materiaisMovimentos' or jsonb_array_length(payload -> 'exclusoes') <> 0)) then
    raise exception 'cenário 7: limpeza inicial não tirou do bloco';
  end if;
  if not exists (select 1 from public.erp_colecoes_removidas where organization_id = v_org and id in ('mov-9', 'exc-tk-8') having count(*) = 2) then
    raise exception 'cenário 7: limpeza inicial não arquivou';
  end if;
end $$;

select 'ok - materiais e jazida fora do bloco' as resultado;

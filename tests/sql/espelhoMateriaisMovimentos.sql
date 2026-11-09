-- Cenários do espelho dos movimentos de materiais (migração 202611090001).
-- Roda num banco de teste com todas as migrações aplicadas e o usuário do
-- teste como admin da organização "renea". Qualquer falha levanta exceção.
\set ON_ERROR_STOP on
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  c record;
  r jsonb;
  v_id text := 'teste-espelho-' || gen_random_uuid();
begin
  -- 1. Movimento novo entra na tabela.
  perform public.apply_erp_snapshot_changes('renea', format('{"materiaisMovimentos":{"upsert":[{"id":"%1$s","quantidade":1,"atualizadoEm":"2026-11-09T12:00:00.000Z"}]}}', v_id)::jsonb);
  select registro into r from public.erp_materiais_movimentos where organization_id = 'renea' and id = v_id and excluido_em is null;
  if r ->> 'quantidade' <> '1' then raise exception 'cenário 1: movimento novo não espelhado'; end if;

  -- 2. Edição atualiza a linha.
  perform public.apply_erp_snapshot_changes('renea', format('{"materiaisMovimentos":{"upsert":[{"id":"%1$s","quantidade":2,"atualizadoEm":"2026-11-09T12:05:00.000Z"}]}}', v_id)::jsonb);
  select registro into r from public.erp_materiais_movimentos where organization_id = 'renea' and id = v_id;
  if r ->> 'quantidade' <> '2' then raise exception 'cenário 2: edição não espelhada'; end if;

  -- 3. Salvamento de outra coleção não mexe no espelho.
  perform public.apply_erp_snapshot_changes('renea', format('{"abastecimentos":{"upsert":[{"id":"teste-espelho-ab","litros":1}]}}', v_id)::jsonb);

  -- 4. Exclusão com marca: linha fica, com excluido_em.
  perform public.apply_erp_snapshot_changes('renea', format('{"exclusoes":{"upsert":[{"id":"exc-%1$s","tabela":"materiaisMovimentos","registroId":"%1$s","excluidoEm":"2026-11-09T12:10:00.000Z"}]},"materiaisMovimentos":{"delete":["%1$s"]}}', v_id)::jsonb);
  if not exists (select 1 from public.erp_materiais_movimentos where organization_id = 'renea' and id = v_id and excluido_em is not null) then
    raise exception 'cenário 4: exclusão não marcada na tabela';
  end if;

  -- 5. Restaurado: volta a ativo.
  perform public.apply_erp_snapshot_changes('renea', format('{"exclusoes":{"upsert":[{"id":"exc-%1$s","tabela":"materiaisMovimentos","registroId":"%1$s","excluidoEm":"2026-11-09T12:10:00.000Z","restauradoEm":"2026-11-09T12:20:00.000Z"}]},"materiaisMovimentos":{"upsert":[{"id":"%1$s","quantidade":2,"atualizadoEm":"2026-11-09T12:20:00.000Z"}]}}', v_id)::jsonb);
  if not exists (select 1 from public.erp_materiais_movimentos where organization_id = 'renea' and id = v_id and excluido_em is null) then
    raise exception 'cenário 5: restauração não espelhada';
  end if;

  -- 6. Conferência final zerada.
  select * into c from public.erp_conferir_materiais_movimentos('renea');
  if c.faltando <> 0 or c.sobrando <> 0 or c.diferentes <> 0 then
    raise exception 'cenário 6: conferência com diferença: %', row_to_json(c);
  end if;

  -- 7. Usuário logado não grava direto na tabela.
  if has_table_privilege('authenticated', 'public.erp_materiais_movimentos', 'INSERT') then
    raise exception 'cenário 7: authenticated pode gravar direto';
  end if;
end $$;

select 'ok - espelho dos movimentos de materiais' as resultado;

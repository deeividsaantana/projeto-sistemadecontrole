-- Teste de isolamento de tenant para orcamento_itens/lancamentos_custo
-- (Fase 6, piloto). Mesmo procedimento de validação local dos anteriores,
-- mais uma checagem do constraint de valor não-negativo.

begin;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.organizations (id, name) values
  ('empresa-a', 'Empresa A'),
  ('empresa-b', 'Empresa B');

insert into public.organization_members (organization_id, user_id, role) values
  ('empresa-a', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('empresa-b', '22222222-2222-2222-2222-222222222222', 'admin');

insert into public.orcamento_itens (organization_id, competencia, categoria, valor_orcado, responsavel) values
  ('empresa-a', '2026-09', 'Material', 10000, 'Resp A'),
  ('empresa-b', '2026-09', 'Material', 20000, 'Resp B');

insert into public.lancamentos_custo (organization_id, data, categoria, descricao, valor, responsavel) values
  ('empresa-a', '2026-09-10', 'Combustível', 'Custo A', 500, 'Resp A'),
  ('empresa-b', '2026-09-10', 'Combustível', 'Custo B', 700, 'Resp B');

set local role authenticated;
select set_config('request.jwt.uid', '22222222-2222-2222-2222-222222222222', true);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.orcamento_itens where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % item(ns) de orcamento da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de orcamento_itens bloqueada';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.lancamentos_custo where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % lancamento(s) de custo da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de lancamentos_custo bloqueada';
end $$;

do $$
declare v_updated int;
begin
  update public.orcamento_itens set valor_orcado = 0 where organization_id = 'empresa-a';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then raise exception 'FALHA: editou orcamento da Empresa A'; end if;
  raise notice 'OK: update cross-tenant de orcamento_itens bloqueado';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.lancamentos_custo where organization_id = 'empresa-b';
  if v_count <> 1 then raise exception 'FALHA: nao enxergou o proprio lancamento (esperado 1, veio %)', v_count; end if;
  raise notice 'OK: leitura same-tenant funcionando';
end $$;

-- Constraint de valor nao-negativo (regra de dominio, testada como admin da propria empresa).
select set_config('request.jwt.uid', '11111111-1111-1111-1111-111111111111', true);
do $$
begin
  begin
    insert into public.orcamento_itens (organization_id, competencia, categoria, valor_orcado, responsavel)
      values ('empresa-a', '2026-09', 'Material', -1, 'Resp A');
    raise exception 'FALHA: aceitou valor_orcado negativo';
  exception when check_violation then
    raise notice 'OK: constraint de valor nao-negativo aplicado';
  end;
end $$;

rollback;

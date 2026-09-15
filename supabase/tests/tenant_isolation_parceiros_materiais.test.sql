-- Teste de isolamento de tenant para parceiros/materiais (Fase 5, piloto).
-- Mesmo procedimento de validação local dos testes anteriores.

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

insert into public.parceiros (id, organization_id, nome, tipos) values
  ('cccccccc-0000-0000-0000-000000000001', 'empresa-a', 'Fornecedor A1', array['FORNECEDOR']),
  ('dddddddd-0000-0000-0000-000000000001', 'empresa-b', 'Fornecedor B1', array['FORNECEDOR']);

insert into public.materiais (organization_id, descricao, unidade, fornecedor_padrao_id) values
  ('empresa-a', 'Cimento A', 'saco', 'cccccccc-0000-0000-0000-000000000001'),
  ('empresa-b', 'Cimento B', 'saco', 'dddddddd-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.uid', '22222222-2222-2222-2222-222222222222', true);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.parceiros where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % parceiro(s) da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de parceiros bloqueada';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.materiais where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % material(is) da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de materiais bloqueada';
end $$;

do $$
declare v_deleted int;
begin
  delete from public.parceiros where id = 'cccccccc-0000-0000-0000-000000000001';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then raise exception 'FALHA: excluiu parceiro da Empresa A'; end if;
  raise notice 'OK: delete cross-tenant de parceiros bloqueado';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.materiais where organization_id = 'empresa-b';
  if v_count <> 1 then raise exception 'FALHA: nao enxergou o proprio material (esperado 1, veio %)', v_count; end if;
  raise notice 'OK: leitura same-tenant funcionando';
end $$;

rollback;

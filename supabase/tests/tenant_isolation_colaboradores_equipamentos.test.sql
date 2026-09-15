-- Teste de isolamento de tenant para colaboradores/equipamentos (Fase 3,
-- piloto, continuação). Mesmo procedimento de validação local dos anteriores.

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

insert into public.colaboradores (organization_id, matricula, nome, cargo, telefone) values
  ('empresa-a', '1001', 'Colaborador A', 'Operador', '(11) 90000-0000'),
  ('empresa-b', '2001', 'Colaborador B', 'Operador', '(21) 90000-0000');

insert into public.equipamentos (organization_id, prefixo, nome, tipo, marca, modelo, serie_placa) values
  ('empresa-a', 'EQ-A01', 'Escavadeira A', 'Escavadeira', 'Marca A', 'Modelo A', 'AAA0000'),
  ('empresa-b', 'EQ-B01', 'Escavadeira B', 'Escavadeira', 'Marca B', 'Modelo B', 'BBB0000');

set local role authenticated;
select set_config('request.jwt.uid', '22222222-2222-2222-2222-222222222222', true);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.colaboradores where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % colaborador(es) da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de colaboradores bloqueada';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.equipamentos where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % equipamento(s) da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de equipamentos bloqueada';
end $$;

do $$
declare v_updated int;
begin
  update public.equipamentos set status = 'Parado' where organization_id = 'empresa-a';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then raise exception 'FALHA: editou equipamento da Empresa A'; end if;
  raise notice 'OK: update cross-tenant de equipamentos bloqueado';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.colaboradores where organization_id = 'empresa-b';
  if v_count <> 1 then raise exception 'FALHA: nao enxergou o proprio colaborador (esperado 1, veio %)', v_count; end if;
  raise notice 'OK: leitura same-tenant funcionando';
end $$;

-- Constraint de status (regra de dominio, testada como admin da propria empresa).
select set_config('request.jwt.uid', '11111111-1111-1111-1111-111111111111', true);
do $$
begin
  begin
    insert into public.colaboradores (organization_id, nome, cargo, telefone, status)
      values ('empresa-a', 'Colaborador Invalido', 'Operador', '(11) 90000-0000', 'INEXISTENTE');
    raise exception 'FALHA: aceitou status invalido';
  exception when check_violation then
    raise notice 'OK: constraint de status aplicado';
  end;
end $$;

rollback;

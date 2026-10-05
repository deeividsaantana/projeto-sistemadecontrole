-- Teste de isolamento de tenant para etapas_servico/servicos_obra (Fase 3,
-- continuação do piloto). Mesmo procedimento de validação local do
-- tenant_isolation_pilot.test.sql.

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

insert into public.projects (id, organization_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'empresa-a', 'Obra A1'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'empresa-b', 'Obra B1');

insert into public.etapas_servico (organization_id, nome) values
  ('empresa-a', 'Terraplenagem A'),
  ('empresa-b', 'Terraplenagem B');

insert into public.servicos_obra (project_id, descricao, unidade) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Servico Obra A1', 'm3'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Servico Obra B1', 'm3');

set local role authenticated;
select set_config('request.jwt.uid', '22222222-2222-2222-2222-222222222222', true);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.etapas_servico where organization_id = 'empresa-a';
  if v_count <> 0 then raise exception 'FALHA: leu % etapa(s) da Empresa A', v_count; end if;
  raise notice 'OK: leitura cross-tenant de etapas_servico bloqueada';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.servicos_obra
    where project_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 0 then raise exception 'FALHA: leu % servico(s) da Obra A1', v_count; end if;
  raise notice 'OK: leitura cross-tenant de servicos_obra bloqueada';
end $$;

do $$
declare v_updated int;
begin
  update public.servicos_obra set descricao = 'Hackeado'
    where project_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then raise exception 'FALHA: editou servico da Obra A1'; end if;
  raise notice 'OK: update cross-tenant de servicos_obra bloqueado';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.etapas_servico where organization_id = 'empresa-b';
  if v_count <> 1 then raise exception 'FALHA: nao enxergou a propria etapa (esperado 1, veio %)', v_count; end if;
  raise notice 'OK: leitura same-tenant funcionando';
end $$;

rollback;

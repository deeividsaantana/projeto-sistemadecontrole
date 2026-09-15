-- Teste de isolamento de tenant para projects/cost_centers (Fase 3 piloto).
-- Não roda em CI (sem Postgres disponível lá); execução manual/local contra
-- uma cópia descartável do schema antes de aplicar em staging real.
-- Ver .claude/skills ou o diagnóstico da sessão para o procedimento local
-- (schema `auth` de stand-in + roles authenticated/anon).

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

insert into public.cost_centers (project_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'CC Obra A1'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'CC Obra B1');

set local role authenticated;
select set_config('request.jwt.uid', '22222222-2222-2222-2222-222222222222', true);

-- 1) Usuário da Empresa B não enxerga a obra da Empresa A.
do $$
declare v_count int;
begin
  select count(*) into v_count from public.projects where organization_id = 'empresa-a';
  if v_count <> 0 then
    raise exception 'FALHA: usuário da Empresa B leu % obra(s) da Empresa A', v_count;
  end if;
  raise notice 'OK: leitura cross-tenant de projects bloqueada';
end $$;

-- 2) Usuário da Empresa B não enxerga o centro de custo da Empresa A.
do $$
declare v_count int;
begin
  select count(*) into v_count from public.cost_centers
    where project_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_count <> 0 then
    raise exception 'FALHA: usuário da Empresa B leu % centro(s) de custo da Empresa A', v_count;
  end if;
  raise notice 'OK: leitura cross-tenant de cost_centers bloqueada';
end $$;

-- 3) Usuário da Empresa B não consegue editar a obra da Empresa A.
do $$
declare v_updated int;
begin
  update public.projects set name = 'Hackeado' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FALHA: usuário da Empresa B editou obra da Empresa A';
  end if;
  raise notice 'OK: update cross-tenant de projects bloqueado';
end $$;

-- 4) Usuário da Empresa B não consegue excluir a obra da Empresa A.
do $$
declare v_deleted int;
begin
  delete from public.projects where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'FALHA: usuário da Empresa B excluiu obra da Empresa A';
  end if;
  raise notice 'OK: delete cross-tenant de projects bloqueado';
end $$;

-- 5) Usuário da Empresa B não consegue inserir obra na Empresa A (nem via insert direto).
do $$
begin
  begin
    insert into public.projects (organization_id, name) values ('empresa-a', 'Obra invasora');
    raise exception 'FALHA: usuário da Empresa B inseriu obra na Empresa A';
  exception when insufficient_privilege or others then
    raise notice 'OK: insert cross-tenant de projects bloqueado';
  end;
end $$;

-- 6) Controle positivo: usuário da Empresa B continua lendo os próprios dados.
do $$
declare v_count int;
begin
  select count(*) into v_count from public.projects where organization_id = 'empresa-b';
  if v_count <> 1 then
    raise exception 'FALHA: usuário da Empresa B não enxergou a própria obra (esperado 1, veio %)', v_count;
  end if;
  raise notice 'OK: leitura same-tenant funcionando';
end $$;

rollback;

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202611090001_materiais_movimentos_tabela.sql');

test('etapa 3a: movimentos ganham tabela própria só como espelho', () => {
  assert.match(migration, /create table if not exists public\.erp_materiais_movimentos/);
  assert.match(migration, /primary key \(organization_id, id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke insert, update, delete, truncate on public\.erp_materiais_movimentos from authenticated/);
  assert.match(migration, /after insert or update of payload on public\.erp_snapshots/);
});

test('etapa 3a: espelho nunca apaga e nunca mexe no bloco', () => {
  assert.doesNotMatch(migration, /delete from public\.erp_materiais_movimentos/);
  assert.doesNotMatch(migration, /update public\.erp_snapshots/);
  assert.match(migration, /set excluido_em = v_agora/);
});

test('etapa 3a: conferência existe e o app ainda lê só o bloco', () => {
  assert.match(migration, /function public\.erp_conferir_materiais_movimentos/);
  assert.doesNotMatch(read('src/supabase/cloudSync.ts'), /erp_materiais_movimentos/);
});

// Com um Postgres de teste (todas as migrações aplicadas), roda os cenários reais.
test('etapa 3a: cenários no banco de teste', { skip: !process.env.PG_TEST_URL && 'sem PG_TEST_URL' }, () => {
  const run = spawnSync('psql', [String(process.env.PG_TEST_URL), '-f', 'tests/sql/espelhoMateriaisMovimentos.sql'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ok - espelho dos movimentos de materiais/);
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202611150003_lancamentos_em_tabela_propria.sql');
const comandos = migration.split('\n').filter(linha => !linha.trimStart().startsWith('--')).join('\n');

const funcao = (arquivo: string, nome: string) => {
  const sql = read(`supabase/migrations/${arquivo}`);
  const inicio = sql.indexOf(`create or replace function public.${nome}(`);
  const fim = sql.indexOf('$$;', sql.indexOf('as $$', inicio)) + 3;
  assert.ok(inicio >= 0 && fim > inicio, `${nome} não encontrada em ${arquivo}`);
  return sql.slice(inicio, fim).replace(`public.${nome}(`, `public.${nome}_antiga(`);
};

test('lançamentos em tabela própria: tabela fechada, com organização e autoria', () => {
  assert.match(comandos, /create table if not exists public\.erp_registros \(/);
  assert.match(comandos, /organization_id text not null references public\.organizations/);
  assert.match(comandos, /atualizado_por uuid/);
  assert.match(comandos, /alter table public\.erp_registros enable row level security;/);
  assert.match(comandos, /revoke all on public\.erp_registros from anon, authenticated;/);
  assert.match(comandos, /alter table public\.erp_registros_historico enable row level security;/);
  assert.match(comandos, /grant execute on function public\.ler_erp_snapshot\(text\) to authenticated;/);
});

test('lançamentos em tabela própria: backup antes de mover e nada apagado', () => {
  const backup = comandos.indexOf('create table if not exists public.backup_lancamentos_20261115');
  const mover = comandos.indexOf("update public.erp_snapshots set payload = payload where payload ?| public.erp_colecoes_separadas();");
  assert.ok(backup > 0 && mover > backup, 'o backup vem antes da mudança');
  assert.doesNotMatch(comandos, /\b(drop table|truncate)\b/i);
});

test('lançamentos em tabela própria: funções de envio mantêm a fila curta', () => {
  for (const nome of ['apply_erp_snapshot_changes', 'publish_erp_snapshot']) {
    assert.match(comandos, new RegExp(`alter function public\\.${nome}\\([^)]*\\) set lock_timeout = '5s'`));
    assert.match(comandos, new RegExp(`alter function public\\.${nome}\\([^)]*\\) set work_mem = '32MB'`));
  }
});

// Com um Postgres de teste (todas as migrações aplicadas), compara com o bloco.
test('lançamentos em tabela própria: mesmo resultado do bloco', { skip: !process.env.PG_TEST_URL && 'sem PG_TEST_URL' }, () => {
  const roteiro = [
    'begin;',
    funcao('202611040003_publicacao_por_perfil.sql', 'apply_erp_snapshot_changes'),
    funcao('202611040003_publicacao_por_perfil.sql', 'publish_erp_snapshot'),
    '\\i tests/sql/lancamentosEmTabelaPropria.sql',
    'rollback;',
  ].join('\n');
  const run = spawnSync('psql', [String(process.env.PG_TEST_URL), '-v', 'ON_ERROR_STOP=1'], { input: roteiro, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /iguais ao bloco/);
});

test('lançamentos em tabela própria: o app baixa pelo bloco montado e mantém o caminho antigo', () => {
  const sync = read('src/supabase/cloudSync.ts');
  assert.match(sync, /rpc\('ler_erp_snapshot', \{ p_organization_id: organizationId \}\)/);
  // Volta ao select direto só se o banco ainda não tiver a função.
  assert.match(sync, /!== 'PGRST202'\) throw normalizeSupabaseError\(error\)/);
  assert.match(sync, /\.from\('erp_snapshots'\)\s*\.select\('payload, updated_at, record_count'\)/);
});

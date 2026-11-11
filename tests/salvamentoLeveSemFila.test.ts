import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ARQUIVO = '202611110001_salvamento_leve_sem_fila.sql';
const migration = read(`supabase/migrations/${ARQUIVO}`);

test('salvamento leve: bloco em lz4 e fila curta nas duas funções de envio', () => {
  assert.match(migration, /alter table public\.erp_snapshots alter column payload set compression lz4/);
  assert.match(migration, /alter table public\.erp_snapshot_history alter column payload set compression lz4/);
  for (const assinatura of ['apply_erp_snapshot_changes\\(text, jsonb\\)', 'publish_erp_snapshot\\(text, timestamptz, jsonb\\)']) {
    assert.match(migration, new RegExp(`alter function public\\.${assinatura} set lock_timeout = '5s'`));
    assert.match(migration, new RegExp(`alter function public\\.${assinatura} set work_mem = '32MB'`));
  }
});

test('salvamento leve: não mexe no corpo das funções nem apaga dado', () => {
  const comandos = migration.split('\n').filter(linha => !linha.trimStart().startsWith('--')).join('\n');
  assert.doesNotMatch(comandos, /create or replace function/);
  assert.doesNotMatch(comandos, /\b(delete from|drop table|truncate)\b/i);
});

test('salvamento leve: migração que recriar as funções de envio repete a configuração', () => {
  const depois = readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .filter(nome => nome > ARQUIVO && nome.endsWith('.sql'));
  for (const nome of depois) {
    const sql = read(`supabase/migrations/${nome}`);
    for (const funcao of ['apply_erp_snapshot_changes', 'publish_erp_snapshot']) {
      if (!new RegExp(`create or replace function public\\.${funcao}\\(`).test(sql)) continue;
      assert.match(sql, new RegExp(`alter function public\\.${funcao}\\([^)]*\\) set lock_timeout`), `${nome} recria ${funcao} e perde o lock_timeout`);
      assert.match(sql, new RegExp(`alter function public\\.${funcao}\\([^)]*\\) set work_mem`), `${nome} recria ${funcao} e perde o work_mem`);
    }
  }
});

// Com um Postgres de teste (todas as migrações aplicadas), confere o que valeu.
test('salvamento leve: configuração no banco de teste', { skip: !process.env.PG_TEST_URL && 'sem PG_TEST_URL' }, () => {
  const consulta = `select (select count(*) from pg_proc where proname in ('apply_erp_snapshot_changes','publish_erp_snapshot')
      and proconfig @> array['lock_timeout=5s','work_mem=32MB']) as funcoes,
    (select count(*) from pg_attribute where attname = 'payload' and attcompression = 'l'
      and attrelid in ('public.erp_snapshots'::regclass, 'public.erp_snapshot_history'::regclass)) as colunas`;
  const run = spawnSync('psql', [String(process.env.PG_TEST_URL), '-Atc', consulta], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), '2|2');
});

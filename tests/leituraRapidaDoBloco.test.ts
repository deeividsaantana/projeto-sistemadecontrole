import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202611160001_leitura_rapida_do_bloco.sql');

const funcao = (arquivo: string, nome: string) => {
  const sql = read(`supabase/migrations/${arquivo}`);
  const inicio = sql.indexOf(`create or replace function public.${nome}(`);
  const fim = sql.indexOf('$$;', sql.indexOf('as $$', inicio)) + 3;
  assert.ok(inicio >= 0 && fim > inicio, `${nome} não encontrada em ${arquivo}`);
  return sql.slice(inicio, fim).replace(`public.${nome}(`, `public.${nome}_antiga(`);
};

test('leitura rápida do bloco: o bloco não é consultado linha por linha', () => {
  // A pergunta "o bloco tem a coleção?" dentro do where lia o bloco de 4 MB a cada registro (25 s em produção).
  for (const nome of ['erp_montar_bloco', 'erp_contar_separados']) {
    const corpo = funcao('202611160001_leitura_rapida_do_bloco.sql', nome);
    assert.doesNotMatch(corpo, /p_payload \? registro\.colecao/, nome);
    assert.match(corpo, /registro\.colecao = any\(v_fora\)/, nome);
  }
  assert.match(migration, /revoke all on function public\.erp_montar_bloco\(text, jsonb\) from public, anon, authenticated;/);
});

test('leitura rápida do bloco: mesmo resultado da versão anterior', { skip: !process.env.PG_TEST_URL && 'sem PG_TEST_URL' }, () => {
  const roteiro = [
    'begin;',
    funcao('202611150003_lancamentos_em_tabela_propria.sql', 'erp_montar_bloco'),
    funcao('202611150003_lancamentos_em_tabela_propria.sql', 'erp_contar_separados'),
    '\\i tests/sql/leituraRapidaDoBloco.sql',
    'rollback;',
  ].join('\n');
  const run = spawnSync('psql', [String(process.env.PG_TEST_URL), '-v', 'ON_ERROR_STOP=1'], { input: roteiro, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /leitura igual à anterior/);
});

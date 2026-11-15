import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202611150002_salvamento_mais_rapido.sql');
const comandos = migration.split('\n').filter(linha => !linha.trimStart().startsWith('--')).join('\n');

test('salvamento mais rápido: bloco refeito uma vez e marcas lidas uma vez', () => {
  // Nada de jsonb_set no laço: o bloco inteiro entra de uma vez no fim.
  assert.doesNotMatch(comandos, /jsonb_set\(v_payload/);
  assert.match(comandos, /v_payload := v_payload \|\| v_novas;/);
  // Marcas ativas: uma consulta só, guardada para as outras tabelas.
  assert.equal(comandos.match(/jsonb_array_elements\(coalesce\(v_novas->'exclusoes'/g)?.length, 1);
  assert.match(comandos, /v_ativas is null/);
  // Contagem pela diferença.
  assert.match(comandos, /v_record_count := v_contagem \+ v_diferenca/);
});

test('salvamento mais rápido: mantém as travas, a fila curta e não apaga dado', () => {
  assert.match(comandos, /erp_recusar_encolhimento\(v_original, v_payload, v_com_saida\)/);
  assert.match(comandos, /erp_recusar_por_perfil\(p_organization_id, v_original, v_payload\)/);
  assert.match(comandos, /when v_tabela in \('exclusoes', 'historyLogs', 'presencasLink'\) then array\[\]::text\[\]/);
  assert.doesNotMatch(comandos, /\b(delete from|drop table|truncate)\b/i);
});

// Com um Postgres de teste (todas as migrações aplicadas), compara com a função antiga.
test('salvamento mais rápido: mesmo resultado da função antiga', { skip: !process.env.PG_TEST_URL && 'sem PG_TEST_URL' }, () => {
  const anterior = read('supabase/migrations/202611040003_publicacao_por_perfil.sql');
  const inicio = anterior.indexOf('create or replace function public.apply_erp_snapshot_changes(');
  const fim = anterior.indexOf('$$;', anterior.indexOf('as $$', inicio)) + 3;
  assert.ok(inicio > 0 && fim > inicio, 'função antiga não encontrada');
  const antiga = anterior.slice(inicio, fim).replace('public.apply_erp_snapshot_changes(', 'public.apply_erp_snapshot_changes_antiga(');
  const roteiro = `begin;\n${antiga}\n\\i tests/sql/salvamentoMaisRapido.sql\nrollback;\n`;
  const run = spawnSync('psql', [String(process.env.PG_TEST_URL), '-v', 'ON_ERROR_STOP=1'], { input: roteiro, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /igual à função antiga/);
});

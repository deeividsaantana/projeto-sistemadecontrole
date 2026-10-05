import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tela = readFileSync(new URL('../src/components/ControlePresencaTab.tsx', import.meta.url), 'utf8');

test('editar equipe abre a lista só com os colaboradores ativos da equipe', () => {
  assert.match(tela, /setMembrosAoAbrir\(safeIds\(normalizeGroup\(group\)\.funcionarioIds\)\)/);
  assert.match(tela, /filter\(employee => !membrosAoAbrir \|\| membrosAoAbrir\.includes\(employee\.id\)\)/);
  assert.match(tela, />Todos ativos</);
});

test('equipe nova continua mostrando todo o efetivo ativo', () => {
  assert.match(tela, /setEditingGroupId\(null\);\n\s*setMembrosAoAbrir\(null\);/);
});

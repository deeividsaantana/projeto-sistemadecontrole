import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IMPORTED_AUG2026_ABASTECIMENTOS,
  IMPORTED_AUG2026_CONTROLE_ESTACAS,
  IMPORTED_AUG2026_EQUIPAMENTOS,
  IMPORTED_AUG2026_TICKETS_JAZIDA,
} from '../src/utils/importedAugust2026Seed';

test('importação de agosto preserva todas as linhas operacionais reconciliadas', () => {
  assert.equal(IMPORTED_AUG2026_ABASTECIMENTOS.length, 793);
  assert.equal(IMPORTED_AUG2026_TICKETS_JAZIDA.length, 594);
  assert.equal(IMPORTED_AUG2026_EQUIPAMENTOS.length, 202);
  assert.equal(IMPORTED_AUG2026_CONTROLE_ESTACAS.lotes.length, 16);
  assert.equal(IMPORTED_AUG2026_CONTROLE_ESTACAS.cravacoes.length, 51);
  assert.equal(
    IMPORTED_AUG2026_ABASTECIMENTOS.reduce((total, item) => total + item.quantidadeLitros, 0),
    86048,
  );
});

test('linhas incompletas de combustível permanecem disponíveis para conferência', () => {
  const reviewRows = IMPORTED_AUG2026_ABASTECIMENTOS.filter(item => item.status === 'Conferência necessária');
  assert.equal(reviewRows.length, 114);
  assert.ok(reviewRows.every(item => item.integracaoArquivo && item.integracaoAba && item.integracaoLinha));
});

test('identificadores importados são estáveis e únicos por módulo', () => {
  const assertUnique = (items: Array<{ id: string }>) => assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assertUnique(IMPORTED_AUG2026_ABASTECIMENTOS);
  assertUnique(IMPORTED_AUG2026_TICKETS_JAZIDA);
  assertUnique(IMPORTED_AUG2026_EQUIPAMENTOS);
  assertUnique(IMPORTED_AUG2026_CONTROLE_ESTACAS.lotes);
  assertUnique(IMPORTED_AUG2026_CONTROLE_ESTACAS.cravacoes);
});

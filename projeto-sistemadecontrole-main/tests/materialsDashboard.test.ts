import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeMaterialsStock } from '../src/utils/materialsDashboard';

test('dashboard de materiais resume cobertura sem duplicar situações', () => {
  assert.deepEqual(summarizeMaterialsStock([
    { saldo: 12, abaixoDoMinimo: false },
    { saldo: 2, abaixoDoMinimo: true },
    { saldo: 0, abaixoDoMinimo: true },
  ]), {
    total: 3,
    regulares: 1,
    abaixoDoMinimo: 1,
    semSaldo: 1,
    coberturaPercentual: 33,
  });
});

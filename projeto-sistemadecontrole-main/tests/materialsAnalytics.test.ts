import assert from 'node:assert/strict';
import test from 'node:test';
import type { MovimentoMaterial } from '../src/types';
import { buildMaterialsOperationalSummary, getDefaultMaterialsPeriod } from '../src/utils/materialsAnalytics';

const movimento = (extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id: `mov-${Math.random()}`,
  data: '2026-09-10',
  tipo: 'Entrada',
  materialId: 'mat-bica',
  materialDescricao: 'BICA CORRIDA',
  quantidade: 10,
  unidade: 'TON',
  fornecedorNome: 'PEDRA FORTE',
  destino: 'BASE DE REFORCO 1300',
  responsavel: 'Almoxarife',
  criadoEm: '2026-09-10T10:00:00.000Z',
  ...extra,
});

test('resumo operacional filtra por periodo, material, fornecedor e local', () => {
  const summary = buildMaterialsOperationalSummary([
    movimento({ id: 'a', quantidade: 29.83, valorUnitario: 79.5, valorTotal: 2371.49, placa: 'UFW-0D22', ticket: '173353' }),
    movimento({ id: 'b', quantidade: 24.78, materialId: 'mat-rachao', materialDescricao: 'RACHAO PRIMARIO', destino: 'RAMO 1300' }),
    movimento({ id: 'c', data: '2025-12-31', quantidade: 99 }),
    movimento({ id: 'd', fornecedorNome: 'EMBU', destino: 'ESTOQUE RAMO 900', quantidade: 30 }),
  ], {
    from: '2026-09-01',
    to: '2026-09-30',
    material: 'bica',
    fornecedor: 'pedra',
    local: 'base reforco',
  });

  assert.equal(summary.filteredMovements.length, 1);
  assert.equal(summary.totals.quantidade, 29.83);
  assert.equal(summary.totals.valorTotal, 2371.49);
  assert.equal(summary.materials[0].material, 'BICA CORRIDA');
  assert.equal(summary.materials[0].toneladas, 29.83);
  assert.equal(summary.locations[0].local, 'BASE DE REFORCO 1300');
  assert.equal(summary.suppliers[0].fornecedor, 'PEDRA FORTE');
});

test('periodo padrao cobre o mes do dia informado', () => {
  assert.deepEqual(getDefaultMaterialsPeriod('2026-09-23'), {
    from: '2026-09-01',
    to: '2026-09-30',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { MovimentoMaterial } from '../src/types';
import { buildMaterialsFlow, summarizeMaterialsStock } from '../src/utils/materialsDashboard';

const movimento = (data: string, tipo: MovimentoMaterial['tipo'], quantidade: number): MovimentoMaterial => ({
  id: `${data}-${tipo}-${quantidade}`,
  data,
  tipo,
  materialId: 'mat-1',
  materialDescricao: 'Solo',
  quantidade,
  unidade: 'm³',
  responsavel: 'Operação',
  criadoEm: `${data}T12:00:00.000Z`,
});

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

test('gráfico de fluxo mostra sete dias e separa entradas de saídas', () => {
  const flow = buildMaterialsFlow([
    movimento('2026-09-20', 'Entrada', 10),
    movimento('2026-09-20', 'Saída', 4),
    movimento('2026-09-21', 'Ajuste', -2),
    movimento('2026-09-21', 'Transferência', 3),
  ], '2026-09-21');

  assert.equal(flow.length, 7);
  assert.deepEqual(flow.at(-2), { date: '2026-09-20', label: '20/09', entradas: 10, saidas: 4, transferencias: 0 });
  assert.deepEqual(flow.at(-1), { date: '2026-09-21', label: '21/09', entradas: 0, saidas: 2, transferencias: 3 });
});

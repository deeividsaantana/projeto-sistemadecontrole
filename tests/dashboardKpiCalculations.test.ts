import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDashboardKpis } from '../src/utils/dashboardOperational';

test('Dashboard KPI calculations', async (suite) => {
  const mockData = {
    obras: [
      { id: 'obra-1', empresa_id: 'emp-1', nome: 'Obra A', data_inicio: '2026-01-01', status: 'em-andamento' },
      { id: 'obra-2', empresa_id: 'emp-1', nome: 'Obra B', data_inicio: '2026-06-01', status: 'em-andamento' },
    ],
    equipamentos: [
      { id: 'eq-1', tipo: 'Escavadeira', status: 'operacional' },
      { id: 'eq-2', tipo: 'Basculante', status: 'parado' },
      { id: 'eq-3', tipo: 'Escavadeira', status: 'operacional' },
    ],
    producao: [
      { id: 'p-1', obra_id: 'obra-1', data: '2026-09-15', valor: 100 },
      { id: 'p-2', obra_id: 'obra-1', data: '2026-09-20', valor: 150 },
    ],
  };

  await suite.test('obrasAbertas conta obras com status em-andamento', () => {
    const periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    const kpis = calculateDashboardKpis(mockData.obras as any, mockData.equipamentos as any, mockData.producao as any, periodo);
    assert.strictEqual(kpis.obrasAbertas, 2);
  });

  await suite.test('equipamentosAtivos conta equipamentos operacionais', () => {
    const periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    const kpis = calculateDashboardKpis(mockData.obras as any, mockData.equipamentos as any, mockData.producao as any, periodo);
    assert.strictEqual(kpis.equipamentosAtivos, 2);
  });

  await suite.test('producaoMes soma valor no período selecionado', () => {
    const periodo = { inicio: '2026-09-01', fim: '2026-09-30' };
    const kpis = calculateDashboardKpis(mockData.obras as any, mockData.equipamentos as any, mockData.producao as any, periodo);
    assert.strictEqual(kpis.producaoMes, 250);
  });
});

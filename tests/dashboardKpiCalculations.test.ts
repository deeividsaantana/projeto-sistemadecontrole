import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDashboardKpis } from '../src/utils/dashboardOperational';

test('Dashboard KPI calculations', async (suite) => {
  const mockData = {
    obras: [
      { id: 'obra-1', empresa_id: 'emp-1', nome: 'Obra A', endereco: 'Rua A', responsavel: 'João', status: 'Ativa' },
      { id: 'obra-2', empresa_id: 'emp-1', nome: 'Obra B', endereco: 'Rua B', responsavel: 'Maria', status: 'Ativa' },
    ],
    equipamentos: [
      { id: 'eq-1', prefixo: 'EQ-001', tipo: 'Escavadeira', nome: 'Escavadeira 1', status: 'Ativo' },
      { id: 'eq-2', prefixo: 'EQ-002', tipo: 'Basculante', nome: 'Basculante 1', status: 'Parado' },
      { id: 'eq-3', prefixo: 'EQ-003', tipo: 'Escavadeira', nome: 'Escavadeira 2', status: 'Ativo' },
    ],
    producao: [
      { id: 'p-1', obra_id: 'obra-1', data: '2026-09-15', quantidade: 100, servicoDescricao: 'Terraplenagem', unidade: 'm³', responsavel: 'João', ativo: true, criadoEm: '2026-09-15', atualizadoEm: '2026-09-15', servicoId: 's-1' },
      { id: 'p-2', obra_id: 'obra-1', data: '2026-09-20', quantidade: 150, servicoDescricao: 'Terraplenagem', unidade: 'm³', responsavel: 'João', ativo: true, criadoEm: '2026-09-20', atualizadoEm: '2026-09-20', servicoId: 's-1' },
    ],
  };

  await suite.test('obrasAbertas conta obras com status Ativa', () => {
    const periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    const kpis = calculateDashboardKpis(mockData.obras as any, mockData.equipamentos as any, mockData.producao as any, periodo);
    assert.strictEqual(kpis.obrasAbertas, 2);
  });

  await suite.test('equipamentosAtivos conta equipamentos com status Ativo', () => {
    const periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    const kpis = calculateDashboardKpis(mockData.obras as any, mockData.equipamentos as any, mockData.producao as any, periodo);
    assert.strictEqual(kpis.equipamentosAtivos, 2);
  });

  await suite.test('producaoMes soma quantidade no período selecionado', () => {
    const periodo = { inicio: '2026-09-01', fim: '2026-09-30' };
    const kpis = calculateDashboardKpis(mockData.obras as any, mockData.equipamentos as any, mockData.producao as any, periodo);
    assert.strictEqual(kpis.producaoMes, 250);
  });
});

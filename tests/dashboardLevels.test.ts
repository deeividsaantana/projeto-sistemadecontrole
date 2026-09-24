import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLevel1 } from '../src/utils/dashboardMetrics';

test('Dashboard Level1: calculateLevel1', async (suite) => {
  await suite.test('should calculate KPIs from obras, equipamentos, producao', () => {
    const obras = [
      { id: '1', nome: 'Obra A', status: 'Ativa' } as any,
      { id: '2', nome: 'Obra B', status: 'Pausada' } as any,
    ];
    const equipamentos = [
      { id: '1', nome: 'Escavadeira', status: 'Ativo' } as any,
      { id: '2', nome: 'Trator', status: 'Parado' } as any,
    ];
    const producao = [
      { id: '1', data: '2026-09-20', quantidade: 100 } as any,
      { id: '2', data: '2026-09-21', quantidade: 150 } as any,
    ];
    const periodo = { inicio: '2026-09-01', fim: '2026-09-30' };

    const result = calculateLevel1(obras, equipamentos, producao, periodo);

    assert.strictEqual(result.obrasAbertas, 1, 'Should count Ativa obras');
    assert.strictEqual(result.equipamentosAtivos, 1, 'Should count Ativo equipamentos');
    assert.strictEqual(result.equipamentosParados, 1, 'Should count Parado equipamentos');
    assert.strictEqual(result.producaoMes, 250, 'Should sum production in period');
    assert.strictEqual(result.taxaAtividade, 50, 'Should calculate activity rate');
  });
});

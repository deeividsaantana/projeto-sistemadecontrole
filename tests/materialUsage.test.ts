import assert from 'node:assert/strict';
import test from 'node:test';
import type { Material, MovimentoMaterial } from '../src/types';
import { materialUsageByBranch } from '../src/modules/materials/materialUsage';

const material = (id: string, descricao: string): Material => ({ id, codigo: id, descricao, categoria: '', unidade: 'un', ativo: true, criadoEm: '', atualizadoEm: '' });
const movement = (id: string, tipo: MovimentoMaterial['tipo'], quantidade: number, materialId = 'tubo', etapaServicoId = 'ramo-1400'): MovimentoMaterial => ({
  id, data: '2026-09-24', tipo, materialId, materialDescricao: materialId, quantidade, unidade: 'un', responsavel: 'Equipe', criadoEm: id,
  etapaServicoId, etapaServicoNome: etapaServicoId === 'ramo-1400' ? 'Ramo 1400' : 'Ramo 1500',
  finalidade: tipo === 'Saída' ? 'Consumo' : undefined,
});

test('60 tubos recebidos e 50 usados no ramo 1400 resultam em 83,3% e 10 a utilizar', () => {
  const rows = materialUsageByBranch([material('tubo', 'Tubo Ø800 de 1,50 m')], [movement('e1', 'Entrada', 60), movement('s1', 'Saída', 20), movement('s2', 'Saída', 30)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].received, 60);
  assert.equal(rows[0].used, 50);
  assert.equal(rows[0].remaining, 10);
  assert.equal(rows[0].percent, 83.3);
});

test('outro ramo, outro material e saída sem finalidade não alteram a utilização', () => {
  const rows = materialUsageByBranch([material('tubo', 'Tubo'), material('brita', 'Brita')], [
    movement('e1', 'Entrada', 60), movement('s1', 'Saída', 50),
    movement('e2', 'Entrada', 10, 'tubo', 'ramo-1500'),
    movement('e3', 'Entrada', 100, 'brita'),
    { ...movement('s2', 'Saída', 3), finalidade: undefined },
  ]);
  assert.equal(rows.find(row => row.materialId === 'tubo' && row.branchId === 'ramo-1400')?.percent, 83.3);
  assert.equal(rows.find(row => row.materialId === 'tubo' && row.branchId === 'ramo-1500')?.used, 0);
});

test('sem entrada vinculada percentual é desconhecido, e excesso continua visível', () => {
  const rows = materialUsageByBranch([material('tubo', 'Tubo')], [movement('s1', 'Saída', 5)]);
  assert.equal(rows[0].received, 0);
  assert.equal(rows[0].percent, null);
  const excess = materialUsageByBranch([material('tubo', 'Tubo')], [movement('e1', 'Entrada', 4), movement('s1', 'Saída', 5)]);
  assert.equal(excess[0].percent, 125);
  assert.equal(excess[0].remaining, -1);
});

test('histórico sem ramo não é atribuído pelo nome textual do destino', () => {
  const legacy = { ...movement('e1', 'Entrada', 60), etapaServicoId: undefined, etapaServicoNome: undefined, destino: 'Ramo 1400' };
  assert.deepEqual(materialUsageByBranch([material('tubo', 'Tubo')], [legacy]), []);
});

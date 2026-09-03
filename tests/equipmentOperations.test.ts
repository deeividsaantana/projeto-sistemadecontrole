import assert from 'node:assert/strict';
import type {
  Equipamento,
  OrdemServico,
} from '../src/types';
import {
  buildEquipmentOperationalSummaries,
  calculateAvailabilityPercent,
  inferFleetCategory,
  normalizeAvailabilityTarget,
  validateEquipmentMasterRecord,
} from '../src/utils/equipmentOperations';

const equipment = (overrides: Partial<Equipamento> = {}): Equipamento => ({
  id: 'eq-1',
  prefixo: 'CB726',
  nome: 'Caminhão Basculante',
  tipo: 'Caminhão',
  marca: 'Volvo',
  modelo: 'VM',
  seriePlaca: '',
  placa: 'EFO7532',
  empresaId: 'empresa-1',
  status: 'Ativo',
  localAtualId: 'obra-1',
  observacao: '',
  categoriaFrota: 'Veículo',
  metaDisponibilidade: 80,
  ...overrides,
});


const workOrder: OrdemServico = {
  id: 'os-1',
  numero: 'OS-0001',
  equipamentoId: 'eq-1',
  tipo: 'Corretiva',
  prioridade: 'Alta',
  descricao: 'Reparo hidráulico',
  status: 'Em Andamento',
  dataAbertura: '2026-07-30',
  responsavel: 'Manutenção',
  observacao: '',
};

assert.equal(normalizeAvailabilityTarget('0,8'), 80);
assert.equal(normalizeAvailabilityTarget('85%'), 85);
assert.equal(calculateAvailabilityPercent(8, 2), 80);
assert.equal(inferFleetCategory('Carreta', 'Carreta Prancha', '', 'equipment'), 'Implemento');
assert.equal(inferFleetCategory('Caminhão', 'Basculantes', 'ABC1234', 'vehicles'), 'Veículo');

const validation = validateEquipmentMasterRecord(equipment({
  capacidadeTanqueLitros: -1,
  dataMobilizacao: '2026-08-10',
  dataDesmobilizacao: '2026-08-01',
}));
assert.equal(validation.errors.length, 2);

// A disponibilidade passa a vir apenas do cadastro do equipamento; o histórico
// de partes diárias, que era a segunda fonte, foi removido do sistema.
const summaries = buildEquipmentOperationalSummaries(
  [equipment({ horasDisponiveis: 80, horasIndisponiveis: 20, operadorResponsavelNome: 'Wedley' })],
  [workOrder],
);
assert.equal(summaries.length, 1);
assert.equal(summaries[0].availabilityPercent, 80);
assert.equal(summaries[0].availabilitySource, 'Cadastro');
assert.equal(summaries[0].openWorkOrders, 1);
assert.equal(summaries[0].responsibleOperator, 'Wedley');

// Sem horas no cadastro nao ha como calcular disponibilidade.
const semDados = buildEquipmentOperationalSummaries([equipment()], []);
assert.equal(semDados[0].availabilityPercent, null);
assert.equal(semDados[0].availabilitySource, 'Sem dados');

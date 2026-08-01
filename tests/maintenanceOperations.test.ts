import assert from 'node:assert/strict';
import type { Equipamento, OrdemServico, ParteDiariaEquipamento } from '../src/types';
import {
  buildMaintenanceFleetSummaries,
  deriveWorkOrderMetrics,
} from '../src/utils/equipmentOperations';

const equipment: Equipamento = {
  id: 'eq-maintenance',
  prefixo: 'ESC-01',
  nome: 'Escavadeira hidráulica',
  tipo: 'Escavadeira',
  marca: 'CAT',
  modelo: '320',
  seriePlaca: 'SERIE-01',
  empresaId: 'empresa-1',
  status: 'Manutenção',
  localAtualId: 'obra-1',
  observacao: '',
  operadorResponsavelId: 'motorista-1',
  operadorResponsavelNome: 'Maria Operadora',
  metaDisponibilidade: 85,
};

const order: OrdemServico = {
  id: 'os-maintenance',
  numero: 'OS-0100',
  equipamentoId: equipment.id,
  tipo: 'Corretiva',
  prioridade: 'Alta',
  descricao: 'Reparo do sistema hidráulico',
  status: 'Em Andamento',
  dataAbertura: '2026-08-01',
  responsavel: 'Oficina',
  observacao: '',
  horimetroEntrada: 1200,
  horimetroSaida: 1210,
  horasEquipamento: 20,
  horasParadas: 5,
};

const dailyPart: ParteDiariaEquipamento = {
  id: 'parte-maintenance',
  numero: 'PD-01',
  data: '2026-08-01',
  obraId: 'obra-1',
  obraNome: 'Complexo Alto Tietê',
  equipamentoId: equipment.id,
  prefixo: equipment.prefixo,
  tipoEquipamento: equipment.tipo,
  jornada: 10,
  operadorId: 'motorista-2',
  operadorNome: 'Operador anterior',
  matricula: '100',
  apontador: '',
  encarregado: '',
  horimetroInicial: 1190,
  horimetroFinal: 1198,
  totalHorasTrabalhadas: 8,
  atividades: [],
  transportes: [],
  checklist: [],
  outrosProblemas: '',
  status: 'Conferido',
  observacao: '',
  criadoEm: '2026-08-01T08:00:00.000Z',
  atualizadoEm: '2026-08-01T18:00:00.000Z',
};

const metrics = deriveWorkOrderMetrics(order);
assert.equal(metrics.machineHours, 10);
assert.equal(metrics.equipmentHours, 20);
assert.equal(metrics.stoppedHours, 5);
assert.equal(metrics.availabilityPercent, 75);

const summaries = buildMaintenanceFleetSummaries([equipment], [dailyPart], [order]);
assert.equal(summaries.length, 1);
assert.equal(summaries[0].driverName, 'Maria Operadora');
assert.equal(summaries[0].driverId, 'motorista-1');
assert.equal(summaries[0].activeWorkOrder?.numero, 'OS-0100');
assert.equal(summaries[0].maintenanceAvailabilityPercent, 75);
assert.equal(summaries[0].belowTarget, true);


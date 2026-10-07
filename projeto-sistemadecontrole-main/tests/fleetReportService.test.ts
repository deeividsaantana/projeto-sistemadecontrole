import assert from 'node:assert/strict';
import type {
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  Funcionario,
} from '../src/types';
import {
  FLEET_OPERATIONAL_STATUS,
  createEmptyFleetFilters,
  type FleetDataContext,
} from '../src/fleet/domain';
import {
  calculateFleetMetrics,
  createFleetReportViewModel,
  filterFleetStates,
  getAvailabilityRate,
  getAvailableCBs,
  getMaintenanceCBs,
  getOperatingCBs,
  getStoppedHours,
  getTotalCBs,
} from '../src/fleet/reportService';

const company: Empresa = {
  id: 'renea',
  nome: 'RENEA INFRAESTRUTURA S.A.',
  cnpj: '',
  telefone: '',
  responsavel: '',
  status: 'ATIVO',
};

const employees: Funcionario[] = Array.from({ length: 32 }, (_, index) => ({
  id: `driver-${index + 1}`,
  matricula: String(103_177 + index),
  nome: `Motorista ${index + 1}`,
  cargo: 'Motorista',
  telefone: '',
  empresaId: company.id,
  ativo: true,
  status: 'ATIVO' as const,
}));

const equipment: Equipamento[] = Array.from({ length: 32 }, (_, index) => ({
  id: `equipment-${index + 1}`,
  prefixo: `CB${770 + index}`,
  nome: 'Caminhão Basculante',
  tipo: 'Caminhão Basculante',
  marca: 'Teste',
  modelo: 'Teste',
  seriePlaca: `ABC${String(index).padStart(4, '0')}`,
  empresaId: company.id,
  status: 'Ativo' as const,
  localAtualId: 'alto-tiete',
  observacao: '',
  familia: 'Basculantes',
}));

const statusForIndex = (index: number): ControleEquipamentoDiario['status'] => {
  if (index < 25) return 'Em operação';
  if (index < 30) return 'Em manutenção';
  if (index === 30) return 'Disponível';
  return 'A confirmar';
};

const records: ControleEquipamentoDiario[] = equipment.map((truck, index) => ({
  id: `record-${index + 1}`,
  chave: `2026-08-12|${truck.id}`,
  data: '2026-08-12',
  funcionarioId: employees[index].id,
  codigoFuncionario: employees[index].matricula || '',
  nomeMotorista: employees[index].nome,
  equipamentoId: truck.id,
  prefixo: truck.prefixo,
  familia: 'Basculantes',
  status: statusForIndex(index),
  horaSaida: index < 25 ? '07:59' : '',
  horaEntradaManutencao: index >= 25 && index < 30 ? '08:00' : '',
  horaLiberacao: index === 25 ? '13:54' : '',
  observacao: index === 25 ? 'Parada controlada de 05:54.' : '',
  origem: 'SISTEMA',
  revisao: [],
  criadoEm: '2026-08-12T07:00:00-03:00',
  atualizadoEm: '2026-08-12T14:00:00-03:00',
}));

const context: FleetDataContext = {
  records,
  equipment,
  employees,
  companies: [company],
  teams: [],
  maintenanceOrders: [],
};

const filters = createEmptyFleetFilters('2026-08-12');
const report = createFleetReportViewModel(
  context,
  filters,
  new Date('2026-08-12T14:00:00-03:00'),
);

assert.equal(report.metrics.total, 32);
assert.equal(report.metrics.operating, 25);
assert.equal(report.metrics.maintenance, 5);
assert.equal(report.metrics.available, 1);
assert.equal(report.metrics.pending, 1);
assert.equal(report.metrics.operating + report.metrics.maintenance + report.metrics.available + report.metrics.pending, 32);
assert.equal(report.metrics.integrityDifference, 0);
assert.equal(report.operating.length, 25);
assert.equal(report.maintenance.length, 5);
assert.equal(report.available.length, 1);
assert.equal(report.pending.length, 1);
assert.equal(report.companyLabel, 'RENEA INFRAESTRUTURA S.A.');
assert.equal(getTotalCBs(report), 32);
assert.equal(getOperatingCBs(report), 25);
assert.equal(getMaintenanceCBs(report), 5);
assert.equal(getAvailableCBs(report), 1);
assert.equal(getStoppedHours(report) >= 5.9, true);
assert.equal(getAvailabilityRate(report), (26 / 32) * 100);

const maintenanceOnly = filterFleetStates(report.allRows, {
  ...filters,
  status: FLEET_OPERATIONAL_STATUS.maintenance,
});
assert.equal(maintenanceOnly.length, 5);

const normalizedSearch = filterFleetStates(report.allRows, {
  ...filters,
  search: 'cb 770',
});
assert.equal(normalizedSearch.length, 1);
assert.equal(normalizedSearch[0].equipment.prefix, 'CB770');

const emptyMetrics = calculateFleetMetrics([]);
assert.equal(emptyMetrics.total, 0);
assert.equal(emptyMetrics.stoppedDurationLabel, '—');

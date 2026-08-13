import assert from 'node:assert/strict';
import type { FleetDataContext, FleetImportRawRow } from '../src/fleet/domain';
import { applyFleetImport, previewFleetImport } from '../src/fleet/importService';
import type { Empresa, Equipamento, Funcionario } from '../src/types';

const company: Empresa = {
  id: 'company',
  nome: 'RENEA',
  cnpj: '',
  telefone: '',
  responsavel: '',
  status: 'ATIVO',
};
const driver: Funcionario = {
  id: 'driver',
  matricula: '103177',
  nome: 'Adilson Pires da Cruz',
  cargo: 'Motorista',
  telefone: '',
  empresaId: company.id,
  ativo: true,
  status: 'ATIVO',
};
const truck: Equipamento = {
  id: 'truck',
  prefixo: 'CB770',
  nome: 'Caminhão Basculante',
  tipo: 'Caminhão Basculante',
  marca: '',
  modelo: '',
  seriePlaca: 'ABC1D23',
  empresaId: company.id,
  status: 'Ativo',
  localAtualId: '',
  observacao: '',
  familia: 'Basculantes',
};
const baseContext: FleetDataContext = {
  records: [],
  equipment: [truck],
  employees: [driver],
  companies: [company],
  teams: [],
  maintenanceOrders: [],
};
const rawRows: FleetImportRawRow[] = [
  {
    rowNumber: 7,
    date: '12/08/2026',
    employeeCode: ' 103177 ',
    employeeName: 'Adilson Pires da Cruz',
    prefix: 'CB-770',
    plate: 'ABC-1D23',
    status: 'Em operação',
    departureTime: '07:59',
    note: 'Operação normal.',
  },
  {
    rowNumber: 8,
    date: '12/08/2026',
    employeeCode: '103177',
    prefix: 'CB 770',
    status: 'Em operação',
    departureTime: '07:59',
  },
  {
    rowNumber: 9,
    date: 'data inválida',
    prefix: 'CB770',
  },
];

const firstPreview = previewFleetImport(
  rawRows,
  baseContext,
  new Date('2026-08-12T15:00:00.000Z'),
);
assert.equal(firstPreview.newCount, 1);
assert.equal(firstPreview.duplicateCount, 1);
assert.equal(firstPreview.errorCount, 1);
assert.equal(firstPreview.canApply, true);
assert.equal(firstPreview.rows[0].record?.funcionarioId, driver.id);
assert.equal(firstPreview.rows[0].record?.equipamentoId, truck.id);

const firstApplication = applyFleetImport(
  [],
  firstPreview,
  new Date('2026-08-12T15:01:00.000Z'),
);
assert.equal(firstApplication.created, 1);
assert.equal(firstApplication.updated, 0);
assert.equal(firstApplication.duplicates, 1);
assert.equal(firstApplication.errors, 1);
assert.equal(firstApplication.next.length, 1);

const secondContext: FleetDataContext = {
  ...baseContext,
  records: firstApplication.next,
};
const secondPreview = previewFleetImport(
  rawRows.slice(0, 1),
  secondContext,
  new Date('2026-08-12T15:02:00.000Z'),
);
assert.equal(secondPreview.newCount, 0);
assert.equal(secondPreview.updateCount, 0);
assert.equal(secondPreview.duplicateCount, 1);
assert.equal(secondPreview.canApply, false);

const changedRows: FleetImportRawRow[] = [{
  ...rawRows[0],
  note: 'Observação revisada.',
}];
const updatePreview = previewFleetImport(
  changedRows,
  secondContext,
  new Date('2026-08-12T15:03:00.000Z'),
);
assert.equal(updatePreview.updateCount, 1);
const updateApplication = applyFleetImport(
  secondContext.records,
  updatePreview,
  new Date('2026-08-12T15:04:00.000Z'),
);
assert.equal(updateApplication.created, 0);
assert.equal(updateApplication.updated, 1);
assert.equal(updateApplication.next.length, 1);
assert.equal(updateApplication.next[0].observacao, 'Observação revisada.');
assert.equal(updateApplication.next[0].id, firstApplication.next[0].id);

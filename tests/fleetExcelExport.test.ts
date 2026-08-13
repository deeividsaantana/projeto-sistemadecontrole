import assert from 'node:assert/strict';
import type { FleetReportViewModel } from '../src/fleet/domain';
import { buildFleetWorkbook } from '../src/fleet/excelExport';

const viewModel: FleetReportViewModel = {
  generatedAt: '2026-08-12T14:00:00-03:00',
  reportDate: '2026-08-12',
  reportDateLabel: '12/08/2026',
  operationName: 'Operação - Alto Tietê',
  companyLabel: 'RENEA INFRAESTRUTURA S.A.',
  filters: {
    date: '2026-08-12',
    companyId: 'Todos',
    status: 'Todos',
    prefix: '',
    driver: '',
    search: '',
  },
  metrics: {
    total: 1,
    operating: 1,
    maintenance: 0,
    available: 0,
    waitingDriver: 0,
    unavailable: 0,
    waitingMaintenance: 0,
    stopped: 0,
    unclassified: 0,
    stoppedMinutes: 54,
    stoppedDurationLabel: '00:54',
    availabilityRate: 100,
    operatingRate: 100,
    classifiedTotal: 1,
    integrityDifference: 0,
  },
  allRows: [],
  operating: [],
  maintenance: [],
  available: [],
  waitingDriver: [],
  other: [],
  sections: [],
  history: [],
  integrityWarnings: [],
};

const workbook = buildFleetWorkbook(viewModel);
assert.deepEqual(
  workbook.worksheets.map(sheet => sheet.name),
  ['RESUMO', 'OPERAÇÃO', 'MANUTENÇÃO', 'À DISPOSIÇÃO', 'HISTÓRICO'],
);
const summary = workbook.getWorksheet('RESUMO');
assert.ok(summary);
assert.equal(summary?.getCell('A1').value, 'RELATÓRIO DIÁRIO DE SITUAÇÃO OPERACIONAL');
assert.equal(summary?.getCell('B6').value, 1);
assert.equal(summary?.getCell('C6').value, 1);
assert.equal(summary?.getCell('D6').value, 0);
assert.equal(summary?.getCell('E6').value, 0);
assert.equal(summary?.getCell('F6').value, '00:54');

for (const name of ['OPERAÇÃO', 'MANUTENÇÃO', 'À DISPOSIÇÃO', 'HISTÓRICO']) {
  const sheet = workbook.getWorksheet(name);
  assert.ok(sheet);
  assert.equal(sheet?.views[0]?.state, 'frozen');
  assert.equal(sheet?.pageSetup.orientation, 'landscape');
  assert.equal(sheet?.pageSetup.fitToWidth, 1);
  assert.ok(sheet?.getTable(
    name === 'OPERAÇÃO'
      ? 'OperacaoCBs'
      : name === 'MANUTENÇÃO'
        ? 'ManutencaoCBs'
        : name === 'À DISPOSIÇÃO'
          ? 'DisponibilidadeCBs'
          : 'HistoricoCBs',
  ));
  assert.equal(sheet?.getRow(1).font?.name, 'Aptos Narrow');
}

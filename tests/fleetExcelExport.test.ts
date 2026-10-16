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
    pending: 0,
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
  pending: [],
  waitingDriver: [],
  other: [],
  sections: [],
  history: [],
  integrityWarnings: [],
};

const workbook = await buildFleetWorkbook(viewModel);
assert.deepEqual(
  workbook.worksheets.map(sheet => sheet.name),
  ['RESUMO', 'OPERAÇÃO', 'MANUTENÇÃO', 'À DISPOSIÇÃO', 'A CONFIRMAR', 'HISTÓRICO'],
);
const summary = workbook.getWorksheet('RESUMO');
assert.ok(summary);
assert.equal(summary?.getCell('A1').value, 'RELATÓRIO DIÁRIO DE SITUAÇÃO OPERACIONAL');
assert.equal(summary?.getCell('B6').value, 1);
assert.equal(summary?.getCell('C6').value, 1);
assert.equal(summary?.getCell('D6').value, 0);
assert.equal(summary?.getCell('E6').value, 0);
assert.equal(summary?.getCell('F6').value, 0);
assert.equal(summary?.getCell('G6').value, '00:54');

for (const name of ['OPERAÇÃO', 'MANUTENÇÃO', 'À DISPOSIÇÃO', 'A CONFIRMAR', 'HISTÓRICO']) {
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
          : name === 'A CONFIRMAR'
            ? 'ConfirmacaoCBs'
          : 'HistoricoCBs',
  ));
  assert.equal(sheet?.getRow(1).font?.name, 'Aptos Narrow');
}

// Com a conferência do dia, a planilha ganha a aba OPERADORES e o resumo usa
// a relação de equipamentos escolhida (não a fixa do código).
const { montarConferenciaDoDia, linhasDaConferencia, avisosDaConferencia } = await import('../src/fleet/conferenciaDoDia');
const registroCb = (prefixo: string, codigoFuncionario: string, nomeMotorista: string) => ({
  id: `${prefixo}-${codigoFuncionario}`, chave: `2026-08-12|${prefixo}`, data: '2026-08-12', funcionarioId: '',
  codigoFuncionario, nomeMotorista, equipamentoId: '', prefixo, familia: 'Basculantes', status: 'Em operação' as const,
  horaSaida: '07:05', horaEntradaManutencao: '', horaLiberacao: '', observacao: '', origem: 'SISTEMA' as const,
  revisao: [], criadoEm: '2026-08-12T10:00:00.000Z', atualizadoEm: '2026-08-12T10:00:00.000Z',
});
const conferencia = montarConferenciaDoDia(
  [registroCb('CB726', '103177', 'ADILSON PIRES DA CRUZ'), registroCb('CB727', '103177', 'ADILSON PIRES DA CRUZ')],
  '2026-08-12',
  [{ prefix: 'CB726', group: 'Basculantes', equipmentType: 'Caminhão Basculante' }, { prefix: 'CB730', group: 'Basculantes', equipmentType: 'Caminhão Basculante' }],
  [{ matricula: '103177', nome: 'ADILSON PIRES DA CRUZ' }, { matricula: '101671', nome: 'ANDERSON PEIXOTO DA SILVA' }],
);
assert.deepEqual(linhasDaConferencia(conferencia), [
  ['Equipamentos', 2, 1, 1, 'CB730'],
  ['Operadores', 2, 1, 1, 'ANDERSON PEIXOTO DA SILVA'],
]);
assert.deepEqual(avisosDaConferencia(conferencia), [
  'Operador em mais de um caminhão: ADILSON PIRES DA CRUZ.',
]);
const comConferencia = await buildFleetWorkbook(viewModel, {}, conferencia);
assert.deepEqual(
  comConferencia.worksheets.map(sheet => sheet.name),
  ['RESUMO', 'OPERAÇÃO', 'MANUTENÇÃO', 'À DISPOSIÇÃO', 'A CONFIRMAR', 'OPERADORES', 'HISTÓRICO'],
);
const operadores = comConferencia.getWorksheet('OPERADORES');
assert.equal(operadores?.getCell('B2').value, 'ADILSON PIRES DA CRUZ');
assert.equal(operadores?.getCell('D2').value, 'CB726 + CB727');
assert.equal(operadores?.getCell('C3').value, 'A confirmar');

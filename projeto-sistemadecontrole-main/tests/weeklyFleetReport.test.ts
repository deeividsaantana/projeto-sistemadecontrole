import assert from 'node:assert/strict';
import test from 'node:test';
import type { ControleEquipamentoDiario } from '../src/types';
import { buildWeeklyFleetReport, buildWeeklyFleetWorkbook } from '../src/fleet/weeklyReport';

const record = (id: string, data: string, status: ControleEquipamentoDiario['status']): ControleEquipamentoDiario => ({
  id,
  chave: id,
  data,
  funcionarioId: `func-${id}`,
  codigoFuncionario: id,
  nomeMotorista: `Motorista ${id}`,
  equipamentoId: `equip-${id}`,
  prefixo: `CB${id}`,
  familia: 'Basculantes',
  status,
  horaSaida: '07:00',
  horaEntradaManutencao: '',
  horaLiberacao: '',
  observacao: '',
  origem: 'SISTEMA',
  revisao: [],
  criadoEm: `${data}T07:00:00.000Z`,
  atualizadoEm: `${data}T07:00:00.000Z`,
});

test('relatório semanal limita o período aos sete dias e separa os status', () => {
  const report = buildWeeklyFleetReport([
    record('1', '2026-08-23', 'Em operação'),
    record('2', '2026-08-29', 'Disponível'),
    record('3', '2026-08-29', 'A confirmar'),
    record('4', '2026-08-22', 'Em manutenção'),
  ], '2026-08-29');
  assert.equal(report.startDate, '2026-08-23');
  assert.equal(report.endDate, '2026-08-29');
  assert.equal(report.days.length, 7);
  assert.equal(report.records.length, 3);
  assert.equal(report.totals.total, 3);
  assert.equal(report.averages.operating, 1 / 7);
  assert.equal(report.averages.availabilityRate, 150 / 7);
  assert.deepEqual(report.days.at(-1), {
    date: '2026-08-29',
    total: 2,
    operating: 0,
    maintenance: 0,
    available: 1,
    pending: 1,
    availabilityRate: 50,
  });
});

test('Excel semanal contém resumo e detalhamento', async () => {
  const report = buildWeeklyFleetReport([record('1', '2026-08-29', 'Em operação')], '2026-08-29');
  const workbook = await buildWeeklyFleetWorkbook(report);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['RESUMO SEMANAL', 'DETALHAMENTO']);
  assert.equal(workbook.getWorksheet('RESUMO SEMANAL')?.rowCount, 16);
  assert.equal(workbook.getWorksheet('DETALHAMENTO')?.rowCount, 2);
});

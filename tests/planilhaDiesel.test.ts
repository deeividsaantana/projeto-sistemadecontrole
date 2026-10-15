import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import type { FuelReportExcelRow } from '../src/modules/frota/fuelReport';
import { montarResumoGeral, nomeDoMes, separarPorMes } from '../src/modules/frota/planilhaDiesel';
import { preencherPlanilhaDiesel } from '../src/modules/frota/exportarPlanilhaDiesel';

const linha = (over: Partial<FuelReportExcelRow>): FuelReportExcelRow => ({
  aba: '', linha: '', dia: '', data: '2026-10-06', prefixo: 'LO165', descricao: 'Gerador', kmInicial: '', horimetro: 1644,
  litros: 65, hora: '12:08', comboio: 'TQC019', tipoCombustivel: 'Óleo Diesel S 10 Comum', empresa: 'Renea',
  bombaInicial: 100, bombaFinal: 165, status: 'OK', observacao: '', ...over,
});

const linhas = [
  linha({ data: '2026-10-06', hora: '12:08' }),
  linha({ data: '2026-09-20', hora: '08:00', prefixo: 'CB795', descricao: '', empresa: '', litros: 100, bombaFinal: 900 }),
  linha({ data: '2026-09-21', hora: '07:00', litros: 40.25 }),
];

test('abas por mês do diesel (21 a 20), na ordem de lançamento', () => {
  assert.equal(nomeDoMes('2026-10'), 'OUTUBRO 2026');
  const abas = separarPorMes(linhas);
  assert.deepEqual(abas.map(aba => [aba.nome, aba.linhas.length, aba.litros]), [['SETEMBRO 2026', 1, 100], ['OUTUBRO 2026', 2, 105.3]]);
  assert.deepEqual(abas[1].linhas.map(item => item.data), ['2026-09-21', '2026-10-06']);
  assert.equal(abas[1].titulo, 'FORNECIMENTO DIESEL - OUTUBRO 2026');
});

test('resumo geral soma por mês, comboio, máquina e empresa', () => {
  const resumo = montarResumoGeral(linhas);
  assert.equal(resumo.totalLitros, 205.3);
  assert.equal(resumo.lancamentos, 3);
  assert.deepEqual(resumo.porComboio, [{ comboio: 'TQC019', litros: 205.3, lancamentos: 3, ultimaData: '2026-10-06', ultimaBombaFinal: 165 }]);
  assert.deepEqual(resumo.topEquipamentos.map(item => [item.prefixo, item.equipamento, item.litros]), [['LO165', 'Gerador', 105.3], ['CB795', 'NÃO CADASTRADO', 100]]);
  assert.deepEqual(resumo.porEmpresa, [{ empresa: 'Renea', litros: 105.3 }, { empresa: 'NÃO CADASTRADO', litros: 100 }]);
});

test('o Excel sai no modelo da planilha', async () => {
  const pasta = new ExcelJS.Workbook();
  preencherPlanilhaDiesel(pasta, linhas, [{ prefixo: 'LO165', nome: 'Gerador', familia: 'Gerador', empresa: 'Renea', status: 'Ativo' }]);
  assert.deepEqual(pasta.worksheets.map(aba => aba.name), ['Resumo Geral', 'Equipamentos', 'SETEMBRO 2026', 'OUTUBRO 2026']);
  const outubro = pasta.getWorksheet('OUTUBRO 2026')!;
  assert.equal(outubro.getCell('B1').value, 'FORNECIMENTO DIESEL - OUTUBRO 2026');
  assert.deepEqual((outubro.getRow(5).values as unknown[]).slice(2), ['Data', 'Prefixo', 'Descrição do equipamento', 'KM inicial', 'Horímetro', 'Litros', 'Hora', 'Comboio', 'Tipo de combustível', 'Empresa', 'Bomba inicial', 'Bomba final']);
  assert.equal(outubro.getCell('C6').value, 'LO165');
  assert.equal(outubro.getCell('G6').value, 40.25);
  assert.equal(outubro.getCell('A6').value, 'seg');
  const setembro = pasta.getWorksheet('SETEMBRO 2026')!;
  assert.equal(setembro.getCell('D6').value, 'NÃO CADASTRADO');
  assert.equal(pasta.getWorksheet('Resumo Geral')!.getCell('B4').value, 205.3);
  // A pasta abre no mês mais recente.
  assert.equal(pasta.views[0].activeTab, 3);
  await pasta.xlsx.writeBuffer();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { readFuelWorkbook } from '../scripts/lib/fuel-workbook-reader.mjs';

const writeWorkbook = async (row: unknown[]) => {
  const filePath = path.join(os.tmpdir(), `renea-fuel-reader-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('DadosCombustível');
  sheet.addRows([
    [], [], [], [],
    ['Data', 'Frota', 'Descrição', 'Km (Inicial)', 'Horímetro (inicial)', 'Inicio Bomba', 'Fim Bomba', 'Qtde de Litros', 'Hora', 'Comboio', 'Tipo do Combustível', 'Empresa'],
    row,
  ]);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

test('lê a aba DadosCombustível e os cabeçalhos usados na planilha de junho', async () => {
  const filePath = await writeWorkbook([
    new Date(Date.UTC(2026, 4, 21)), 'CB770', 'Caminhão Basculante', 217574, 1308,
    356187, 356266, 79, new Date(Date.UTC(1899, 11, 30, 7, 0)), 'TQC019', 'Óleo Diesel S 10 Comum', 'Renea',
  ]);
  try {
    const result = await readFuelWorkbook(filePath);
    assert.equal(result.sheetName, 'DadosCombustível');
    assert.equal(result.rows.length, 1);
    assert.deepEqual(
      {
        data: result.rows[0].data,
        hora: result.rows[0].hora,
        litros: result.rows[0].quantidadeLitros,
        bombaInicial: result.rows[0].bombaInicial,
        bombaFinal: result.rows[0].bombaFinal,
      },
      { data: '2026-05-21', hora: '07:00', litros: 79, bombaInicial: 356187, bombaFinal: 356266 },
    );
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test('preserva linha com bomba inválida e a envia para conferência', async () => {
  const filePath = await writeWorkbook([
    new Date(Date.UTC(2026, 6, 29)), 'EC023', 'Escavadeira', '', 145,
    'Bomba final', 830277, 62, 1600, 'TQC025', 'Óleo Diesel S 10 Comum', 'Renea',
  ]);
  try {
    const result = await readFuelWorkbook(filePath);
    assert.equal(result.rows.length, 1);
    assert.match(result.rows[0].avisos, /Bomba inicial inválida/);
    assert.equal(result.warningCount, 1);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test('aceita leitura zero como reinício válido do medidor', async () => {
  const filePath = await writeWorkbook([
    new Date(Date.UTC(2026, 6, 30)), 'EC023', 'Escavadeira', '', 145,
    0, 62, 62, 1600, 'TQC025', 'Óleo Diesel S 10 Comum', 'Renea',
  ]);
  try {
    const result = await readFuelWorkbook(filePath);
    assert.equal(result.rows.length, 1);
    assert.doesNotMatch(result.rows[0].avisos, /Bomba inicial inválida/);
    assert.equal(result.rows[0].bombaInicial, 0);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test('lê todas as abas mensais da macro e o cadastro de equipamentos', async () => {
  const filePath = path.join(os.tmpdir(), `renea-fuel-reader-macro-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const addMonthlySheet = (name: string, prefixo: string, comboio: string, litros: number) => {
    const sheet = workbook.addWorksheet(name);
    sheet.addRows([
      [], [], [], [],
      ['Data', 'Prefixo', 'Descrição do equipamento', 'KM inicial', 'Horímetro', 'Litros', 'Hora', 'Comboio', 'Tipo de combustível', 'Empresa', 'Bomba inicial', 'Bomba final'],
      [new Date(Date.UTC(2026, 8, 21)), prefixo, 'Caminhão Basculante', 100, 200, litros, 0.5, comboio, 'Óleo Diesel S10 Comum', 'Renea', 5000, 5000 + litros],
    ]);
  };
  addMonthlySheet('SETEMBRO 2026', 'CB790', 'TQC019', 123);
  addMonthlySheet('OUTUBRO 2026', 'CB791', 'TQC025', 77);
  const equipamentos = workbook.addWorksheet('Equipamentos');
  equipamentos.addRows([
    ['Frota', 'Dpara', 'Equipamento', 'Familia', 'Mobilizado', 'MetaDispMec', 'DataMob', 'DataDesmob', 'Empresa', 'Status'],
    ['CB790', '790', 'Caminhão Basculante', 'Caminhão', true, 0.8, '', '', 'Renea', 'Ativo'],
    ['CB791', '791', 'Caminhão Pipa', 'Caminhão', true, 0.8, '', '', 'Locadora X', 'Ativo'],
  ]);
  await workbook.xlsx.writeFile(filePath);

  try {
    const result = await readFuelWorkbook(filePath);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.sheets.map(sheet => sheet.name), ['SETEMBRO 2026', 'OUTUBRO 2026']);
    assert.deepEqual(result.rows.map(row => `${row.sheet}:${row.prefixo}:${row.comboio}:${row.competencia}`), [
      'SETEMBRO 2026:CB790:TQC019:2026-09',
      'OUTUBRO 2026:CB791:TQC025:2026-10',
    ]);
    assert.deepEqual(result.equipamentos.map(item => `${item.prefixo}:${item.nome}:${item.empresa}:${item.status}`), [
      'CB790:Caminhão Basculante:Renea:Ativo',
      'CB791:Caminhão Pipa:Locadora X:Ativo',
    ]);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

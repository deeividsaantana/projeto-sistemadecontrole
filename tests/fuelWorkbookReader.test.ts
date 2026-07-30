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

import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import ExcelJS from 'exceljs';
import { readWorkbookFile } from '../src/imports/workbookReader';

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Tubos de concreto');
sheet.addRow(['Data', 'Material', 'NF', 'Quantidade Recebida']);
sheet.addRow(['05/01/2026', 'Tubo concreto 400mm', '12345', 10]);
sheet.addRow(['06/01/2026', 'Tubo concreto 600mm', '12346', 5]);
// Simula formatação do Excel até a última linha da planilha, sem dado real:
// aplicar apenas estilo (sem value) não pode contar como "linha usada".
sheet.getRow(1_048_576).font = { bold: false };

const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
const file = new File([bytes], 'CONTROLE DE RECEBIMENTO.xlsx') as unknown as Parameters<typeof readWorkbookFile>[0];

const result = await readWorkbookFile(file);
assert.equal(result.sourceFile, 'CONTROLE DE RECEBIMENTO.xlsx');
assert.match(result.sourceHash, /^[0-9a-f]{64}$/);
assert.equal(result.sheets.length, 1);

const [readSheet] = result.sheets;
assert.equal(readSheet.sheetName, 'Tubos de concreto');
assert.equal(readSheet.headerRow, 1);
assert.equal(readSheet.lastUsedRow, 3, 'a linha 1.048.576 só tem estilo, não deve contar como usada');
assert.deepEqual(readSheet.headers, ['Data', 'Material', 'NF', 'Quantidade Recebida']);
assert.equal(readSheet.rows.length, 2);
assert.equal(readSheet.rows[0].rowNumber, 2);
assert.equal(readSheet.rows[1].values['NF'], '12346');

// Linha de total acima do cabeçalho (abas de bota-fora) não é o cabeçalho.
const comTotal = new ExcelJS.Workbook();
const bota = comTotal.addWorksheet('BOTA FORA (ITAQUAREIA)');
bota.addRow(['QUANTIDADE DE VIAGENS', 1150]);
bota.addRow(['DATA', 'ITEM', 'UNIDADE', 'QUANTIDADE', 'FORNECEDOR', 'PLACA', 'NUMERO DA NOTA']);
bota.addRow(['30/04/2026', 'SOLO CONTAMINADO', 'M³', 16, 'RENEA', 'EFO7669', 563073]);
const botaFile = new File([new Uint8Array(await comTotal.xlsx.writeBuffer())], 'MATERIAIS.xlsx') as unknown as Parameters<typeof readWorkbookFile>[0];
const [botaSheet] = (await readWorkbookFile(botaFile)).sheets;
assert.equal(botaSheet.headerRow, 2);
assert.equal(botaSheet.rows.length, 1);
assert.equal(botaSheet.rows[0].values['NUMERO DA NOTA'], 563073);

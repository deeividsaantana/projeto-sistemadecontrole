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

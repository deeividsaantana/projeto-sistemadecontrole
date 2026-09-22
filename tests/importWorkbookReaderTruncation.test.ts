import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import ExcelJS from 'exceljs';
import { readWorkbookFile } from '../src/imports/workbookReader';

// Reproduz o padrão real que travou a importação: uma Tabela do Excel
// arrastada muito além dos dados de verdade, com VALOR real (não só estilo)
// em dezenas de milhares de linhas. Sem um teto de segurança, ExcelJS tenta
// materializar objeto por célula para cada uma dessas linhas e estoura
// memória/trava a aba — não é hipotético, foi reproduzido com o arquivo real.
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Aba Grande');
sheet.addRow(['Data', 'Item']);
sheet.addRow(['05/01/2026', 'Real']);
for (let r = 3; r <= 25_000; r += 1) {
  sheet.getRow(r).getCell(2).value = 0;
}
const smallSheet = workbook.addWorksheet('Aba Normal');
smallSheet.addRow(['Data', 'Item']);
smallSheet.addRow(['06/01/2026', 'Sem problema']);

const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
const file = new File([bytes], 'planilha-com-aba-inflada.xlsx') as unknown as Parameters<typeof readWorkbookFile>[0];

const result = await readWorkbookFile(file);

assert.equal(result.sheets.length, 2, 'as duas abas continuam sendo lidas, nenhuma some');

const bigSheet = result.sheets.find(item => item.sheetName === 'Aba Grande');
assert.ok(bigSheet, 'a aba inflada ainda aparece no resultado');
assert.equal(bigSheet!.rows[0].values['Item'], 'Real', 'o dado real da linha 2 não pode ser perdido pelo corte');

assert.ok(result.truncatedSheets && result.truncatedSheets.length === 1, 'a aba inflada precisa ser reportada, nunca cortada em silêncio');
const [truncation] = result.truncatedSheets!;
assert.equal(truncation.sheetName, 'Aba Grande');
assert.ok(truncation.originalRowsDeclared > 20_000, 'o total original declarado precisa refletir o tamanho real do problema');
assert.ok(truncation.keptRows <= 20_000, 'o corte precisa respeitar o teto de segurança');

const normalSheet = result.sheets.find(item => item.sheetName === 'Aba Normal');
assert.ok(normalSheet, 'aba pequena não é afetada pelo corte de segurança');
assert.equal(normalSheet!.rows.length, 1);

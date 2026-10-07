import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { loadValidatedWorkbook, stripUnsupportedWorkbookVisuals } from '../src/utils/excelCorporate';

const source = new ExcelJS.Workbook();
const sheet = source.addWorksheet('CAD_EQUIPAMENTOS');
sheet.addRow(['Prefixo', 'Equipamento']);
sheet.addRow(['EC001', 'Escavadeira']);

const sourceBytes = await source.xlsx.writeBuffer();
const zip = await JSZip.loadAsync(sourceBytes);
const sheetEntry = zip.file('xl/worksheets/sheet1.xml');
assert.ok(sheetEntry);
const sheetXml = (await sheetEntry.async('string'))
  .replace('</worksheet>', '<drawing r:id="rIdBroken"/></worksheet>');
zip.file('xl/worksheets/sheet1.xml', sheetXml);
zip.file(
  'xl/worksheets/_rels/sheet1.xml.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rIdBroken" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="/xl/drawings/drawing-missing.xml"/>'
    + '</Relationships>',
);
zip.file(
  'xl/drawings/_rels/drawing-missing.xml.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/xl/media/image-missing.png"/>'
    + '</Relationships>',
);

const brokenVisualBytes = await zip.generateAsync({ type: 'uint8array' });
const sanitizedBytes = await stripUnsupportedWorkbookVisuals(brokenVisualBytes);
const sanitizedZip = await JSZip.loadAsync(sanitizedBytes);
assert.equal(sanitizedZip.file('xl/drawings/_rels/drawing-missing.xml.rels'), null);
assert.doesNotMatch(await sanitizedZip.file('xl/worksheets/sheet1.xml')!.async('string'), /<drawing\b/i);
assert.doesNotMatch(await sanitizedZip.file('xl/worksheets/_rels/sheet1.xml.rels')!.async('string'), /relationships\/drawing/i);

const browserCompatibleFile = new File([brokenVisualBytes], 'planilha-mestre.xlsx') as unknown as Parameters<typeof loadValidatedWorkbook>[0];
const workbook = await loadValidatedWorkbook(browserCompatibleFile);
const importedSheet = workbook.getWorksheet('CAD_EQUIPAMENTOS');
assert.ok(importedSheet);
assert.equal(importedSheet.getCell('A2').text, 'EC001');
assert.equal(importedSheet.getCell('B2').text, 'Escavadeira');

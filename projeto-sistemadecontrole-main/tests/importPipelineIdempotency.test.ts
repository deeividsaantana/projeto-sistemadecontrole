import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { File } from 'node:buffer';
import ExcelJS from 'exceljs';
import { readWorkbookFile } from '../src/imports/workbookReader';
import { runImportPipeline } from '../src/imports/runImportPipeline';
import type { MovimentoMaterial } from '../src/types';

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Tubos de concreto');
sheet.addRow(['Data', 'Material', 'NF', 'Quantidade Recebida', 'Unidade']);
sheet.addRow(['05/01/2026', 'Tubo concreto 400mm', '12345', 10, 'UN']);
sheet.addRow(['06/01/2026', 'Tubo concreto 600mm', '', 4, 'UN']);
const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());

const fileFirstRead = new File([bytes], 'CONTROLE DE RECEBIMENTO.xlsx') as unknown as Parameters<typeof readWorkbookFile>[0];
const fileSecondRead = new File([bytes], 'CONTROLE DE RECEBIMENTO.xlsx') as unknown as Parameters<typeof readWorkbookFile>[0];

const readOnce = await readWorkbookFile(fileFirstRead);
const readTwice = await readWorkbookFile(fileSecondRead);
assert.equal(readOnce.sourceHash, readTwice.sourceHash, 'bytes idênticos produzem o mesmo hash');

const firstPreview = runImportPipeline(readOnce, () => []);
const secondPreviewSameEmptyState = runImportPipeline(readTwice, () => []);
assert.equal(firstPreview.batchId, secondPreviewSameEmptyState.batchId, 'reimportar o mesmo arquivo gera o mesmo lote');
assert.equal(firstPreview.counts.new, 1);
assert.equal(firstPreview.counts.review, 1);
assert.deepEqual(firstPreview.counts, secondPreviewSameEmptyState.counts);

const alreadyImported: MovimentoMaterial = {
  id: 'mov-1', data: '2026-01-05', tipo: 'Entrada', materialId: 'mat-1',
  materialDescricao: 'Tubo concreto 400mm', quantidade: 10, unidade: 'UN',
  notaFiscal: '12345', responsavel: 'Sistema', criadoEm: '2026-01-05T00:00:00.000Z',
  atualizadoEm: '2026-01-05T00:00:00.000Z', status: 'ATIVO', responsavelAlteracao: 'Sistema',
} as MovimentoMaterial;
const secondPreviewWithState = runImportPipeline(readTwice, () => [alreadyImported]);
assert.equal(secondPreviewWithState.counts.unchanged, 1, 'reimportar contra o estado já aplicado marca unchanged, nunca duplica um novo registro');
assert.equal(secondPreviewWithState.counts.new, 0);
assert.equal(secondPreviewWithState.counts.review, 1, 'a linha sem NF continua em conferência nas duas rodadas');
assert.equal(secondPreviewWithState.dryRun, true);

const forbiddenPattern = /from ['"](?:firebase|@supabase|\.\.\/(?:firebase|supabase))/;
const walk = (dir: string): string[] => readdirSync(dir).flatMap(entry => {
  const fullPath = join(dir, entry);
  return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
});
const importFiles = walk(new URL('../src/imports', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .filter(path => path.endsWith('.ts'));
assert.ok(importFiles.length > 0, 'a varredura precisa encontrar os arquivos de src/imports');
importFiles.forEach(path => {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, forbiddenPattern, `${path} não pode importar SDK de nuvem`);
});

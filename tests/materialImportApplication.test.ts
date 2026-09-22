import assert from 'node:assert/strict';
import { buildMaterialImportApplication } from '../src/imports/materialImportApplication';
import type { ImportPreview } from '../src/imports/types';

const lineage = (row: number) => ({
  sourceFile: 'materiais.xlsx', sourceSheet: 'Tubos de concreto', sourceRow: row,
  sourceHash: 'abc123', importedAt: '2026-09-22T12:00:00.000Z', importBatchId: 'imp-1',
  validationStatus: 'ready' as const, validationMessages: [], originalData: {},
});

const preview: ImportPreview<unknown> = {
  batchId: 'imp-1', sourceFile: 'materiais.xlsx', sourceHash: 'abc123',
  generatedAt: '2026-09-22T12:00:00.000Z', dryRun: true, sheets: [],
  counts: { new: 1, 'potential-update': 0, unchanged: 0, 'duplicate-in-file': 1, review: 1, invalid: 0, deferred: 0 },
  rows: [
    { disposition: 'new', row: { lineage: lineage(3), operationalKey: 'recebimento|1', value: { data: '2026-09-21', material: 'Tubo de concreto', especificacao: 'PA3 DN 1000', codigo: 'TB-1000', quantidadeNota: 10, quantidadeRecebida: 8, unidade: 'UN', notaFiscal: '123', localAplicacao: 'Ramo 1300' } } },
    { disposition: 'duplicate-in-file', row: { lineage: lineage(4), operationalKey: 'recebimento|1', value: { data: '2026-09-21', material: 'Tubo de concreto', quantidadeRecebida: 8, unidade: 'UN', notaFiscal: '123' } } },
    { disposition: 'review', row: { lineage: { ...lineage(5), validationStatus: 'review' }, value: { material: 'Sem chave' } } },
  ],
};

const result = buildMaterialImportApplication(preview, [], [], 'Deivid Santana');
assert.equal(result.materials.length, 1);
assert.equal(result.movements.length, 1, 'duplicadas e linhas em conferência não são gravadas');
assert.equal(result.movements[0].quantidade, 8);
assert.equal(result.movements[0].quantidadeNota, 10);
assert.equal(result.movements[0].destino, 'Ramo 1300');
assert.match(result.movements[0].observacao || '', /materiais\.xlsx.*linha 3/i);
assert.deepEqual(result.skipped, { duplicate: 1, review: 1, other: 0 });

const reapplied = buildMaterialImportApplication(preview, result.materials, result.movements, 'Deivid Santana');
assert.equal(reapplied.materials.length, 0);
assert.equal(reapplied.movements.length, 0, 'reaplicar o mesmo lote é idempotente');

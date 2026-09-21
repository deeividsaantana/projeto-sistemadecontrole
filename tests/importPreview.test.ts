import assert from 'node:assert/strict';
import { buildImportPreview } from '../src/imports/preview';
import type { ImportLineage, ImportPreviewRow } from '../src/imports/types';

const lineage = (overrides: Partial<ImportLineage> = {}): ImportLineage => ({
  sourceFile: 'arquivo.xlsx',
  sourceSheet: 'Aba',
  sourceRow: 2,
  sourceHash: 'hash',
  importedAt: '2026-09-21T12:00:00.000Z',
  importBatchId: 'imp-arquivo-abc123',
  validationStatus: 'ready',
  validationMessages: [],
  originalData: {},
  ...overrides,
});

const previewRows: ImportPreviewRow<{ ok: boolean }>[] = [
  { row: { lineage: lineage(), value: { ok: true } }, disposition: 'new' },
  { row: { lineage: lineage({ sourceRow: 3 }), value: { ok: true } }, disposition: 'new' },
  { row: { lineage: lineage({ sourceRow: 4, validationStatus: 'review' }), value: { ok: false } }, disposition: 'review' },
];

const preview = buildImportPreview({
  batchId: 'imp-arquivo-abc123',
  sourceFile: 'arquivo.xlsx',
  sourceHash: 'hash',
  generatedAt: '2026-09-21T12:00:00.000Z',
  previewRows,
  sheets: [{ sheetName: 'Aba', recognized: true, rowCount: 3 }],
});

assert.equal(preview.dryRun, true);
assert.equal(preview.rows.length, 3);
assert.equal(preview.counts.new, 2);
assert.equal(preview.counts.review, 1);
assert.equal(preview.counts.invalid, 0, 'disposições sem ocorrência aparecem zeradas, não ausentes');
assert.equal(preview.counts['duplicate-in-file'], 0);
assert.equal(preview.sheets.length, 1);

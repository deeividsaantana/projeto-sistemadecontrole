import assert from 'node:assert/strict';
import { applyImportPreview, APPLY_BLOCKED_REASON } from '../src/imports/apply';
import { buildImportPreview } from '../src/imports/preview';

const preview = buildImportPreview({
  batchId: 'imp-arquivo-abc123',
  sourceFile: 'arquivo.xlsx',
  sourceHash: 'hash',
  generatedAt: '2026-09-21T12:00:00.000Z',
  previewRows: [],
  sheets: [],
});

const result = applyImportPreview(preview);
assert.equal(result.applied, false);
assert.equal(result.reason, APPLY_BLOCKED_REASON);
assert.match(APPLY_BLOCKED_REASON, /não está autorizada/i);

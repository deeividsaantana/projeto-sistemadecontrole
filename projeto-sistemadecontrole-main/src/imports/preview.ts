import type { ImportDisposition, ImportPreview, ImportPreviewRow, ImportSheetPreview } from './types';

const emptyCounts = (): Record<ImportDisposition, number> => ({
  new: 0,
  'potential-update': 0,
  unchanged: 0,
  'duplicate-in-file': 0,
  review: 0,
  invalid: 0,
  deferred: 0,
});

export const buildImportPreview = <T>(input: {
  batchId: string;
  sourceFile: string;
  sourceHash: string;
  generatedAt: string;
  previewRows: readonly ImportPreviewRow<T>[];
  sheets: readonly ImportSheetPreview[];
}): ImportPreview<T> => {
  const counts = emptyCounts();
  input.previewRows.forEach(row => { counts[row.disposition] += 1; });
  return {
    batchId: input.batchId,
    sourceFile: input.sourceFile,
    sourceHash: input.sourceHash,
    generatedAt: input.generatedAt,
    rows: input.previewRows,
    counts,
    sheets: input.sheets,
    dryRun: true,
  };
};

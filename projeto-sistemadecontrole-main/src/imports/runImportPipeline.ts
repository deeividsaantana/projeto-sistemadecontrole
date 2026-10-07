import type { ImportDomain, ImportParseContext, ImportPreview, ImportPreviewRow, ImportSheetPreview } from './types';
import type { WorkbookReadResult } from './workbookReader';
import { classifySheet, findAdapterForSheet } from './adapters';
import { buildImportBatchId } from './provenance';
import { buildImportPreview } from './preview';

/** Orquestra leitor, adaptador e prévia para um workbook já lido em memória. */
export const runImportPipeline = (
  workbook: WorkbookReadResult,
  resolveCurrent: (domain: ImportDomain) => unknown,
  now: Date = new Date(),
): ImportPreview<unknown> => {
  const importedAt = now.toISOString();
  const importBatchId = buildImportBatchId(workbook.sourceFile, workbook.sourceHash);
  const sheetPreviews: ImportSheetPreview[] = [];
  const previewRows: ImportPreviewRow<unknown>[] = [];

  workbook.sheets.forEach(sheet => {
    const adapter = findAdapterForSheet(sheet.sheetName);
    sheetPreviews.push(classifySheet(sheet.sheetName, sheet.headers, sheet.rows.length));
    if (!adapter) return;
    const context: ImportParseContext = {
      sourceFile: workbook.sourceFile,
      sourceHash: workbook.sourceHash,
      sourceSheet: sheet.sheetName,
      importBatchId,
      importedAt,
      headerRow: sheet.headerRow,
      rows: sheet.rows.map(row => row.values),
    };
    const parsedRows = adapter.parse(context);
    const current = resolveCurrent(adapter.domain);
    const preview = adapter.reconcile(parsedRows, current);
    previewRows.push(...preview.rows);
  });

  return buildImportPreview({
    batchId: importBatchId,
    sourceFile: workbook.sourceFile,
    sourceHash: workbook.sourceHash,
    generatedAt: importedAt,
    previewRows,
    sheets: sheetPreviews,
  });
};

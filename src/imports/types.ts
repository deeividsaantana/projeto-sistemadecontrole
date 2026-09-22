export type ImportValidationStatus = 'ready' | 'review' | 'duplicate' | 'invalid' | 'deferred';

export interface ImportLineage {
  readonly sourceFile: string;
  readonly sourceSheet: string;
  readonly sourceRow: number;
  readonly sourceHash: string;
  readonly importedAt: string;
  readonly importBatchId: string;
  readonly validationStatus: ImportValidationStatus;
  readonly validationMessages: readonly string[];
  readonly originalData: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ImportRow<T> {
  readonly lineage: ImportLineage;
  readonly value: T;
  readonly operationalKey?: string;
  /**
   * Linha bruta (antes de cleanImportValue) para domínios cujo registro final
   * precisa de um valor que cleanImportValue não preserva com fidelidade —
   * ex.: Date de horário vira só "AAAA-MM-DD" em lineage.originalData,
   * perdendo a hora. Opcional: a maioria dos domínios reconstrói o registro
   * a partir de `value` normalmente.
   */
  readonly rawRow?: Readonly<Record<string, unknown>>;
}

export type ImportDisposition =
  | 'new'
  | 'potential-update'
  | 'unchanged'
  | 'duplicate-in-file'
  | 'review'
  | 'invalid'
  | 'deferred';

export interface ImportPreviewRow<T> {
  readonly row: ImportRow<T>;
  readonly disposition: ImportDisposition;
  readonly existingReference?: string;
}

export type ImportDomain = 'materials-receipts' | 'materials-movements' | 'stakes' | 'travels';

export interface ImportColumnMapping {
  readonly column: string;
  readonly mappedTo: string | null;
}

export interface ImportSheetPreview {
  readonly sheetName: string;
  readonly recognized: boolean;
  readonly domain?: ImportDomain;
  readonly rowCount: number;
  readonly reason?: string;
  readonly columnMapping?: readonly ImportColumnMapping[];
}

export interface ImportPreview<T> {
  readonly batchId: string;
  readonly sourceFile: string;
  readonly sourceHash: string;
  readonly generatedAt: string;
  readonly rows: readonly ImportPreviewRow<T>[];
  readonly counts: Readonly<Record<ImportDisposition, number>>;
  readonly sheets: readonly ImportSheetPreview[];
  readonly dryRun: true;
}

export interface ImportParseContext {
  readonly sourceFile: string;
  readonly sourceHash: string;
  readonly sourceSheet: string;
  readonly importBatchId: string;
  readonly importedAt: string;
  readonly headerRow: number;
  readonly rows: readonly Record<string, unknown>[];
}

export interface SpreadsheetImportAdapter<T, TCurrent> {
  readonly domain: ImportDomain;
  supports(sheetName: string): boolean;
  describeColumns(headers: readonly string[]): readonly ImportColumnMapping[];
  parse(context: ImportParseContext): readonly ImportRow<T>[];
  reconcile(rows: readonly ImportRow<T>[], current: TCurrent): ImportPreview<T>;
}

export interface ImportApplyResult {
  readonly applied: false;
  readonly reason: string;
}

# Importação Auditável — Fase 1: Fundação, Prévia e Dry-run — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React-independent, cloud-SDK-free import layer (`src/imports/`) that reads the four real operational spreadsheets end-to-end in memory, classifies every row with full lineage (`arquivo › aba › linha`), computes a deterministic batch id, and renders an evolved `SpreadsheetImportReview` preview — first wired into `MateriaisTab` — with a working "Executar dry-run" action and a permanently disabled "Aplicar importação" action. No real data is persisted in this phase.

**Architecture:** A pure-function pipeline (`workbookReader → normalizers → adapters (parse/reconcile) → preview → apply(blocked)`) lives entirely under `src/imports/`, mirroring the existing `src/fleet/importService.ts` pattern (parse → classify → preview → explicit apply). Four domain adapters (`materials-receipts`, `materials-movements`, `stakes`, `travels`) share one contract (`SpreadsheetImportAdapter`) and are combined by a reusable `runImportPipeline` orchestrator, so Estacas (Fase 3) and Tickets (Fase 4) can call the exact same function `MateriaisTab` uses in this phase.

**Tech Stack:** React 19, TypeScript, ExcelJS (already a dependency, loaded lazily via `src/utils/excelCorporate.ts`), Web Crypto (`crypto.subtle.digest`) for SHA-256, the repo's custom `node:test`-free assertion-script test runner (`npm test` → `scripts/run-tests.mjs` → `tests/run.ts`), Playwright for e2e smoke.

**Spec:** `docs/superpowers/specs/2026-09-21-importacao-planilhas-operacionais-design.md` (Fase 1 section, plus the shared "Arquitetura comum de importação" and "Idempotência e reconciliação" sections that apply to every phase).

## Global Constraints

- No new dependency and no framework migration (React 19 / TypeScript / Vite 6 / Tailwind 4 stay as-is) — spec "Restrições e invariantes".
- `src/imports/**` never imports Firebase or Supabase SDKs — spec "Restrições e invariantes"; AGENTS.md "Não importe SDKs de banco diretamente em componentes de tela."
- A missing field stays `null`/`undefined`; no normalizer may turn absence into `0`, `''`, or an invented date/status — spec "Restrições e invariantes"; AGENTS.md "Ausência de dado não pode virar zero, status ou horário inventado."
- No row is ever silently dropped for being incomplete or invalid; incomplete rows go to `review`, never `invalid`-and-discarded or auto-`duplicate` — spec "Idempotência e reconciliação".
- `originalData` in the lineage stores only cleaned, traceable field values — never the raw workbook, binary, or base64 — spec "Restrições e invariantes".
- The "Aplicar importação" action stays disabled in every screen this phase touches, with a visible explanation that persistence is not authorized yet — spec "Objetivo" and Fase 1 "Escopo".
- Every reimport of byte-identical file content must yield the same `sourceHash` and the same deterministic `importBatchId` — spec "Idempotência e reconciliação".
- `npm run verify` (lint + `npm test` + build) must pass before any task is considered done — AGENTS.md "Rode `npm run verify` antes de entregar."

---

## File Structure

New files under the React-independent import layer:

- `src/imports/types.ts` — shared contracts: `ImportLineage`, `ImportRow<T>`, `ImportDisposition`, `ImportPreview<T>`, `ImportSheetPreview`, `ImportColumnMapping`, `ImportParseContext`, `SpreadsheetImportAdapter<T, TCurrent>`, `ImportApplyResult`.
- `src/imports/provenance.ts` — SHA-256 file hashing, deterministic batch id, per-row lineage construction, `originalData` cleaning.
- `src/imports/workbookReader.ts` — reads a `File` via the existing `loadValidatedWorkbook`, detects the true last-used row per sheet (never trusting Excel's formatted `1,048,576` dimension), extracts headers and raw rows.
- `src/imports/normalizers.ts` — date/time/decimal/unit/plate/prefix/invoice normalizers that return `null` (never `0`/`''`) for absent input.
- `src/imports/preview.ts` — consolidates rows into `ImportPreview<T>` with counts by disposition.
- `src/imports/apply.ts` — the always-blocked dry-run apply boundary for this phase.
- `src/imports/runImportPipeline.ts` — orchestrates reader → adapter routing → reconcile → preview, reusable by any screen.
- `src/imports/adapters/receiptsAdapter.ts` — `materials-receipts` domain (file 1: "CONTROLE DE RECEBIMENTO DE MATERIAIS...").
- `src/imports/adapters/materialsAdapter.ts` — `materials-movements` domain (file 2: "MATERIAIS COMPLEXO DO ALTO TIETÊ...").
- `src/imports/adapters/stakesAdapter.ts` — `stakes` domain (file 3: "CRAVAÇÕES DE ESTACAS PRANCHA..."), recognition + preview only (full domain rules land in Fase 3).
- `src/imports/adapters/travelsAdapter.ts` — `travels` domain (file 4: "VIAGENS JAZIDA SABESP..."), recognition + preview only (full reconciliation lands in Fase 4).
- `src/imports/adapters/index.ts` — adapter registry, `findAdapterForSheet`, `classifySheet` (marks unrecognized sheets `deferred`).

Modified files:

- `src/components/SpreadsheetImportReview.tsx` — add an optional `batchPreview` prop; when present, render file/hash/batch-id, sheets (recognized/deferred + column mapping), status counts, per-row `arquivo › aba › linha` references with messages, "Executar dry-run", and a permanently disabled "Aplicar importação". Existing callers (`CadastrosTab`, `LancamentosTab`, `TicketsJazidaTab`) keep working unchanged because `batchPreview` is optional.
- `src/components/MateriaisTab.tsx` — add an `'importacoes'` tab, a file input, and the orchestration that calls `runImportPipeline` and renders the evolved modal.

New tests (flat under `tests/`, following the repo's existing naming convention, registered in `tests/run.ts`):

- `tests/importProvenance.test.ts`
- `tests/importWorkbookReader.test.ts`
- `tests/importNormalizers.test.ts`
- `tests/importPreview.test.ts`
- `tests/importApply.test.ts`
- `tests/importReceiptsAdapter.test.ts`
- `tests/importMaterialsAdapter.test.ts`
- `tests/importStakesAdapter.test.ts`
- `tests/importTravelsAdapter.test.ts`
- `tests/importPipelineIdempotency.test.ts`
- `tests/spreadsheetImportReviewUi.test.ts`
- `tests/materiaisImportUi.test.ts`
- `tests/e2e/importacaoPreview.spec.ts`

---

### Task 1: Shared contracts and provenance (hash, batch id, lineage)

**Files:**
- Create: `src/imports/types.ts`
- Create: `src/imports/provenance.ts`
- Test: `tests/importProvenance.test.ts`

**Interfaces:**
- Produces: `ImportValidationStatus`, `ImportLineage`, `ImportRow<T>`, `ImportDisposition`, `ImportPreviewRow<T>`, `ImportDomain`, `ImportSheetPreview`, `ImportColumnMapping`, `ImportPreview<T>`, `ImportParseContext`, `SpreadsheetImportAdapter<T, TCurrent>`, `ImportApplyResult` (all from `types.ts`); `computeSourceHash(bytes: Uint8Array): Promise<string>`, `buildImportBatchId(fileName: string, sourceHash: string): string`, `cleanRowForLineage(raw: Record<string, unknown>): Record<string, string | number | boolean | null>`, `buildRowLineage(input): ImportLineage` (all from `provenance.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importProvenance.test.ts
import assert from 'node:assert/strict';
import { buildImportBatchId, buildRowLineage, cleanRowForLineage, computeSourceHash } from '../src/imports/provenance';

const bytesA = new TextEncoder().encode('conteudo-do-arquivo-1');
const bytesB = new TextEncoder().encode('conteudo-do-arquivo-2');

const hashA1 = await computeSourceHash(bytesA);
const hashA2 = await computeSourceHash(bytesA);
const hashB = await computeSourceHash(bytesB);
assert.equal(hashA1, hashA2, 'o mesmo conteúdo deve gerar o mesmo hash');
assert.notEqual(hashA1, hashB, 'conteúdos diferentes devem gerar hashes diferentes');
assert.match(hashA1, /^[0-9a-f]{64}$/, 'sha-256 em hex deve ter 64 caracteres');

const batchId1 = buildImportBatchId('CONTROLE DE RECEBIMENTO.xlsx', hashA1);
const batchId2 = buildImportBatchId('CONTROLE DE RECEBIMENTO.xlsx', hashA1);
const batchId3 = buildImportBatchId('CONTROLE DE RECEBIMENTO.xlsx', hashB);
assert.equal(batchId1, batchId2, 'reimportar o mesmo arquivo deve gerar o mesmo lote');
assert.notEqual(batchId1, batchId3, 'conteúdo diferente deve gerar lote diferente');
assert.match(batchId1, /^imp-/);

const cleaned = cleanRowForLineage({ Data: new Date('2026-01-05T00:00:00.000Z'), Quantidade: 12.5, Vazio: '', Nulo: null });
assert.equal(cleaned.Vazio, null, 'campo vazio vira null, nunca string vazia tratada como valor');
assert.equal(cleaned.Nulo, null);
assert.equal(cleaned.Quantidade, '12.5');

const lineage = buildRowLineage({
  sourceFile: 'CONTROLE DE RECEBIMENTO.xlsx',
  sourceSheet: 'Tubos de concreto',
  sourceRow: 8,
  sourceHash: hashA1,
  importBatchId: batchId1,
  importedAt: '2026-09-21T12:00:00.000Z',
  validationStatus: 'review',
  validationMessages: ['Nota fiscal ausente.', 'Nota fiscal ausente.'],
  originalData: cleaned,
});
assert.equal(lineage.validationMessages.length, 1, 'mensagens duplicadas são deduplicadas');
assert.deepEqual(lineage.originalData, cleaned);
assert.throws(() => { (lineage.originalData as Record<string, unknown>).Quantidade = '0'; }, 'originalData deve ser congelado');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importProvenance.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/provenance'` (or similar module-not-found error).

- [ ] **Step 3: Write the contracts**

```ts
// src/imports/types.ts
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
```

```ts
// src/imports/provenance.ts
import { cleanImportValue } from '../utils/importHelpers';
import type { ImportLineage, ImportValidationStatus } from './types';

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');

/** SHA-256 via Web Crypto — disponível no navegador e no Node usado pelos testes, sem dependência nova. */
export const computeSourceHash = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
};

const slugifyFileName = (fileName: string): string => fileName
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40) || 'arquivo';

/** Determinístico: o mesmo arquivo (mesmo nome + mesmo conteúdo) sempre produz o mesmo lote. */
export const buildImportBatchId = (fileName: string, sourceHash: string): string =>
  `imp-${slugifyFileName(fileName)}-${sourceHash.slice(0, 12)}`;

/**
 * originalData nunca guarda a planilha bruta: cada valor passa por
 * cleanImportValue (mesma normalização usada no restante do app) e ausência
 * vira null, nunca string vazia tratada como dado real.
 */
export const cleanRowForLineage = (raw: Record<string, unknown>): Record<string, string | number | boolean | null> => {
  const cleaned: Record<string, string | number | boolean | null> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const text = cleanImportValue(value);
    cleaned[key] = text === '' ? null : text;
  });
  return cleaned;
};

export const buildRowLineage = (input: {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  sourceHash: string;
  importBatchId: string;
  importedAt: string;
  validationStatus: ImportValidationStatus;
  validationMessages: readonly string[];
  originalData: Record<string, string | number | boolean | null>;
}): ImportLineage => ({
  sourceFile: input.sourceFile,
  sourceSheet: input.sourceSheet,
  sourceRow: input.sourceRow,
  sourceHash: input.sourceHash,
  importedAt: input.importedAt,
  importBatchId: input.importBatchId,
  validationStatus: input.validationStatus,
  validationMessages: [...new Set(input.validationMessages)],
  originalData: Object.freeze({ ...input.originalData }),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importProvenance.test.ts`
Expected: PASS (no output, exit code 0).

- [ ] **Step 5: Register the test and commit**

Add `import './importProvenance.test';` to `tests/run.ts` (append near the other import-related entries, e.g. after `import './importMerge.test';`).

```bash
git add src/imports/types.ts src/imports/provenance.ts tests/importProvenance.test.ts tests/run.ts
git commit -m "feat(imports): contratos compartilhados, hash e linhagem determinística"
```

---

### Task 2: Workbook reader with real last-used-row detection

**Files:**
- Create: `src/imports/workbookReader.ts`
- Test: `tests/importWorkbookReader.test.ts`

**Interfaces:**
- Consumes: `computeSourceHash` from `./provenance` (Task 1); `loadValidatedWorkbook` from `../utils/excelCorporate` (existing); `cleanImportValue` from `../utils/importHelpers` (existing).
- Produces: `WorkbookSheetContent { sheetName: string; headerRow: number; lastUsedRow: number; headers: readonly string[]; rows: readonly { rowNumber: number; values: Record<string, unknown> }[] }`, `WorkbookReadResult { sourceFile: string; sourceHash: string; sheets: readonly WorkbookSheetContent[] }`, `readWorkbookFile(file: File): Promise<WorkbookReadResult>` — used by `runImportPipeline` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importWorkbookReader.test.ts
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

const bytes = await workbook.xlsx.writeBuffer();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importWorkbookReader.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/workbookReader'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/workbookReader.ts
import type ExcelJS from 'exceljs';
import { loadValidatedWorkbook } from '../utils/excelCorporate';
import { cleanImportValue } from '../utils/importHelpers';
import { computeSourceHash } from './provenance';

export interface WorkbookSheetContent {
  readonly sheetName: string;
  readonly headerRow: number;
  readonly lastUsedRow: number;
  readonly headers: readonly string[];
  readonly rows: readonly { rowNumber: number; values: Record<string, unknown> }[];
}

export interface WorkbookReadResult {
  readonly sourceFile: string;
  readonly sourceHash: string;
  readonly sheets: readonly WorkbookSheetContent[];
}

/**
 * Excel guarda formatação até a linha 1.048.576 mesmo sem dado nenhum.
 * eachCell({ includeEmpty: false }) só entrega células com valor real, então
 * uma linha só conta como "usada" quando alguma célula tem valor de fato —
 * estilo sozinho nunca move o limite.
 */
const detectLastUsedRow = (worksheet: ExcelJS.Worksheet): number => {
  let lastUsedRow = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, cell => {
      if (cleanImportValue(cell.value) !== '') lastUsedRow = Math.max(lastUsedRow, rowNumber);
    });
  });
  return lastUsedRow;
};

const detectHeaderRow = (worksheet: ExcelJS.Worksheet, lastUsedRow: number): number => {
  for (let rowNumber = 1; rowNumber <= Math.min(lastUsedRow, 20); rowNumber += 1) {
    const values = worksheet.getRow(rowNumber).values;
    const filled = Array.isArray(values) ? values.filter(value => cleanImportValue(value) !== '').length : 0;
    if (filled >= 2) return rowNumber;
  }
  return 1;
};

const readSheet = (worksheet: ExcelJS.Worksheet): WorkbookSheetContent => {
  const lastUsedRow = detectLastUsedRow(worksheet);
  const headerRow = detectHeaderRow(worksheet, lastUsedRow);
  const headerValues = worksheet.getRow(headerRow).values;
  const headerArray = Array.isArray(headerValues) ? headerValues : [];

  const used = new Set<string>();
  const columnHeaders = new Map<number, string>();
  headerArray.forEach((value, index) => {
    if (index === 0) return; // ExcelJS reserva a posição 0; colunas começam em 1.
    const clean = cleanImportValue(value) || `Coluna ${index}`;
    let candidate = clean;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${clean} ${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    columnHeaders.set(index, candidate);
  });

  const rows: { rowNumber: number; values: Record<string, unknown> }[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= lastUsedRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Record<string, unknown> = {};
    let hasValue = false;
    columnHeaders.forEach((header, columnIndex) => {
      const cellValue = row.getCell(columnIndex).value;
      if (cleanImportValue(cellValue) !== '') hasValue = true;
      values[header] = cellValue;
    });
    if (hasValue) rows.push({ rowNumber, values });
  }

  return {
    sheetName: worksheet.name,
    headerRow,
    lastUsedRow,
    headers: Array.from(columnHeaders.values()),
    rows,
  };
};

export const readWorkbookFile = async (file: File): Promise<WorkbookReadResult> => {
  const buffer = await file.arrayBuffer();
  const sourceHash = await computeSourceHash(new Uint8Array(buffer));
  // loadValidatedWorkbook já valida extensão/tamanho e refaz a leitura sem
  // elementos visuais incompatíveis quando necessário — reaproveitado, não
  // duplicado (a planilha é lida uma segunda vez pelo próprio helper, o que é
  // aceitável dado o limite de 25 MB já validado por ele).
  const workbook = await loadValidatedWorkbook(file);
  return {
    sourceFile: file.name,
    sourceHash,
    sheets: workbook.worksheets.map(readSheet),
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importWorkbookReader.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importWorkbookReader.test';` to `tests/run.ts`.

```bash
git add src/imports/workbookReader.ts tests/importWorkbookReader.test.ts tests/run.ts
git commit -m "feat(imports): leitor de planilha com limite real de linha usada"
```

---

### Task 3: Normalizers that preserve absence

**Files:**
- Create: `src/imports/normalizers.ts`
- Test: `tests/importNormalizers.test.ts`

**Interfaces:**
- Consumes: `cleanImportValue`, `parseImportNumber`, `toImportIsoDate` from `../utils/importHelpers` (existing); `normalizePlate`, `normalizePrefix` from `../utils/canonicalIdentity` (existing).
- Produces: `normalizeImportDateOrNull`, `normalizeImportTimeOrNull`, `normalizeImportDecimalOrNull`, `normalizeImportUnitOrNull`, `normalizeImportInvoiceOrNull`, `normalizeImportPlateOrNull`, `normalizeImportPrefixOrNull`, `normalizeImportTextOrNull` — all `(value: unknown) => X | null` — used by every adapter (Tasks 6-9).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importNormalizers.test.ts
import assert from 'node:assert/strict';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportInvoiceOrNull,
  normalizeImportPlateOrNull,
  normalizeImportPrefixOrNull,
  normalizeImportTextOrNull,
  normalizeImportTimeOrNull,
  normalizeImportUnitOrNull,
} from '../src/imports/normalizers';

assert.equal(normalizeImportDateOrNull('05/01/2026'), '2026-01-05');
assert.equal(normalizeImportDateOrNull(''), null, 'data ausente não vira data inventada');
assert.equal(normalizeImportDateOrNull('lixo'), null);

assert.equal(normalizeImportTimeOrNull('07:59'), '07:59');
assert.equal(normalizeImportTimeOrNull(0.5), '12:00', 'serial Excel 0.5 = meio-dia');
assert.equal(normalizeImportTimeOrNull(''), null, 'horário ausente não vira 00:00');

assert.equal(normalizeImportDecimalOrNull('12,5'), 12.5);
assert.equal(normalizeImportDecimalOrNull('0'), 0, 'zero informado de verdade continua zero');
assert.equal(normalizeImportDecimalOrNull(''), null, 'quantidade ausente não vira zero');
assert.equal(normalizeImportDecimalOrNull(null), null);

assert.equal(normalizeImportUnitOrNull('m³'), 'M3');
assert.equal(normalizeImportUnitOrNull('Ton'), 'TON');
assert.equal(normalizeImportUnitOrNull('un'), 'UN');
assert.equal(normalizeImportUnitOrNull(''), null);

assert.equal(normalizeImportInvoiceOrNull(' 12.345-6 '), '123456');
assert.equal(normalizeImportInvoiceOrNull(''), null);

assert.equal(normalizeImportPlateOrNull('abc-1d23'), 'ABC1D23');
assert.equal(normalizeImportPlateOrNull(''), null);

assert.equal(normalizeImportPrefixOrNull('cb-770'), 'CB770');
assert.equal(normalizeImportPrefixOrNull(''), null);

assert.equal(normalizeImportTextOrNull('  Solo Reforçado  '), 'Solo Reforçado');
assert.equal(normalizeImportTextOrNull(''), null);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importNormalizers.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/normalizers'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/normalizers.ts
import { cleanImportValue, parseImportNumber, toImportIsoDate } from '../utils/importHelpers';
import { normalizePlate, normalizePrefix } from '../utils/canonicalIdentity';

export const normalizeImportDateOrNull = (value: unknown): string | null => {
  const iso = toImportIsoDate(value);
  return iso || null;
};

/** Aceita "HH:mm", "HHhmm", Date e serial Excel (fração do dia). */
export const normalizeImportTimeOrNull = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fraction = value < 1 ? value : value - Math.floor(value);
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const text = cleanImportValue(value);
  const match = text.match(/^(\d{1,2})[:h](\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * parseImportNumber devolve 0 tanto para ausência quanto para "0" real; aqui
 * checamos o texto limpo primeiro para não confundir as duas coisas.
 */
export const normalizeImportDecimalOrNull = (value: unknown): number | null => {
  const text = cleanImportValue(value);
  if (!text) return null;
  return parseImportNumber(value);
};

const UNIT_ALIASES: Record<string, string> = {
  un: 'UN', und: 'UN', unid: 'UN', unidade: 'UN',
  pc: 'PC', pca: 'PC', pcs: 'PC', peca: 'PC',
  mt: 'MT', m: 'MT', metro: 'MT', metros: 'MT',
  m3: 'M3', ton: 'TON', t: 'TON', tonelada: 'TON', toneladas: 'TON',
};

export const normalizeImportUnitOrNull = (value: unknown): string | null => {
  const clean = cleanImportValue(value);
  if (!clean) return null;
  const key = clean.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return UNIT_ALIASES[key] || clean.toUpperCase();
};

export const normalizeImportInvoiceOrNull = (value: unknown): string | null => {
  const clean = cleanImportValue(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean || null;
};

export const normalizeImportPlateOrNull = (value: unknown): string | null => {
  const plate = normalizePlate(value);
  return plate || null;
};

export const normalizeImportPrefixOrNull = (value: unknown): string | null => {
  const prefix = normalizePrefix(value);
  return prefix || null;
};

export const normalizeImportTextOrNull = (value: unknown): string | null => {
  const clean = cleanImportValue(value);
  return clean || null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importNormalizers.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importNormalizers.test';` to `tests/run.ts`.

```bash
git add src/imports/normalizers.ts tests/importNormalizers.test.ts tests/run.ts
git commit -m "feat(imports): normalizadores que preservam ausência"
```

---

### Task 4: Preview consolidation

**Files:**
- Create: `src/imports/preview.ts`
- Test: `tests/importPreview.test.ts`

**Interfaces:**
- Consumes: `ImportDisposition`, `ImportPreview<T>`, `ImportPreviewRow<T>`, `ImportSheetPreview` from `./types` (Task 1).
- Produces: `buildImportPreview<T>(input): ImportPreview<T>` — used by every adapter's `reconcile` (Tasks 6-9) and by `runImportPipeline` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importPreview.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importPreview.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/preview'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/preview.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importPreview.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importPreview.test';` to `tests/run.ts`.

```bash
git add src/imports/preview.ts tests/importPreview.test.ts tests/run.ts
git commit -m "feat(imports): consolidação de prévia por status"
```

---

### Task 5: Apply boundary (blocked dry-run)

**Files:**
- Create: `src/imports/apply.ts`
- Test: `tests/importApply.test.ts`

**Interfaces:**
- Consumes: `ImportApplyResult`, `ImportPreview<T>` from `./types` (Task 1).
- Produces: `applyImportPreview<T>(preview: ImportPreview<T>): ImportApplyResult`, `APPLY_BLOCKED_REASON: string` — used by the `MateriaisTab` wiring (Task 13) to render the disabled-action explanation and, later, by Fases 2-4 as the seam where real persistence will be authorized.

- [ ] **Step 1: Write the failing test**

```ts
// tests/importApply.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importApply.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/apply'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/apply.ts
import type { ImportApplyResult, ImportPreview } from './types';

export const APPLY_BLOCKED_REASON =
  'A persistência de dados reais desta importação não está autorizada nesta rodada. Esta prévia é somente leitura (dry-run).';

/**
 * Fronteira para a futura aplicação transacional (Fases 2-4). Nesta rodada
 * sempre bloqueia: nenhuma linha é gravada em cache local, Firebase ou
 * Supabase a partir daqui.
 */
export const applyImportPreview = <T>(_preview: ImportPreview<T>): ImportApplyResult => ({
  applied: false,
  reason: APPLY_BLOCKED_REASON,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importApply.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importApply.test';` to `tests/run.ts`.

```bash
git add src/imports/apply.ts tests/importApply.test.ts tests/run.ts
git commit -m "feat(imports): fronteira de aplicação bloqueada nesta rodada"
```

---

### Task 6: Receipts adapter (`materials-receipts`)

**Files:**
- Create: `src/imports/adapters/receiptsAdapter.ts`
- Test: `tests/importReceiptsAdapter.test.ts`

**Interfaces:**
- Consumes: `SpreadsheetImportAdapter`, `ImportParseContext`, `ImportRow`, `ImportColumnMapping` from `../types` (Task 1); `buildRowLineage`, `cleanRowForLineage` from `../provenance` (Task 1); `normalizeImportDateOrNull`, `normalizeImportDecimalOrNull`, `normalizeImportInvoiceOrNull`, `normalizeImportTextOrNull`, `normalizeImportUnitOrNull` from `../normalizers` (Task 3); `getImportValue`, `normalizeImportText` from `../../utils/importHelpers` (existing); `normalizeComparable` from `../../utils/canonicalIdentity` (existing); `buildImportPreview` from `../preview` (Task 4); `MovimentoMaterial` from `../../types` (existing, has `data`, `materialDescricao`, `quantidade`, `unidade`, `notaFiscal`).
- Produces: `NormalizedReceiptRow`, `receiptsAdapter: SpreadsheetImportAdapter<NormalizedReceiptRow, readonly MovimentoMaterial[]>` — used by the adapter registry (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importReceiptsAdapter.test.ts
import assert from 'node:assert/strict';
import { receiptsAdapter } from '../src/imports/adapters/receiptsAdapter';
import type { ImportParseContext } from '../src/imports/types';
import type { MovimentoMaterial } from '../src/types';

assert.equal(receiptsAdapter.domain, 'materials-receipts');
assert.equal(receiptsAdapter.supports('Tubos de concreto'), true);
assert.equal(receiptsAdapter.supports('TUBOS PEAD/PVC'), true);
assert.equal(receiptsAdapter.supports('Resumo Geral'), false, 'aba de resumo agregado não vira linha operacional');
assert.equal(receiptsAdapter.supports('Aba Desconhecida'), false);

const mapping = receiptsAdapter.describeColumns(['Data', 'Material', 'NF', 'Coluna Estranha']);
assert.deepEqual(mapping.find(m => m.column === 'NF'), { column: 'NF', mappedTo: 'notaFiscal' });
assert.deepEqual(mapping.find(m => m.column === 'Coluna Estranha'), { column: 'Coluna Estranha', mappedTo: null });

const context: ImportParseContext = {
  sourceFile: 'CONTROLE DE RECEBIMENTO.xlsx',
  sourceHash: 'hash-abc',
  sourceSheet: 'Tubos de concreto',
  importBatchId: 'imp-controle-hashabc',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Material: 'Tubo concreto 400mm', NF: '12.345', 'Quantidade Recebida': 10, Unidade: 'UN' },
    { Data: '06/01/2026', Material: 'Tubo concreto 600mm', NF: '', 'Quantidade Recebida': 4, Unidade: 'UN' },
  ],
};

const parsed = receiptsAdapter.parse(context);
assert.equal(parsed.length, 2);
assert.equal(parsed[0].lineage.sourceRow, 2);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review', 'sem NF a linha fica em conferência, nunca invalidada');
assert.equal(parsed[1].operationalKey, undefined);
assert.match(parsed[1].lineage.validationMessages.join(' '), /nota fiscal/i);

const current: MovimentoMaterial[] = [];
const firstPreview = receiptsAdapter.reconcile(parsed, current);
assert.equal(firstPreview.counts.new, 1);
assert.equal(firstPreview.counts.review, 1);
assert.equal(firstPreview.dryRun, true);

// Reimportar a mesma linha completa contra o estado já existente marca "unchanged", nunca duplica.
const existing: MovimentoMaterial = {
  id: 'mov-1', data: '2026-01-05', tipo: 'Entrada', materialId: 'mat-1',
  materialDescricao: 'Tubo concreto 400mm', quantidade: 10, unidade: 'UN',
  notaFiscal: '12345', responsavel: 'Sistema', criadoEm: '2026-01-05T00:00:00.000Z',
  atualizadoEm: '2026-01-05T00:00:00.000Z',
} as MovimentoMaterial;
const secondPreview = receiptsAdapter.reconcile(parsed, [existing]);
assert.equal(secondPreview.counts.unchanged, 1);
assert.equal(secondPreview.counts.new, 0);
assert.equal(secondPreview.counts.review, 1, 'a linha incompleta continua em conferência, nunca vira duplicata');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importReceiptsAdapter.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/adapters/receiptsAdapter'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/adapters/receiptsAdapter.ts
import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportInvoiceOrNull,
  normalizeImportTextOrNull,
  normalizeImportUnitOrNull,
} from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';
import type { MovimentoMaterial } from '../../types';

// "Resumo Geral" é agregado, não linha de origem — fica deferred de propósito.
const RECOGNIZED_SHEETS = ['tubos de concreto', 'tubos pead/pvc', 'tubos pead', 'madeiras e formas', 'ferramentas e materiais de apoio'];

const FIELD_ALIASES: Record<string, string[]> = {
  data: ['Data', 'Data Recebimento'],
  material: ['Material', 'Descrição', 'Item'],
  especificacao: ['Especificação', 'Especificacao'],
  codigo: ['Código', 'Codigo'],
  quantidadeNota: ['Quantidade Nota', 'Qtd Nota', 'Qtde Nota'],
  quantidadeRecebida: ['Quantidade Recebida', 'Qtd Recebida', 'Recebido'],
  unidade: ['Unidade', 'Un', 'UN'],
  notaFiscal: ['NF', 'Nota Fiscal', 'Nota'],
  localAplicacao: ['Local de Aplicação', 'Local Aplicação', 'Aplicação'],
};

export interface NormalizedReceiptRow {
  readonly data: string | null;
  readonly material: string | null;
  readonly especificacao: string | null;
  readonly codigo: string | null;
  readonly quantidadeNota: number | null;
  readonly quantidadeRecebida: number | null;
  readonly unidade: string | null;
  readonly notaFiscal: string | null;
  readonly localAplicacao: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedReceiptRow): string | undefined => {
  if (!row.notaFiscal || !row.material || !row.data || !row.unidade || row.quantidadeRecebida === null) return undefined;
  return ['recebimento', row.notaFiscal, normalizeComparable(row.material), row.data, row.unidade, row.quantidadeRecebida].join('|');
};

export const receiptsAdapter: SpreadsheetImportAdapter<NormalizedReceiptRow, readonly MovimentoMaterial[]> = {
  domain: 'materials-receipts',
  supports: sheetName => RECOGNIZED_SHEETS.includes(normalizeComparable(sheetName)),
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const value: NormalizedReceiptRow = {
      data: normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data)),
      material: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.material)),
      especificacao: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.especificacao)),
      codigo: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.codigo)),
      quantidadeNota: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidadeNota)),
      quantidadeRecebida: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidadeRecebida)),
      unidade: normalizeImportUnitOrNull(getImportValue(raw, FIELD_ALIASES.unidade)),
      notaFiscal: normalizeImportInvoiceOrNull(getImportValue(raw, FIELD_ALIASES.notaFiscal)),
      localAplicacao: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.localAplicacao)),
    };
    const messages: string[] = [];
    if (!value.data) messages.push('Data ausente ou não reconhecida.');
    if (!value.material) messages.push('Material não identificado.');
    if (!value.notaFiscal) messages.push('Nota fiscal ausente.');
    if (value.quantidadeRecebida === null) messages.push('Quantidade recebida ausente.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta: linha fica em conferência até ser corrigida ou confirmada manualmente.');
    return {
      lineage: buildRowLineage({
        sourceFile: context.sourceFile,
        sourceSheet: context.sourceSheet,
        sourceRow,
        sourceHash: context.sourceHash,
        importBatchId: context.importBatchId,
        importedAt: context.importedAt,
        validationStatus: operationalKey ? 'ready' : 'review',
        validationMessages: messages,
        originalData: cleanRowForLineage(raw),
      }),
      value,
      operationalKey,
    } satisfies ImportRow<NormalizedReceiptRow>;
  }),
  reconcile: (rows, current) => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      const existing = current.find(movimento =>
        normalizeImportInvoiceOrNull(movimento.notaFiscal) === row.value.notaFiscal
        && normalizeComparable(movimento.materialDescricao) === normalizeComparable(row.value.material || '')
        && movimento.data === row.value.data
        && normalizeImportUnitOrNull(movimento.unidade) === row.value.unidade
        && movimento.quantidade === row.value.quantidadeRecebida);
      if (!existing) return { row, disposition: 'new' as const };
      return { row, disposition: 'unchanged' as const, existingReference: existing.id };
    });
    return buildImportPreview({
      batchId: rows[0]?.lineage.importBatchId || '',
      sourceFile: rows[0]?.lineage.sourceFile || '',
      sourceHash: rows[0]?.lineage.sourceHash || '',
      generatedAt: rows[0]?.lineage.importedAt || new Date().toISOString(),
      previewRows,
      sheets: [],
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importReceiptsAdapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importReceiptsAdapter.test';` to `tests/run.ts`.

```bash
git add src/imports/adapters/receiptsAdapter.ts tests/importReceiptsAdapter.test.ts tests/run.ts
git commit -m "feat(imports): adaptador de reconhecimento e prévia de recebimentos"
```

---

### Task 7: Materials movements adapter (`materials-movements`)

**Files:**
- Create: `src/imports/adapters/materialsAdapter.ts`
- Test: `tests/importMaterialsAdapter.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 6, plus `normalizeImportPrefixOrNull`/`normalizeImportPlateOrNull` from `../normalizers` (Task 3).
- Produces: `NormalizedMaterialMovementRow`, `materialsAdapter: SpreadsheetImportAdapter<NormalizedMaterialMovementRow, readonly MovimentoMaterial[]>` — used by the adapter registry (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importMaterialsAdapter.test.ts
import assert from 'node:assert/strict';
import { materialsAdapter } from '../src/imports/adapters/materialsAdapter';
import type { ImportParseContext } from '../src/imports/types';
import type { MovimentoMaterial } from '../src/types';

assert.equal(materialsAdapter.domain, 'materials-movements');
assert.equal(materialsAdapter.supports('Rachão'), true);
assert.equal(materialsAdapter.supports('Bota-fora Lara'), true);
assert.equal(materialsAdapter.supports('Q.E. São Bento'), true);
assert.equal(materialsAdapter.supports('resumo geral'), false, 'resumo agregado fica deferred');
assert.equal(materialsAdapter.supports('Aba qualquer'), false);

const context: ImportParseContext = {
  sourceFile: 'MATERIAIS COMPLEXO DO ALTO TIETÊ.xlsx',
  sourceHash: 'hash-xyz',
  sourceSheet: 'Rachão',
  importBatchId: 'imp-materiais-hashxyz',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Movimento: 'Entrada', Origem: 'Jazida', Destino: 'Frente 3', Quantidade: 40, Unidade: 'M3', Placa: 'ABC1D23' },
    { Data: '', Movimento: 'Saída', Destino: '', Quantidade: '', Unidade: '', Placa: '' },
  ],
};

const parsed = materialsAdapter.parse(context);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);

const preview = materialsAdapter.reconcile(parsed, [] as MovimentoMaterial[]);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importMaterialsAdapter.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/adapters/materialsAdapter'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/adapters/materialsAdapter.ts
import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportPlateOrNull,
  normalizeImportPrefixOrNull,
  normalizeImportTextOrNull,
  normalizeImportUnitOrNull,
} from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';
import type { MovimentoMaterial } from '../../types';

// "lançamentos RENEA" também é lançamento de movimento; "resumo geral" é
// agregado e fica deferred de propósito, igual ao adaptador de recebimentos.
const RECOGNIZED_SHEETS = [
  'rachao', 'macadame', 'solo reforcado', 'bica corrida', 'areia industrial', 'bgs', 'brita 02',
  'bota-fora lara', 'bota fora lara', 'bota-fora itaquareia', 'bota fora itaquareia',
  'q.e. sao bento', 'qe sao bento', 'faixa', 'lancamentos renea',
];

const FIELD_ALIASES: Record<string, string[]> = {
  data: ['Data'],
  tipoMovimento: ['Movimento', 'Tipo', 'Tipo Movimento'],
  origem: ['Origem'],
  destino: ['Destino'],
  quantidade: ['Quantidade', 'Qtd', 'Qtde'],
  unidade: ['Unidade', 'Un', 'UN'],
  placaOuPrefixo: ['Placa', 'Prefixo', 'Placa/Prefixo'],
};

export interface NormalizedMaterialMovementRow {
  readonly material: string;
  readonly data: string | null;
  readonly tipoMovimento: string | null;
  readonly origem: string | null;
  readonly destino: string | null;
  readonly quantidade: number | null;
  readonly unidade: string | null;
  readonly placaOuPrefixo: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedMaterialMovementRow): string | undefined => {
  if (!row.data || !row.destino || row.quantidade === null) return undefined;
  return ['movimento', normalizeComparable(row.material), row.data, normalizeComparable(row.origem || ''), normalizeComparable(row.destino), row.quantidade, row.placaOuPrefixo || ''].join('|');
};

export const materialsAdapter: SpreadsheetImportAdapter<NormalizedMaterialMovementRow, readonly MovimentoMaterial[]> = {
  domain: 'materials-movements',
  supports: sheetName => RECOGNIZED_SHEETS.includes(normalizeComparable(sheetName)),
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const placaOuPrefixoRaw = getImportValue(raw, FIELD_ALIASES.placaOuPrefixo);
    const value: NormalizedMaterialMovementRow = {
      material: context.sourceSheet,
      data: normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data)),
      tipoMovimento: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.tipoMovimento)),
      origem: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.origem)),
      destino: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.destino)),
      quantidade: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidade)),
      unidade: normalizeImportUnitOrNull(getImportValue(raw, FIELD_ALIASES.unidade)),
      placaOuPrefixo: normalizeImportPlateOrNull(placaOuPrefixoRaw) || normalizeImportPrefixOrNull(placaOuPrefixoRaw),
    };
    const messages: string[] = [];
    if (!value.data) messages.push('Data ausente ou não reconhecida.');
    if (!value.destino) messages.push('Destino não identificado.');
    if (value.quantidade === null) messages.push('Quantidade ausente.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta (data + destino + quantidade): linha fica em conferência.');
    return {
      lineage: buildRowLineage({
        sourceFile: context.sourceFile,
        sourceSheet: context.sourceSheet,
        sourceRow,
        sourceHash: context.sourceHash,
        importBatchId: context.importBatchId,
        importedAt: context.importedAt,
        validationStatus: operationalKey ? 'ready' : 'review',
        validationMessages: messages,
        originalData: cleanRowForLineage(raw),
      }),
      value,
      operationalKey,
    } satisfies ImportRow<NormalizedMaterialMovementRow>;
  }),
  reconcile: (rows, current) => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      const existing = current.find(movimento =>
        normalizeComparable(movimento.materialDescricao) === normalizeComparable(row.value.material)
        && movimento.data === row.value.data
        && normalizeComparable(movimento.destino || '') === normalizeComparable(row.value.destino || '')
        && movimento.quantidade === row.value.quantidade);
      if (!existing) return { row, disposition: 'new' as const };
      return { row, disposition: 'unchanged' as const, existingReference: existing.id };
    });
    return buildImportPreview({
      batchId: rows[0]?.lineage.importBatchId || '',
      sourceFile: rows[0]?.lineage.sourceFile || '',
      sourceHash: rows[0]?.lineage.sourceHash || '',
      generatedAt: rows[0]?.lineage.importedAt || new Date().toISOString(),
      previewRows,
      sheets: [],
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importMaterialsAdapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importMaterialsAdapter.test';` to `tests/run.ts`.

```bash
git add src/imports/adapters/materialsAdapter.ts tests/importMaterialsAdapter.test.ts tests/run.ts
git commit -m "feat(imports): adaptador de reconhecimento e prévia de movimentações de materiais"
```

---

### Task 8: Stakes adapter (`stakes`) — recognition and preview only

**Files:**
- Create: `src/imports/adapters/stakesAdapter.ts`
- Test: `tests/importStakesAdapter.test.ts`

**Interfaces:**
- Consumes: `ImportColumnMapping`, `ImportParseContext`, `ImportRow`, `SpreadsheetImportAdapter` from `../types` (Task 1); `buildRowLineage`, `cleanRowForLineage` from `../provenance` (Task 1); `normalizeImportDateOrNull`, `normalizeImportTextOrNull` from `../normalizers` (Task 3); `getImportValue`, `normalizeImportText` from `../../utils/importHelpers`; `normalizeComparable` from `../../utils/canonicalIdentity`; `buildImportPreview` from `../preview` (Task 4).
- Produces: `NormalizedStakeRow`, `stakesAdapter: SpreadsheetImportAdapter<NormalizedStakeRow, undefined>` — used by the adapter registry (Task 10). Full domain rules (peso recebido/movimentado/disponível, ligação movimentação↔cravação) are out of scope for Fase 1 and land in Fase 3, which will extend this same file.

- [ ] **Step 1: Write the failing test**

```ts
// tests/importStakesAdapter.test.ts
import assert from 'node:assert/strict';
import { stakesAdapter } from '../src/imports/adapters/stakesAdapter';
import type { ImportParseContext } from '../src/imports/types';

assert.equal(stakesAdapter.domain, 'stakes');
assert.equal(stakesAdapter.supports('CADASTRO DE MATERIAIS'), true);
assert.equal(stakesAdapter.supports('Veículos e Implementos'), true);
assert.equal(stakesAdapter.supports('Lançamentos Logísticos'), true);
assert.equal(stakesAdapter.supports('Cravações'), true);
assert.equal(stakesAdapter.supports('Conferência'), true);
assert.equal(stakesAdapter.supports('Lista Auxiliar 1'), true);
assert.equal(stakesAdapter.supports('Resumo'), true);
assert.equal(stakesAdapter.supports('Aba sem relação nenhuma'), false, 'aba fora das categorias esperadas fica deferred');

const context: ImportParseContext = {
  sourceFile: 'CRAVAÇÕES DE ESTACAS PRANCHA.xlsx',
  sourceHash: 'hash-stk',
  sourceSheet: 'Cravações',
  importBatchId: 'imp-cravacoes-hashstk',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Item: 'Perfil PS-27', 'NF/Lote': 'LOTE-9' },
    { Data: '', Item: '', 'NF/Lote': '' },
  ],
};

const parsed = stakesAdapter.parse(context);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);

const preview = stakesAdapter.reconcile(parsed, undefined);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importStakesAdapter.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/adapters/stakesAdapter'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/adapters/stakesAdapter.ts
import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import { normalizeImportDateOrNull, normalizeImportTextOrNull } from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';

/**
 * Diferente dos arquivos de recebimentos/materiais, o nome real das abas de
 * estacas não é conhecido linha a linha na especificação (só categorias
 * descritas). Por isso o reconhecimento é por palavra-chave, não lista exata
 * — abas que não batem em nenhuma categoria ficam deferred com o motivo.
 */
const STAKE_SHEET_KEYWORDS = [
  'cadastro', 'veiculo', 'implemento', 'lancamento', 'movimento', 'logistic',
  'cravac', 'conferenc', 'auxiliar', 'lista', 'resumo',
];

const matchesStakeSheet = (sheetName: string): boolean => {
  const normalized = normalizeComparable(sheetName);
  return STAKE_SHEET_KEYWORDS.some(keyword => normalized.includes(keyword));
};

const FIELD_ALIASES: Record<string, string[]> = {
  item: ['Item', 'Perfil', 'Descrição'],
  perfil: ['Perfil', 'Modelo'],
  notaOuLote: ['NF', 'Lote', 'NF/Lote'],
  data: ['Data'],
  observacao: ['Observação', 'Observacao'],
};

export interface NormalizedStakeRow {
  readonly categoria: string;
  readonly item: string | null;
  readonly perfil: string | null;
  readonly notaOuLote: string | null;
  readonly data: string | null;
  readonly observacao: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedStakeRow): string | undefined => {
  if (!row.notaOuLote || !row.item || !row.data) return undefined;
  return ['estaca', row.notaOuLote, normalizeComparable(row.item), row.data].join('|');
};

export const stakesAdapter: SpreadsheetImportAdapter<NormalizedStakeRow, undefined> = {
  domain: 'stakes',
  supports: matchesStakeSheet,
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const value: NormalizedStakeRow = {
      categoria: context.sourceSheet,
      item: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.item)),
      perfil: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.perfil)),
      notaOuLote: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.notaOuLote)),
      data: normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data)),
      observacao: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.observacao)),
    };
    const messages: string[] = [];
    if (!value.item) messages.push('Item/perfil não identificado nesta linha.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta (NF/lote + item/perfil + data): linha fica em conferência.');
    return {
      lineage: buildRowLineage({
        sourceFile: context.sourceFile,
        sourceSheet: context.sourceSheet,
        sourceRow,
        sourceHash: context.sourceHash,
        importBatchId: context.importBatchId,
        importedAt: context.importedAt,
        validationStatus: operationalKey ? 'ready' : 'review',
        validationMessages: messages,
        originalData: cleanRowForLineage(raw),
      }),
      value,
      operationalKey,
    } satisfies ImportRow<NormalizedStakeRow>;
  }),
  reconcile: rows => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      // Fase 1 não recebe o estado atual de lotes/cravações: toda linha com
      // chave completa e inédita no arquivo é "new". A comparação contra
      // lotes/cravações já existentes é adicionada na Fase 3.
      return { row, disposition: 'new' as const };
    });
    return buildImportPreview({
      batchId: rows[0]?.lineage.importBatchId || '',
      sourceFile: rows[0]?.lineage.sourceFile || '',
      sourceHash: rows[0]?.lineage.sourceHash || '',
      generatedAt: rows[0]?.lineage.importedAt || new Date().toISOString(),
      previewRows,
      sheets: [],
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importStakesAdapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importStakesAdapter.test';` to `tests/run.ts`.

```bash
git add src/imports/adapters/stakesAdapter.ts tests/importStakesAdapter.test.ts tests/run.ts
git commit -m "feat(imports): adaptador de reconhecimento e prévia de estacas-prancha"
```

---

### Task 9: Travels adapter (`travels`) — recognition and preview only

**Files:**
- Create: `src/imports/adapters/travelsAdapter.ts`
- Test: `tests/importTravelsAdapter.test.ts`

**Interfaces:**
- Consumes: same shared modules as Task 8, plus `normalizeImportDecimalOrNull`, `normalizeImportPlateOrNull`, `normalizeImportPrefixOrNull`, `normalizeImportTimeOrNull` from `../normalizers` (Task 3).
- Produces: `NormalizedTravelRow`, `travelsAdapter: SpreadsheetImportAdapter<NormalizedTravelRow, undefined>` — used by the adapter registry (Task 10). The full 12-state reconciliation between vias (`completo`, `somente liberado`, `placa divergente`, etc.) is out of scope for Fase 1 and lands in Fase 4.

- [ ] **Step 1: Write the failing test**

```ts
// tests/importTravelsAdapter.test.ts
import assert from 'node:assert/strict';
import { travelsAdapter } from '../src/imports/adapters/travelsAdapter';
import type { ImportParseContext } from '../src/imports/types';

assert.equal(travelsAdapter.domain, 'travels');
assert.equal(travelsAdapter.supports('LIBERAÇÃO'), true);
assert.equal(travelsAdapter.supports('recebimento'), true);
assert.equal(travelsAdapter.supports('Cadastro'), true);
assert.equal(travelsAdapter.supports('Conferência'), true);
assert.equal(travelsAdapter.supports('Resumo'), true);
assert.equal(travelsAdapter.supports('Aba fora do padrão'), false);

const context: ImportParseContext = {
  sourceFile: 'VIAGENS JAZIDA SABESP.xlsx',
  sourceHash: 'hash-trv',
  sourceSheet: 'LIBERAÇÃO',
  importBatchId: 'imp-viagens-hashtrv',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Ticket: '000123', Prefixo: 'CB-770', Material: 'Solo', Quantidade: 12, Destino: 'Marginal', Horário: '08:15' },
    { Ticket: '', Prefixo: '', Material: '', Quantidade: '', Destino: '', Horário: '' },
  ],
};

const parsed = travelsAdapter.parse(context);
assert.equal(parsed[0].value.via, 'liberacao');
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);

const preview = travelsAdapter.reconcile(parsed, undefined);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importTravelsAdapter.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/adapters/travelsAdapter'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/adapters/travelsAdapter.ts
import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import { normalizeImportDecimalOrNull, normalizeImportPlateOrNull, normalizeImportPrefixOrNull, normalizeImportTextOrNull, normalizeImportTimeOrNull } from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';

const RECOGNIZED_SHEETS = ['liberacao', 'recebimento', 'cadastro', 'conferencia', 'resumo'];

const FIELD_ALIASES: Record<string, string[]> = {
  ticket: ['Ticket', 'Número', 'Numero', 'Ticket Nº'],
  prefixoOuPlaca: ['Prefixo', 'Placa'],
  material: ['Material', 'Tipo de Material'],
  quantidade: ['Quantidade', 'Qtd', 'Qtde'],
  destino: ['Destino', 'Ramo', 'Destino/Obra'],
  horario: ['Horário', 'Horario', 'Hora'],
};

export type TravelVia = 'liberacao' | 'recebimento' | 'evidencia';

export interface NormalizedTravelRow {
  readonly via: TravelVia;
  readonly ticket: string | null;
  readonly prefixoOuPlaca: string | null;
  readonly material: string | null;
  readonly quantidade: number | null;
  readonly destino: string | null;
  readonly horario: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const viaFromSheet = (sheetName: string): TravelVia => {
  const normalized = normalizeComparable(sheetName);
  if (normalized === 'liberacao') return 'liberacao';
  if (normalized === 'recebimento') return 'recebimento';
  return 'evidencia';
};

const buildOperationalKey = (row: NormalizedTravelRow): string | undefined =>
  row.ticket ? ['viagem', row.ticket, row.via].join('|') : undefined;

export const travelsAdapter: SpreadsheetImportAdapter<NormalizedTravelRow, undefined> = {
  domain: 'travels',
  supports: sheetName => RECOGNIZED_SHEETS.includes(normalizeComparable(sheetName)),
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const prefixoOuPlacaRaw = getImportValue(raw, FIELD_ALIASES.prefixoOuPlaca);
    const value: NormalizedTravelRow = {
      via: viaFromSheet(context.sourceSheet),
      ticket: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.ticket)),
      prefixoOuPlaca: normalizeImportPrefixOrNull(prefixoOuPlacaRaw) || normalizeImportPlateOrNull(prefixoOuPlacaRaw),
      material: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.material)),
      quantidade: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidade)),
      destino: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.destino)),
      horario: normalizeImportTimeOrNull(getImportValue(raw, FIELD_ALIASES.horario)),
    };
    const messages: string[] = [];
    if (!value.ticket) messages.push('Ticket ausente ou não reconhecido.');
    if (!value.destino) messages.push('Destino/ramo ausente.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta (ticket + tipo de via): linha fica em conferência.');
    return {
      lineage: buildRowLineage({
        sourceFile: context.sourceFile,
        sourceSheet: context.sourceSheet,
        sourceRow,
        sourceHash: context.sourceHash,
        importBatchId: context.importBatchId,
        importedAt: context.importedAt,
        validationStatus: operationalKey ? 'ready' : 'review',
        validationMessages: messages,
        originalData: cleanRowForLineage(raw),
      }),
      value,
      operationalKey,
    } satisfies ImportRow<NormalizedTravelRow>;
  }),
  reconcile: rows => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      // A comparação entre vias (liberação × recebimento) com os 12 estados
      // do painel é implementada na Fase 4; aqui cada via só marca "new".
      return { row, disposition: 'new' as const };
    });
    return buildImportPreview({
      batchId: rows[0]?.lineage.importBatchId || '',
      sourceFile: rows[0]?.lineage.sourceFile || '',
      sourceHash: rows[0]?.lineage.sourceHash || '',
      generatedAt: rows[0]?.lineage.importedAt || new Date().toISOString(),
      previewRows,
      sheets: [],
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importTravelsAdapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importTravelsAdapter.test';` to `tests/run.ts`.

```bash
git add src/imports/adapters/travelsAdapter.ts tests/importTravelsAdapter.test.ts tests/run.ts
git commit -m "feat(imports): adaptador de reconhecimento e prévia de viagens da jazida"
```

---

### Task 10: Adapter registry and deferred-sheet classification

**Files:**
- Create: `src/imports/adapters/index.ts`
- Test: `tests/importAdapterRegistry.test.ts`

**Interfaces:**
- Consumes: `receiptsAdapter` (Task 6), `materialsAdapter` (Task 7), `stakesAdapter` (Task 8), `travelsAdapter` (Task 9); `ImportSheetPreview` from `../types` (Task 1).
- Produces: `IMPORT_ADAPTERS: readonly SpreadsheetImportAdapter<unknown, unknown>[]`, `findAdapterForSheet(sheetName: string)`, `classifySheet(sheetName: string, headers: readonly string[], rowCount: number): ImportSheetPreview` — used by `runImportPipeline` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importAdapterRegistry.test.ts
import assert from 'node:assert/strict';
import { classifySheet, findAdapterForSheet } from '../src/imports/adapters';

assert.ok(findAdapterForSheet('Tubos de concreto'));
assert.equal(findAdapterForSheet('Tubos de concreto')?.domain, 'materials-receipts');
assert.equal(findAdapterForSheet('Rachão')?.domain, 'materials-movements');
assert.equal(findAdapterForSheet('Cravações')?.domain, 'stakes');
assert.equal(findAdapterForSheet('LIBERAÇÃO')?.domain, 'travels');
assert.equal(findAdapterForSheet('Aba Nunca Vista'), undefined);

const recognized = classifySheet('Tubos de concreto', ['Data', 'NF'], 5);
assert.equal(recognized.recognized, true);
assert.equal(recognized.domain, 'materials-receipts');
assert.equal(recognized.rowCount, 5);
assert.ok(recognized.columnMapping?.some(mapping => mapping.column === 'NF' && mapping.mappedTo === 'notaFiscal'));

const deferred = classifySheet('Aba Nunca Vista', ['X', 'Y'], 3);
assert.equal(deferred.recognized, false);
assert.equal(deferred.rowCount, 3);
assert.ok(deferred.reason);
assert.equal(deferred.columnMapping, undefined);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importAdapterRegistry.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/adapters'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/adapters/index.ts
import type { ImportSheetPreview, SpreadsheetImportAdapter } from '../types';
import { receiptsAdapter } from './receiptsAdapter';
import { materialsAdapter } from './materialsAdapter';
import { stakesAdapter } from './stakesAdapter';
import { travelsAdapter } from './travelsAdapter';

/**
 * Registro heterogêneo: cada adaptador tem seu próprio T/TCurrent, apagados
 * aqui para `unknown`. A interface usa sintaxe de método (não propriedades em
 * formato de função), então o TypeScript aceita essa variância; o roteamento
 * por `domain` em runImportPipeline garante o tipo correto de `current` em
 * tempo de execução.
 */
export const IMPORT_ADAPTERS: readonly SpreadsheetImportAdapter<unknown, unknown>[] = [
  receiptsAdapter as SpreadsheetImportAdapter<unknown, unknown>,
  materialsAdapter as SpreadsheetImportAdapter<unknown, unknown>,
  stakesAdapter as SpreadsheetImportAdapter<unknown, unknown>,
  travelsAdapter as SpreadsheetImportAdapter<unknown, unknown>,
];

export const findAdapterForSheet = (sheetName: string) =>
  IMPORT_ADAPTERS.find(adapter => adapter.supports(sheetName));

export const classifySheet = (
  sheetName: string,
  headers: readonly string[],
  rowCount: number,
): ImportSheetPreview => {
  const adapter = findAdapterForSheet(sheetName);
  if (!adapter) {
    return {
      sheetName,
      recognized: false,
      rowCount,
      reason: 'Nenhum adaptador reconhece esta aba; revise o nome ou mapeie manualmente.',
    };
  }
  return {
    sheetName,
    recognized: true,
    domain: adapter.domain,
    rowCount,
    columnMapping: adapter.describeColumns(headers),
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importAdapterRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test and commit**

Add `import './importAdapterRegistry.test';` to `tests/run.ts`.

```bash
git add src/imports/adapters/index.ts tests/importAdapterRegistry.test.ts tests/run.ts
git commit -m "feat(imports): registro de adaptadores e classificação de abas pendentes"
```

---

### Task 11: Reusable pipeline orchestrator + idempotency and cloud-SDK guard tests

**Files:**
- Create: `src/imports/runImportPipeline.ts`
- Test: `tests/importPipelineIdempotency.test.ts`

**Interfaces:**
- Consumes: `WorkbookReadResult` from `./workbookReader` (Task 2); `findAdapterForSheet`, `classifySheet` from `./adapters` (Task 10); `buildImportBatchId` from `./provenance` (Task 1); `buildImportPreview` from `./preview` (Task 4); `ImportDomain`, `ImportParseContext`, `ImportPreview`, `ImportPreviewRow`, `ImportSheetPreview` from `./types` (Task 1).
- Produces: `runImportPipeline(workbook: WorkbookReadResult, resolveCurrent: (domain: ImportDomain) => unknown, now?: Date): ImportPreview<unknown>` — used by `MateriaisTab` (Task 13) today, and reusable as-is by Estacas (Fase 3) and Tickets (Fase 4).

- [ ] **Step 1: Write the failing test**

```ts
// tests/importPipelineIdempotency.test.ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { File } from 'node:buffer';
import ExcelJS from 'exceljs';
import { readWorkbookFile } from '../src/imports/workbookReader';
import { runImportPipeline } from '../src/imports/runImportPipeline';
import type { MovimentoMaterial } from '../src/types';

// --- Reimportação idempotente: mesmo arquivo, mesmo lote, mesma classificação ---
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Tubos de concreto');
sheet.addRow(['Data', 'Material', 'NF', 'Quantidade Recebida', 'Unidade']);
sheet.addRow(['05/01/2026', 'Tubo concreto 400mm', '12345', 10, 'UN']);
sheet.addRow(['06/01/2026', 'Tubo concreto 600mm', '', 4, 'UN']);
const bytes = await workbook.xlsx.writeBuffer();

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
  atualizadoEm: '2026-01-05T00:00:00.000Z',
} as MovimentoMaterial;
const secondPreviewWithState = runImportPipeline(readTwice, () => [alreadyImported]);
assert.equal(secondPreviewWithState.counts.unchanged, 1, 'reimportar contra o estado já aplicado marca unchanged, nunca duplica um novo registro');
assert.equal(secondPreviewWithState.counts.new, 0);
assert.equal(secondPreviewWithState.counts.review, 1, 'a linha sem NF continua em conferência nas duas rodadas');
assert.equal(secondPreviewWithState.dryRun, true);

// --- Nenhuma importação usa SDK de nuvem ---
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/importPipelineIdempotency.test.ts`
Expected: FAIL — `Cannot find module '../src/imports/runImportPipeline'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/imports/runImportPipeline.ts
import type { ImportDomain, ImportParseContext, ImportPreview, ImportPreviewRow, ImportSheetPreview } from './types';
import type { WorkbookReadResult } from './workbookReader';
import { classifySheet, findAdapterForSheet } from './adapters';
import { buildImportBatchId } from './provenance';
import { buildImportPreview } from './preview';

/**
 * Orquestra leitor → adaptador → prévia para um workbook já lido em memória.
 * `resolveCurrent` devolve o estado atual do domínio (ex.: movimentos de
 * materiais) para reconciliação; domínios sem estado ligado ainda (estacas e
 * viagens, até as Fases 3 e 4) recebem `undefined`. Reaproveitável tal como
 * está por Materiais (Fase 1), Estacas (Fase 3) e Tickets (Fase 4).
 */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/importPipelineIdempotency.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the test, run the full suite, and commit**

Add `import './importPipelineIdempotency.test';` to `tests/run.ts`.

Run: `npm test`
Expected: PASS — all suites registered so far in `tests/run.ts`, including the eleven added in Tasks 1-11, run clean.

```bash
git add src/imports/runImportPipeline.ts tests/importPipelineIdempotency.test.ts tests/run.ts
git commit -m "feat(imports): pipeline reutilizável com prova de idempotência e sem SDK de nuvem"
```

---

### Task 12: Evolve `SpreadsheetImportReview` with lineage, dry-run, and disabled apply

**Files:**
- Modify: `src/components/SpreadsheetImportReview.tsx` (full file, shown below)
- Test: `tests/spreadsheetImportReviewUi.test.ts`

**Interfaces:**
- Consumes: none new from `src/imports/` directly (the component stays React-only and receives a plain view-model prop so it has no dependency on the import pipeline's types).
- Produces: `ImportBatchPreviewViewModel` (exported from the component file) — used by `MateriaisTab` (Task 13) to build the `batchPreview` prop. Existing props (`open`, `title`, `fileName`, `validCount`, `ignoredCount`, `columns`, `rows`, `note`, `analysis`, `confirming`, `onCancel`, `onConfirm`) are unchanged, so `CadastrosTab`, `LancamentosTab`, and `TicketsJazidaTab` need no changes.

This test follows the repo's existing source-inspection convention for component tests (see `tests/cadastrosTabUi.test.ts`), since there is no DOM-rendering test harness in the unit suite.

- [ ] **Step 1: Write the failing test**

```ts
// tests/spreadsheetImportReviewUi.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/SpreadsheetImportReview.tsx', import.meta.url), 'utf8');

assert.match(source, /batchPreview/, 'prop opcional de prévia com linhagem deve existir');
assert.match(source, /Lote de importação/i);
assert.match(source, /Hash do arquivo/i);
assert.match(source, /Executar dry-run/);
assert.match(source, /Aplicar importação/);
assert.match(source, /persistência de dados reais não (?:está|foi) autorizada/i);
assert.match(source, /sem correspondência/i, 'coluna sem mapeamento precisa aparecer explicitamente');
assert.match(source, /disabled\b/);
// A prop antiga continua existindo e sendo usada, então os três chamadores atuais não quebram.
assert.match(source, /onConfirm/);
assert.match(source, /validCount/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/spreadsheetImportReviewUi.test.ts`
Expected: FAIL — no match for `batchPreview` (and the other new strings) in the current file.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/components/SpreadsheetImportReview.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Columns3, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
import OperationalAnalysisPanel from './OperationalAnalysisPanel';
import type { OperationalAnalysis } from '../utils/operationalAnalysis';

export interface SpreadsheetPreviewRow {
  [column: string]: string | number | null | undefined;
}

export interface ImportBatchSheetViewModel {
  readonly sheetName: string;
  readonly recognized: boolean;
  readonly domain?: string;
  readonly rowCount: number;
  readonly reason?: string;
  readonly columnMapping?: readonly { column: string; mappedTo: string | null }[];
}

export interface ImportBatchRowViewModel {
  readonly reference: string;
  readonly status: string;
  readonly messages: readonly string[];
}

/**
 * Prévia com linhagem completa (Fase 1 da importação auditável). Opcional:
 * quando ausente, o modal se comporta exatamente como antes.
 */
export interface ImportBatchPreviewViewModel {
  readonly batchId: string;
  readonly sourceHash: string;
  readonly sheets: readonly ImportBatchSheetViewModel[];
  readonly counts: Readonly<Record<string, number>>;
  readonly rows: readonly ImportBatchRowViewModel[];
  readonly dryRunRan: boolean;
  readonly onRunDryRun: () => void;
}

interface SpreadsheetImportReviewProps {
  open: boolean;
  title: string;
  fileName: string;
  validCount: number;
  ignoredCount?: number;
  columns: string[];
  rows: SpreadsheetPreviewRow[];
  note?: string;
  analysis?: OperationalAnalysis;
  confirming?: boolean;
  batchPreview?: ImportBatchPreviewViewModel;
  onCancel: () => void;
  onConfirm: () => void;
}

const displayValue = (value: SpreadsheetPreviewRow[string]) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

export default function SpreadsheetImportReview({
  open,
  title,
  fileName,
  validCount,
  ignoredCount = 0,
  columns,
  rows,
  note,
  analysis,
  confirming = false,
  batchPreview,
  onCancel,
  onConfirm
}: SpreadsheetImportReviewProps) {
  const [query, setQuery] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setShowAllColumns(false);
  }, [open, fileName]);
  const previewColumns = showAllColumns ? columns : columns.slice(0, 6);
  const visibleRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    if (!term) return rows;
    return rows.filter(row => columns.some(column => displayValue(row[column]).toLocaleLowerCase('pt-BR').includes(term)));
  }, [columns, query, rows]);

  return (
    <>
      {open && (
        <div
          className="renea-enter fixed inset-0 z-[120] flex items-center justify-center bg-white p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spreadsheet-import-title"
        >
          <div
            className="renea-enter flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Revisão da importação</p>
                  <h2 id="spreadsheet-import-title" className="mt-1 text-lg font-black text-slate-950">{title}</h2>
                  <p className="mt-1 truncate text-xs text-slate-500" title={fileName}>{fileName}</p>
                </div>
              </div>
              <button type="button" onClick={onCancel} disabled={confirming} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" title="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {!batchPreview && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500">Linhas reconhecidas</span>
                    <strong className="mt-1 block text-2xl text-slate-950">{rows.length}</strong>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                    <span className="text-[10px] font-black uppercase text-emerald-700">Prontas para importar</span>
                    <strong className="mt-1 block text-2xl text-emerald-950">{validCount}</strong>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <span className="text-[10px] font-black uppercase text-amber-700">Sem dados reconhecíveis</span>
                    <strong className="mt-1 block text-2xl text-amber-950">{ignoredCount}</strong>
                  </div>
                  <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500">Colunas reconhecidas</span>
                    <strong className="mt-1 block text-2xl text-slate-950">{columns.length}</strong>
                  </div>
                </div>
              )}

              {note && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold leading-relaxed text-sky-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                  <span>{note}</span>
                </div>
              )}

              {analysis && (
                <div className="mt-4">
                  <OperationalAnalysisPanel analysis={analysis} variant="light" />
                </div>
              )}

              {batchPreview && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-500">Lote de importação</span>
                        <p className="mt-1 font-mono text-xs text-slate-800">{batchPreview.batchId}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-slate-500">Hash do arquivo (SHA-256)</span>
                        <p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={batchPreview.sourceHash}>
                          {batchPreview.sourceHash.slice(0, 16)}…
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {Object.entries(batchPreview.counts).map(([status, count]) => (
                      <div key={status} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <span className="text-[9px] font-black uppercase text-slate-500">{status}</span>
                        <strong className="mt-1 block text-lg text-slate-950">{count}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                      <h3 className="text-xs font-black uppercase text-slate-700">Abas da planilha</h3>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {batchPreview.sheets.map(sheet => (
                        <li key={sheet.sheetName} className="px-4 py-2.5 text-xs">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-bold text-slate-800">{sheet.sheetName}</span>
                            {sheet.recognized ? (
                              <span className="text-emerald-700">{sheet.domain} · {sheet.rowCount} linha(s)</span>
                            ) : (
                              <span className="text-amber-700">Pendente de mapeamento · {sheet.rowCount} linha(s) · {sheet.reason}</span>
                            )}
                          </div>
                          {sheet.columnMapping && sheet.columnMapping.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {sheet.columnMapping.map(mapping => (
                                <span
                                  key={mapping.column}
                                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${mapping.mappedTo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
                                  title={mapping.mappedTo ? `Mapeada para ${mapping.mappedTo}` : 'Coluna sem correspondência'}
                                >
                                  {mapping.column}{mapping.mappedTo ? ` → ${mapping.mappedTo}` : ' (sem correspondência)'}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                      <h3 className="text-xs font-black uppercase text-slate-700">Linhas e referência de origem</h3>
                    </div>
                    <ul className="max-h-[30vh] divide-y divide-slate-100 overflow-auto">
                      {batchPreview.rows.slice(0, 200).map((row, index) => (
                        <li key={index} className="px-4 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-slate-700">{row.reference}</span>
                            <span className="font-black uppercase text-slate-500">{row.status}</span>
                          </div>
                          {row.messages.length > 0 && (
                            <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-500">
                              {row.messages.map((message, messageIndex) => <li key={messageIndex}>{message}</li>)}
                            </ul>
                          )}
                        </li>
                      ))}
                      {batchPreview.rows.length === 0 && (
                        <li className="px-4 py-6 text-center text-xs font-semibold text-slate-500">Nenhuma linha classificada.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {!batchPreview && (
                <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-700">Conferência dos dados</h3>
                      <span className="text-[10px] font-bold text-slate-500">Mostrando até 50 linhas • {visibleRows.length} encontrada(s)</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Localizar na importação" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-500 sm:w-56" />
                      </label>
                      {columns.length > 6 && (
                        <button type="button" onClick={() => setShowAllColumns(value => !value)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-100">
                          <Columns3 className="h-3.5 w-3.5" /> {showAllColumns ? 'Colunas principais' : `Ver ${columns.length} colunas`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[44vh] overflow-auto">
                    <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-white">
                          {previewColumns.map(column => (
                            <th key={column} className="border-b border-slate-200 px-3 py-2.5 font-black text-slate-600">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.slice(0, 50).map((row, index) => (
                          <tr key={index} className="odd:bg-slate-50/70">
                            {previewColumns.map(column => (
                              <td key={column} className="max-w-52 truncate border-b border-slate-100 px-3 py-2.5 text-slate-700" title={displayValue(row[column])}>
                                {displayValue(row[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {visibleRows.length === 0 && (
                          <tr><td colSpan={Math.max(1, previewColumns.length)} className="px-4 py-8 text-center text-xs font-semibold text-slate-500">Nenhuma linha corresponde à pesquisa.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {batchPreview ? (
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-[10px] font-bold leading-relaxed text-slate-500 sm:max-w-md">
                  A persistência de dados reais desta importação não está autorizada nesta rodada. Use o dry-run para conferir o resultado; nada é gravado.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={onCancel} className="min-h-10 rounded-md border border-slate-300 bg-white px-5 text-xs font-black text-slate-700 hover:bg-slate-100">
                    Fechar
                  </button>
                  <button type="button" onClick={batchPreview.onRunDryRun} className="min-h-10 rounded-md border border-emerald-600 bg-white px-5 text-xs font-black text-emerald-700 hover:bg-emerald-50">
                    {batchPreview.dryRunRan ? 'Executar dry-run novamente' : 'Executar dry-run'}
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Persistência de dados reais não autorizada nesta rodada."
                    className="min-h-10 cursor-not-allowed rounded-md bg-slate-300 px-5 text-xs font-black text-slate-600"
                  >
                    Aplicar importação
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button type="button" onClick={onCancel} disabled={confirming} className="min-h-10 rounded-md border border-slate-300 bg-white px-5 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                  Cancelar
                </button>
                <button type="button" onClick={onConfirm} disabled={confirming || validCount === 0} className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-xs font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {confirming ? 'Importando...' : `Confirmar ${validCount} registro(s)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/spreadsheetImportReviewUi.test.ts`
Expected: PASS.

Also run the three existing suites that render this component through their own tabs to confirm nothing broke: `npx tsx tests/cadastrosTabUi.test.ts` (if it touches import review) — otherwise run `npm test` at the end of this task to cover `CadastrosTab`/`LancamentosTab`/`TicketsJazidaTab` indirectly.

- [ ] **Step 5: Register the test, run the full suite, and commit**

Add `import './spreadsheetImportReviewUi.test';` to `tests/run.ts`.

Run: `npm test`
Expected: PASS — confirms `CadastrosTab`, `LancamentosTab`, and `TicketsJazidaTab` (existing callers) still compile and their own tests still pass with the now-optional `batchPreview` prop.

```bash
git add src/components/SpreadsheetImportReview.tsx tests/spreadsheetImportReviewUi.test.ts tests/run.ts
git commit -m "feat(import-review): linhagem, dry-run e aplicação bloqueada na prévia"
```

---

### Task 13: Wire the import preview into `MateriaisTab`

**Files:**
- Create: `src/components/MateriaisImportacoesPanel.tsx`
- Modify: `src/components/MateriaisTab.tsx:15` (import), `:52` (tab type), `:342` (tab button), `:365`-`:468` (search/table block wrap) — four small anchored edits, detailed below — no full-file rewrite. Line numbers verified directly against this worktree's current file (`codex/expandir-painel-erp-de-obra`), which already has a `materials-dashboard` section between `PageHeader` and the tab buttons that `main` does not — the edits below match the anchors as they exist here.
- Test: `tests/materiaisImportUi.test.ts`

**Interfaces:**
- Consumes: `readWorkbookFile` from `../imports/workbookReader` (Task 2); `runImportPipeline` from `../imports/runImportPipeline` (Task 11); `ImportDisposition`, `ImportPreview` from `../imports/types` (Task 1); `SpreadsheetImportReview`, `ImportBatchPreviewViewModel` from `./SpreadsheetImportReview` (Task 12); `MovimentoMaterial` from `../types` (existing).
- Produces: `MateriaisImportacoesPanel` component, rendered by `MateriaisTab` when `aba === 'importacoes'`. No new props are added to `MateriaisTabProps` — `materiais`/`movimentos` already flow in.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/materiaisImportUi.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelSource = readFileSync(new URL('../src/components/MateriaisImportacoesPanel.tsx', import.meta.url), 'utf8');
assert.match(panelSource, /readWorkbookFile/);
assert.match(panelSource, /runImportPipeline/);
assert.match(panelSource, /batchPreview/);
assert.match(panelSource, /materials-receipts/);
assert.match(panelSource, /materials-movements/);
assert.doesNotMatch(panelSource, /firebase|supabase/i);

const tabSource = readFileSync(new URL('../src/components/MateriaisTab.tsx', import.meta.url), 'utf8');
assert.match(tabSource, /'importacoes'/);
assert.match(tabSource, /MateriaisImportacoesPanel/);
assert.match(tabSource, /Importações/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/materiaisImportUi.test.ts`
Expected: FAIL — `Cannot find module '../src/components/MateriaisImportacoesPanel'` (and no match for `'importacoes'`/`MateriaisImportacoesPanel` in `MateriaisTab.tsx`).

- [ ] **Step 3a: Create the panel component**

```tsx
// src/components/MateriaisImportacoesPanel.tsx
import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import SpreadsheetImportReview, { type ImportBatchPreviewViewModel } from './SpreadsheetImportReview';
import { readWorkbookFile } from '../imports/workbookReader';
import { runImportPipeline } from '../imports/runImportPipeline';
import type { ImportDisposition, ImportPreview } from '../imports/types';
import type { MovimentoMaterial } from '../types';

interface MateriaisImportacoesPanelProps {
  movimentos: MovimentoMaterial[];
  onError: (message: string) => void;
}

const STATUS_LABELS: Record<ImportDisposition, string> = {
  new: 'Novo',
  'potential-update': 'Possível atualização',
  unchanged: 'Sem alteração',
  'duplicate-in-file': 'Duplicado no arquivo',
  review: 'Conferência',
  invalid: 'Inválido',
  deferred: 'Adiado',
};

/**
 * Prévia/dry-run apenas (Fase 1). A aplicação real desta importação segue
 * bloqueada em SpreadsheetImportReview até autorização explícita.
 */
export default function MateriaisImportacoesPanel({ movimentos, onError }: MateriaisImportacoesPanelProps) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview<unknown> | null>(null);
  const [dryRunRan, setDryRunRan] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const handleFileSelected = async (file: File) => {
    setIsReading(true);
    setDryRunRan(false);
    try {
      const workbook = await readWorkbookFile(file);
      const result = runImportPipeline(workbook, domain =>
        (domain === 'materials-receipts' || domain === 'materials-movements' ? movimentos : undefined));
      setFileName(file.name);
      setPreview(result);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível ler a planilha selecionada.');
      setPreview(null);
    } finally {
      setIsReading(false);
    }
  };

  const batchPreview: ImportBatchPreviewViewModel | undefined = preview ? {
    batchId: preview.batchId,
    sourceHash: preview.sourceHash,
    sheets: preview.sheets.map(sheet => ({
      sheetName: sheet.sheetName,
      recognized: sheet.recognized,
      domain: sheet.domain,
      rowCount: sheet.rowCount,
      reason: sheet.reason,
      columnMapping: sheet.columnMapping,
    })),
    counts: Object.fromEntries(
      Object.entries(preview.counts).map(([status, count]) => [STATUS_LABELS[status as ImportDisposition] || status, count]),
    ),
    rows: preview.rows.map(previewRow => ({
      reference: `${preview.sourceFile} › ${previewRow.row.lineage.sourceSheet} › linha ${previewRow.row.lineage.sourceRow}`,
      status: STATUS_LABELS[previewRow.disposition],
      messages: previewRow.row.lineage.validationMessages,
    })),
    dryRunRan,
    onRunDryRun: () => setDryRunRan(true),
  } : undefined;

  return (
    <div className="mt-3 space-y-3">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 text-center text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700">
        <Upload className="h-5 w-5" />
        {isReading ? 'Lendo planilha...' : 'Selecionar planilha (.xlsx) para prévia'}
        <input
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          disabled={isReading}
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleFileSelected(file);
          }}
        />
      </label>
      {preview && (
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <FileSpreadsheet className="h-4 w-4 text-emerald-700" /> {fileName} lido — {preview.rows.length} linha(s) classificada(s).
        </p>
      )}
      <SpreadsheetImportReview
        open={Boolean(preview)}
        title="Prévia de importação — Materiais"
        fileName={fileName}
        validCount={preview?.counts.new ?? 0}
        columns={[]}
        rows={[]}
        batchPreview={batchPreview}
        confirming={false}
        onCancel={() => { setPreview(null); setDryRunRan(false); }}
        onConfirm={() => {}}
      />
    </div>
  );
}
```

- [ ] **Step 3b: Wire the tab into `MateriaisTab.tsx` (four anchored edits)**

Edit 1 — import the new panel (near the top, alongside the other component imports):

```diff
 import { MaterialCard } from './MaterialCard';
+import MateriaisImportacoesPanel from './MateriaisImportacoesPanel';
```

Edit 2 — widen the tab state type (line 52):

```diff
-  const [aba, setAba] = useState<'estoque' | 'movimentos' | 'cadastro'>('estoque');
+  const [aba, setAba] = useState<'estoque' | 'movimentos' | 'cadastro' | 'importacoes'>('estoque');
```

Edit 3 — add the fourth tab button (line 342):

```diff
-          {([['estoque', 'Estoque'], ['movimentos', 'Movimentos'], ['cadastro', 'Cadastro']] as const).map(([id, rotulo]) => (
+          {([['estoque', 'Estoque'], ['movimentos', 'Movimentos'], ['cadastro', 'Cadastro'], ['importacoes', 'Importações']] as const).map(([id, rotulo]) => (
```

Edit 4 — gate the existing search/table block to the three original tabs, and render the panel for the new one (spans the block from the search `<label>` at line 365 to the closing `</div>` at line 468, immediately before the `<Modal open={materialAberto} ...>` block):

```diff
+      {aba !== 'importacoes' && (
       <label className="relative mt-3 block">
         <span className="sr-only">Buscar material</span>
         ... (unchanged: search input, table container, TableShell, both branches) ...
           </TableShell>
         )}
       </div>
+      )}
+
+      {aba === 'importacoes' && (
+        <MateriaisImportacoesPanel movimentos={movimentos} onError={setErro} />
+      )}

       <Modal
         open={materialAberto}
```

The `... (unchanged) ...` placeholder above is only for this diff excerpt — apply it as a pure wrap (add the opening `{aba !== 'importacoes' && (` line immediately before the existing `<label className="relative mt-3 block">` line and the closing `)}` line immediately after the existing `</div>` that currently precedes the `<Modal` block); do not otherwise alter anything between those two lines.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/materiaisImportUi.test.ts`
Expected: PASS.

Run: `npm run lint` (TypeScript compile check) to confirm `MateriaisTab.tsx` and the new panel type-check together — this catches any mismatch in the anchored edits from Step 3b immediately.
Expected: PASS.

- [ ] **Step 5: Register the test, run the full suite, and commit**

Add `import './materiaisImportUi.test';` to `tests/run.ts`.

Run: `npm test`
Expected: PASS.

```bash
git add src/components/MateriaisImportacoesPanel.tsx src/components/MateriaisTab.tsx tests/materiaisImportUi.test.ts tests/run.ts
git commit -m "feat(materiais): expor prévia de importação com dry-run na aba Importações"
```

---

### Task 14: Playwright smoke test for the import preview modal (desktop + mobile)

**Files:**
- Create: `tests/e2e/importacaoPreview.spec.ts`

**Interfaces:**
- Consumes: the `materiais` screen already mounted by `preview/main.tsx` at `/?screen=materiais` (existing harness, confirmed via `tests/e2e/telas.spec.ts` using the same pattern); ExcelJS (already a dependency) to build a tiny fixture workbook on disk before navigating.

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/importacaoPreview.spec.ts
import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const buildFixtureWorkbook = async (): Promise<string> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tubos de concreto');
  sheet.addRow(['Data', 'Material', 'NF', 'Quantidade Recebida', 'Unidade']);
  sheet.addRow(['05/01/2026', 'Tubo concreto 400mm', '12345', 10, 'UN']);
  sheet.addRow(['06/01/2026', 'Tubo concreto 600mm', '', 4, 'UN']);
  const dir = mkdtempSync(join(tmpdir(), 'renea-import-fixture-'));
  const path = join(dir, 'CONTROLE DE RECEBIMENTO.xlsx');
  await workbook.xlsx.writeFile(path);
  return path;
};

test('materiais: prévia de importação mostra lote, abas, status e ação bloqueada', async ({ page }) => {
  const fixturePath = await buildFixtureWorkbook();
  await page.goto('/?screen=materiais');
  await page.getByRole('button', { name: 'Importações' }).click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);

  await expect(page.getByText('Lote de importação')).toBeVisible();
  await expect(page.getByText('Hash do arquivo')).toBeVisible();
  await expect(page.getByText('Tubos de concreto')).toBeVisible();
  await expect(page.getByRole('button', { name: /Executar dry-run/ })).toBeVisible();

  const applyButton = page.getByRole('button', { name: 'Aplicar importação' });
  await expect(applyButton).toBeDisabled();

  await page.getByRole('button', { name: /Executar dry-run/ }).click();
  await expect(page.getByRole('button', { name: 'Executar dry-run novamente' })).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/importacaoPreview.spec.ts`
Expected: FAIL — no "Importações" tab / no file input hooked up yet (or PASS already if Task 13 landed first; either way, run it now to confirm it actually exercises the new UI before declaring the phase done).

- [ ] **Step 3: Confirm it passes against the Task 13 implementation**

No new implementation in this task — it only exercises Task 12/13's work end-to-end in a real browser, desktop and mobile.

Run: `npx playwright test tests/e2e/importacaoPreview.spec.ts`
Expected: PASS on both Playwright projects configured in `playwright.config.ts` (`desktop` and `celular`).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/importacaoPreview.spec.ts
git commit -m "test(e2e): smoke da prévia de importação em Materiais, desktop e mobile"
```

---

### Task 15: Final quality gates

**Files:** none (verification only).

- [ ] **Step 1: Run the full verification pipeline**

Run: `npm run verify` (runs `tsc --noEmit`, the full `npm test` suite from `tests/run.ts`, and the production build).
Expected: PASS with no TypeScript errors, all unit suites green, and a successful build.

- [ ] **Step 2: Run the Playwright suite**

Run: `npm run e2e`
Expected: PASS, including `tests/e2e/importacaoPreview.spec.ts` on both `desktop` and `celular` projects.

- [ ] **Step 3: Review the diff for lost or invented data**

Run: `git diff --check` (whitespace/conflict markers) and read the full functional diff since the last commit on this branch (`git diff origin/main...HEAD -- src/ tests/`).
Confirm: no existing `MovimentoMaterial`/`Material` record is deleted or mutated by this phase (the pipeline only reads and classifies), no normalizer invents a `0`/date/status for an absent field, and `SpreadsheetImportReview`'s three pre-existing callers (`CadastrosTab`, `LancamentosTab`, `TicketsJazidaTab`) are untouched.

- [ ] **Step 4: Manual visual check, desktop and mobile**

Run: `npm run dev` (or the preview harness `npx vite --config preview/vite.config.ts --port 4300 --host 127.0.0.1` and open `http://127.0.0.1:4300/?screen=materiais`).
In the browser: open the "Importações" tab, pick one of the four real spreadsheets (from the machine where they are available), confirm the file/hash/batch-id block, the recognized/deferred sheets list with column-mapping chips, the status counts, the per-row `arquivo › aba › linha` references with messages, that "Executar dry-run" works, and that "Aplicar importação" stays disabled with its explanation visible. Resize to a mobile viewport (or use DevTools device emulation) and confirm the modal stays usable (no horizontal overflow, buttons remain reachable, min 44px targets).

- [ ] **Step 5: Confirm no real persistence occurred**

Confirm no network requests to Firebase/Supabase were triggered by the import flow (check the browser's network tab while running the manual check in Step 4 — only the four adapter/reader modules and the modal should be involved, all client-side).

- [ ] **Step 6: Report results**

Summarize, with the actual command output: `npm run verify` result, `npm run e2e` result, the four real spreadsheets' dry-run counts (new/potential-update/unchanged/duplicate-in-file/review/invalid/deferred) once tested manually, and confirmation that Fase 1 delivered a working, auditable, non-destructive dry-run — ready for Fase 2 (Materiais e recebimentos) to build on `runImportPipeline`, `receiptsAdapter`, and `materialsAdapter`.

---

## Self-Review Notes

- **Spec coverage:** every Fase 1 bullet (four-file reading, sheet recognition + `deferred` classification, last-used-row limit up to row 1,048,576, date/time/decimal/unit/plate/prefix/invoice normalization preserving absence, hash + lineage per row, dry-run with no side effects, incomplete-field preservation, idempotent reimport detection, no cloud SDK, Playwright smoke on desktop/mobile, evolved `SpreadsheetImportReview` with file/hash/batch-id/sheets/column-mapping/counts/row-references/messages/dry-run/disabled-apply, exposure first in Materiais) is mapped to a task above (Tasks 1-14) with Task 15 as the closing quality gate.
- **Placeholder scan:** no task step uses "TBD"/"similar to Task N"/unshown code; every step that changes a file shows the actual code or an exact, narrowly-scoped anchored diff (Task 13, Step 3b) rather than a vague instruction.
- **Type consistency:** `ImportRow<T>`, `ImportPreview<T>`, `ImportDisposition`, `ImportSheetPreview`, `ImportColumnMapping`, and `SpreadsheetImportAdapter<T, TCurrent>` are defined once in Task 1 and reused with identical names/shapes through Tasks 2-13 (verified by re-reading each task's Interfaces block against Task 1's `types.ts`). `ImportBatchPreviewViewModel` is defined once in Task 12 and consumed as-is in Task 13.
- Fases 2-4 will extend, not replace: `receiptsAdapter.reconcile` and `materialsAdapter.reconcile` gain fuller domain rules in Fase 2; `stakesAdapter.reconcile` gains lote/cravação state in Fase 3; `travelsAdapter.reconcile` gains the 12-state via comparison in Fase 4. `runImportPipeline` and the evolved `SpreadsheetImportReview` are designed to be reused unchanged by those phases.

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

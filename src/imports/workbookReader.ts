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
  /** Preenchido só quando alguma aba precisou ser cortada pelo teto de
   *  segurança de {@link MAX_SAFE_ROWS_PER_SHEET} — nunca em silêncio. */
  readonly truncatedSheets?: readonly WorkbookTruncatedSheet[];
}

export interface WorkbookTruncatedSheet {
  readonly sheetName: string;
  readonly keptRows: number;
  readonly originalRowsDeclared: number;
}

/**
 * Teto de segurança por aba. Uma Tabela do Excel arrastada/expandida até o
 * limite da planilha (1.048.576 linhas) preenche colunas de fórmula com
 * valor real em cada linha — não é só formatação, então a mitigação de
 * detectLastUsedRow (abaixo) não ajuda, porque ela só roda depois que o
 * workbook inteiro já foi carregado pelo ExcelJS. Isso foi reproduzido com um
 * arquivo real de 16,7 MB: uma única aba com ~1,05 milhão de linhas com
 * valor estourou a heap do processo (~2 GB) tentando materializar objeto por
 * célula. As abas reais das 4 planilhas deste projeto têm no máximo ~3.600
 * linhas, então 20.000 dá margem de sobra sem arriscar o mesmo travamento.
 */
const MAX_SAFE_ROWS_PER_SHEET = 20_000;

/** Mapeia `xl/worksheets/sheetN.xml` -> nome de exibição da aba, lendo
 *  xl/workbook.xml + seu .rels. Sem isso o relatório de corte teria só o
 *  nome de arquivo interno, ilegível para quem está conferindo a importação. */
const mapWorksheetDisplayNames = async (zip: import('jszip')): Promise<Map<string, string>> => {
  const names = new Map<string, string>();
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!workbookXml || !relsXml) return names;

  const ridToTarget = new Map<string, string>();
  for (const relMatch of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = relMatch[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) ridToTarget.set(id, target);
  }
  for (const sheetMatch of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = sheetMatch[1];
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    const rid = attrs.match(/\br:id="([^"]+)"/)?.[1];
    const target = rid && ridToTarget.get(rid);
    if (!name || !target) continue;
    const normalizedTarget = target.replace(/^\.?\/?/, '');
    names.set(`xl/${normalizedTarget}`, name);
  }
  return names;
};

/**
 * Corta, dentro do próprio zip, qualquer aba cujo XML declare mais linhas do
 * que MAX_SAFE_ROWS_PER_SHEET, mantendo só as primeiras linhas (onde os
 * dados reais de negócio sempre estiveram, nos casos observados). Abas
 * dentro do teto saem intocadas — o corte nunca acontece "por via das
 * dúvidas". Cada corte é reportado para quem chamou, nunca fica invisível.
 */
const truncateOversizedSheets = async (
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; truncated: WorkbookTruncatedSheet[] }> => {
  const JSZipModule = (await import('jszip')).default;
  const zip = await JSZipModule.loadAsync(bytes);
  const sheetPaths = Object.keys(zip.files).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
  const displayNames = await mapWorksheetDisplayNames(zip);
  const truncated: WorkbookTruncatedSheet[] = [];

  for (const path of sheetPaths) {
    const entry = zip.file(path);
    if (!entry) continue;
    const xml = await entry.async('string');
    const rowTagCount = (xml.match(/<row r="\d+"/g) || []).length;
    if (rowTagCount <= MAX_SAFE_ROWS_PER_SHEET) continue;

    let keptRows = 0;
    const rowElementPattern = /<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g;
    const trimmedXml = xml.replace(rowElementPattern, (fullMatch, rowNumber) => {
      if (Number(rowNumber) <= MAX_SAFE_ROWS_PER_SHEET) {
        keptRows += 1;
        return fullMatch;
      }
      return '';
    });
    zip.file(path, trimmedXml);
    truncated.push({
      sheetName: displayNames.get(path) || path,
      keptRows,
      originalRowsDeclared: rowTagCount,
    });
  }

  if (truncated.length === 0) return { bytes, truncated: [] };
  const rebuiltBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes: rebuiltBytes, truncated };
};

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
  const originalBytes = new Uint8Array(buffer);
  // O hash identifica o arquivo de origem tal como ele é — sempre calculado
  // a partir dos bytes originais, nunca dos bytes já cortados pelo teto de
  // segurança abaixo, para não mudar a identidade/lote de reimportação.
  const sourceHash = await computeSourceHash(originalBytes);
  const { bytes: safeBytes, truncated } = await truncateOversizedSheets(originalBytes);
  // loadValidatedWorkbook já valida extensão/tamanho e refaz a leitura sem
  // elementos visuais incompatíveis quando necessário — reaproveitado, não
  // duplicado (a planilha é lida uma segunda vez pelo próprio helper, o que é
  // aceitável dado o limite de 25 MB já validado por ele).
  const safeFile = truncated.length > 0 ? new File([safeBytes], file.name) : file;
  const workbook = await loadValidatedWorkbook(safeFile);
  return {
    sourceFile: file.name,
    sourceHash,
    sheets: workbook.worksheets.map(readSheet),
    ...(truncated.length > 0 ? { truncatedSheets: truncated } : {}),
  };
};

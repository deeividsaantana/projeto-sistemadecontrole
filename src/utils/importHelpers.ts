export type ImportTableRow = Record<string, string>;

export const normalizeImportText = (value: string = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();

export const cleanImportValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (typeof value === 'object') {
    const anyValue = value as any;
    if (anyValue.result !== undefined) return cleanImportValue(anyValue.result);
    if (anyValue.text !== undefined) return cleanImportValue(anyValue.text);
    if (Array.isArray(anyValue.richText)) return anyValue.richText.map((part: any) => part.text || '').join('').trim();
    if (anyValue.hyperlink && anyValue.text) return cleanImportValue(anyValue.text);
  }
  return String(value).trim().replace(/\s+/g, ' ');
};

export const parseImportNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(4));
  const raw = cleanImportValue(value).replace(/\s/g, '');
  if (!raw) return 0;
  const text = raw.includes(',') && raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(',', '.');
  const num = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? Number(num.toFixed(4)) : 0;
};

export const excelSerialToIsoDate = (serial: number) => {
  if (!Number.isFinite(serial) || serial < 30000 || serial > 60000) return '';
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return date.toISOString().split('T')[0];
};

export const toImportIsoDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'number') return excelSerialToIsoDate(value);
  const text = cleanImportValue(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return '';
};

export const getImportValue = (row: Record<string, unknown>, aliases: string[]) => {
  const lookup = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeImportText(key)] = cleanImportValue(value);
    return acc;
  }, {});

  for (const alias of aliases) {
    const normalizedAlias = normalizeImportText(alias);
    if (lookup[normalizedAlias]) return lookup[normalizedAlias];
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeImportText(alias);
    const match = Object.entries(lookup).find(([key, value]) => value && (key.includes(normalizedAlias) || normalizedAlias.includes(key)));
    if (match) return match[1];
  }

  return '';
};

const detectDelimiter = (line: string) => {
  const candidates = [';', '\t', '|', ','];
  return candidates
    .map(delimiter => ({ delimiter, count: line.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.count
    ? candidates.map(delimiter => ({ delimiter, count: line.split(delimiter).length - 1 })).sort((a, b) => b.count - a.count)[0].delimiter
    : ';';
};

export const parseDelimitedText = (text: string): string[][] => {
  const firstDataLine = text.split(/\r?\n/).find(line => line.trim()) || '';
  const delimiter = detectDelimiter(firstDataLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
};

const uniqueHeader = (header: string, index: number, used: Set<string>) => {
  const clean = cleanImportValue(header) || `Coluna ${index + 1}`;
  let candidate = clean;
  let suffix = 2;
  while (used.has(normalizeImportText(candidate))) {
    candidate = `${clean} ${suffix}`;
    suffix += 1;
  }
  used.add(normalizeImportText(candidate));
  return candidate;
};

export const tableRowsToObjects = (rows: string[][]): ImportTableRow[] => {
  const headerIndex = rows.findIndex(row => row.filter(cell => cleanImportValue(cell)).length >= 2);
  if (headerIndex < 0) return [];
  const used = new Set<string>();
  const headers = rows[headerIndex].map((header, index) => uniqueHeader(header, index, used));
  return rows.slice(headerIndex + 1)
    .filter(row => row.some(cell => cleanImportValue(cell)))
    .map(row => headers.reduce<ImportTableRow>((acc, header, index) => {
      acc[header] = cleanImportValue(row[index]);
      return acc;
    }, {}));
};

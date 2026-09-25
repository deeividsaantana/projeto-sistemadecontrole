/**
 * Leitura da planilha que a pessoa importa em Cadastros: CSV, TSV, XLSX ou
 * XLSM. Devolve as abas visíveis com as linhas como texto; abas ocultas são
 * resumo ou apoio da planilha, nunca cadastro.
 */
import { loadValidatedWorkbook } from '../../utils/excelCorporate';
import { abaVisivel, type AbaPlanilha } from '../../utils/planilhaAbas';

const cellToText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('text' in record) return String(record.text ?? '').trim();
    if ('result' in record) return cellToText(record.result);
    if ('richText' in record && Array.isArray(record.richText)) {
      return record.richText
        .map(part => (typeof (part as Record<string, unknown>)?.text === 'string' ? (part as Record<string, unknown>).text : ''))
        .join('')
        .trim();
    }
  }
  return String(value).trim();
};

const parseCsvText = (text: string): Record<string, string>[] => {
  const delimiter = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const headers = parseLine(lines[0] || '').map(header => header.trim());
  return lines.slice(1).map(line => {
    const cells = parseLine(line);
    return headers.reduce<Record<string, string>>((row, header, idx) => {
      row[header || `coluna_${idx + 1}`] = cells[idx] || '';
      return row;
    }, {});
  }).filter(row => Object.values(row).some(Boolean));
};

export const parseWorkbookFile = async (file: File): Promise<{ abas: AbaPlanilha[]; ocultas: number }> => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
    if (file.size === 0) throw new Error('O arquivo está vazio.');
    if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo CSV/TSV ultrapassa o limite de 10 MB.');
    const text = await file.text();
    const linhas = lowerName.endsWith('.tsv')
      ? parseCsvText(text.replace(/\t/g, ';'))
      : parseCsvText(text);
    return { abas: [{ nome: file.name, linhas }], ocultas: 0 };
  }

  const workbook = await loadValidatedWorkbook(file);
  const abas: AbaPlanilha[] = [];
  // Abas ocultas são resumo, detalhe ou apoio da planilha, nunca cadastro.
  const visiveis = workbook.worksheets.filter(worksheet => abaVisivel(worksheet.state));
  visiveis.forEach(worksheet => {
    const rows: Record<string, string>[] = [];
    const headerRowNumber = Math.max(1, Array.from({ length: Math.min(10, worksheet.rowCount) }, (_, index) => index + 1)
      .find(rowNumber => {
        let filled = 0;
        worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, cell => {
          if (cellToText(cell.value)) filled += 1;
        });
        return filled >= 2;
      }) || 1);

    const headers: string[] = [];
    worksheet.getRow(headerRowNumber).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = cellToText(cell.value) || `coluna_${colNumber}`;
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      const record: Record<string, string> = { Aba: worksheet.name };
      headers.forEach((header, idx) => {
        record[header] = cellToText(row.getCell(idx + 1).value);
      });
      if (Object.values(record).some(Boolean)) rows.push(record);
    });
    abas.push({ nome: worksheet.name, linhas: rows });
  });
  return { abas, ocultas: workbook.worksheets.length - visiveis.length };
};


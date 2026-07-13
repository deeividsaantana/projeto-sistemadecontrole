import ExcelJS from 'exceljs';

export const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const CORPORATE_EXCEL = {
  navy: 'FF0F172A',
  slate: 'FF334155',
  emerald: 'FF059669',
  emeraldLight: 'FFD1FAE5',
  white: 'FFFFFFFF',
  gray: 'FFF1F5F9',
  border: 'FFCBD5E1',
  text: 'FF0F172A',
  muted: 'FF64748B',
};

export interface CorporateSheetOptions {
  title: string;
  headerRow: number;
  lastColumn?: number;
  dataStartRow?: number;
  freezeRows?: number;
  filters?: string[];
  recordCount?: number;
  autoFit?: boolean;
}

export const configureCorporateWorkbook = (workbook: ExcelJS.Workbook, subject: string) => {
  const now = new Date();
  workbook.creator = 'RENEA Infraestrutura';
  workbook.lastModifiedBy = 'Sistema Integrado de Gestão Operacional';
  workbook.created = now;
  workbook.modified = now;
  workbook.company = 'RENEA Infraestrutura';
  workbook.subject = subject;
  workbook.keywords = 'RENEA, gestão operacional, relatório';
  workbook.calcProperties.fullCalcOnLoad = true;
};

const columnLabel = (column: number) => {
  let value = column;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};

export const autoFitCorporateColumns = (
  worksheet: ExcelJS.Worksheet,
  minWidth = 11,
  maxWidth = 38,
) => {
  worksheet.columns.forEach(column => {
    let width = minWidth;
    column.eachCell?.({ includeEmpty: false }, cell => {
      const raw = cell.value;
      const text = raw && typeof raw === 'object' && 'text' in raw
        ? String((raw as { text: string }).text)
        : String(raw ?? '');
      width = Math.max(width, Math.min(maxWidth, text.length + 2));
    });
    column.width = Math.max(column.width || 0, width);
  });
};

export const styleCorporateWorksheet = (
  worksheet: ExcelJS.Worksheet,
  options: CorporateSheetOptions,
) => {
  const headerRow = worksheet.getRow(options.headerRow);
  const lastColumn = options.lastColumn || headerRow.cellCount || worksheet.columnCount;
  const dataStartRow = options.dataStartRow || options.headerRow + 1;

  headerRow.height = 28;
  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    if (columnNumber > lastColumn) return;
    cell.font = { bold: true, color: { argb: CORPORATE_EXCEL.white }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORPORATE_EXCEL.slate } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: CORPORATE_EXCEL.border } },
      left: { style: 'thin', color: { argb: CORPORATE_EXCEL.border } },
      bottom: { style: 'thin', color: { argb: CORPORATE_EXCEL.border } },
      right: { style: 'thin', color: { argb: CORPORATE_EXCEL.border } },
    };
  });

  for (let rowNumber = dataStartRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = Math.max(row.height || 0, 20);
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      if (columnNumber > lastColumn) return;
      cell.font = { color: { argb: CORPORATE_EXCEL.text }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      if ((rowNumber - dataStartRow) % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORPORATE_EXCEL.gray } };
      }
      cell.border = {
        top: { style: 'hair', color: { argb: CORPORATE_EXCEL.border } },
        left: { style: 'hair', color: { argb: CORPORATE_EXCEL.border } },
        bottom: { style: 'hair', color: { argb: CORPORATE_EXCEL.border } },
        right: { style: 'hair', color: { argb: CORPORATE_EXCEL.border } },
      };
    });
  }

  if (lastColumn > 0) {
    worksheet.autoFilter = {
      from: { row: options.headerRow, column: 1 },
      to: { row: options.headerRow, column: lastColumn },
    };
  }
  worksheet.views = [{ state: 'frozen', ySplit: options.freezeRows ?? options.headerRow }];
  worksheet.properties.defaultRowHeight = 20;
  worksheet.pageSetup = {
    orientation: lastColumn > 8 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter.oddHeader = `&L&BRENEA Infraestrutura&C${options.title}&R&P de &N`;
  worksheet.headerFooter.oddFooter = '&LGerado pelo Sistema RENEA&CConfidencial - Uso interno&R&D &T';

  if (options.autoFit !== false) autoFitCorporateColumns(worksheet);

  const filterSummary = options.filters?.filter(Boolean).join(' | ') || 'Sem filtros adicionais';
  if (options.headerRow >= 3) {
    worksheet.getCell(`A${options.headerRow - 2}`).value = options.title;
    worksheet.getCell(`A${options.headerRow - 2}`).font = {
      bold: true,
      color: { argb: CORPORATE_EXCEL.navy },
      size: 14,
    };
    const metadataCell = worksheet.getCell(`A${options.headerRow - 1}`);
    metadataCell.value = `Gerado em ${new Date().toLocaleString('pt-BR')} | ${options.recordCount ?? Math.max(0, worksheet.rowCount - options.headerRow)} registro(s) | ${filterSummary}`;
    metadataCell.font = { color: { argb: CORPORATE_EXCEL.muted }, italic: true, size: 9 };
    if (lastColumn > 1 && !worksheet.getCell(`${columnLabel(lastColumn)}${options.headerRow - 1}`).isMerged) {
      try { worksheet.mergeCells(options.headerRow - 1, 1, options.headerRow - 1, lastColumn); } catch { /* layout already merged */ }
    }
  }
};

export const addCorporateSummarySheet = (
  workbook: ExcelJS.Workbook,
  title: string,
  metrics: Array<[string, string | number]>,
  filters: string[] = [],
) => {
  const existing = workbook.getWorksheet('RESUMO EXECUTIVO');
  if (existing) workbook.removeWorksheet(existing.id);
  const worksheet = workbook.addWorksheet('RESUMO EXECUTIVO', { views: [{ showGridLines: false }] });
  worksheet.columns = [{ width: 34 }, { width: 24 }];
  worksheet.mergeCells('A1:B1');
  worksheet.getCell('A1').value = 'RENEA INFRAESTRUTURA';
  worksheet.getCell('A1').font = { bold: true, size: 18, color: { argb: CORPORATE_EXCEL.white } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORPORATE_EXCEL.navy } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 36;
  worksheet.mergeCells('A2:B2');
  worksheet.getCell('A2').value = title;
  worksheet.getCell('A2').font = { bold: true, size: 13, color: { argb: CORPORATE_EXCEL.emerald } };
  worksheet.getRow(4).values = ['Indicador', 'Resultado'];
  metrics.forEach(metric => worksheet.addRow(metric));
  worksheet.addRow([]);
  worksheet.addRow(['Filtros aplicados', filters.filter(Boolean).join(' | ') || 'Nenhum']);
  worksheet.addRow(['Gerado em', new Date().toLocaleString('pt-BR')]);
  styleCorporateWorksheet(worksheet, { title, headerRow: 4, lastColumn: 2, dataStartRow: 5, autoFit: false });
  worksheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  return worksheet;
};

export const validateExcelImportFile = (file: File, maxSizeMb = 25) => {
  const extension = file.name.toLowerCase().split('.').pop();
  if (!extension || !['xlsx', 'xlsm'].includes(extension)) {
    throw new Error('Formato não suportado. Use uma planilha .xlsx ou .xlsm. Arquivos .xls antigos devem ser salvos como .xlsx.');
  }
  if (file.size === 0) throw new Error('O arquivo está vazio.');
  if (file.size > maxSizeMb * 1024 * 1024) throw new Error(`O arquivo ultrapassa o limite de ${maxSizeMb} MB.`);
};

export const loadValidatedWorkbook = async (file: File, maxSizeMb = 25) => {
  validateExcelImportFile(file, maxSizeMb);
  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new Error('Não foi possível abrir a planilha. Verifique se o arquivo não está corrompido ou protegido por senha.');
  }
  if (!workbook.worksheets.length) throw new Error('A planilha não possui abas para importar.');
  return workbook;
};

export const downloadCorporateWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: EXCEL_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

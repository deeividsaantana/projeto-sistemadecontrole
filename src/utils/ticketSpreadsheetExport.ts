import ExcelJS from 'exceljs';
import { TicketJazida, TipoTicketJazida } from '../types';
import { configureCorporateWorkbook } from './excelCorporate';
import { isDuplicateTicket } from './ticketDuplicateDetection';
import { normalizeTicketNumber } from './ticketNumberSequence';
import { buildTravelOperationControl, formatTravelDuration } from './travelOperations';

type TicketSpreadsheetOptions = {
  liberacoes: TicketJazida[];
  recebimentos: TicketJazida[];
  duplicateKeys: ReadonlySet<string>;
  reneaLogoBase64?: string;
  spmarLogoBase64?: string;
};

const BORDER_COLOR = 'FF000000';
const HEADER_FILL = 'FFE7E6E6';
const STRIPE_FILL = 'FFF5F5F5';

const parseExcelDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const parseExcelTime = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(1899, 11, 30, Number(match[1]), Number(match[2]), 0));
};

const ticketNumberValue = (value: string): string | number => {
  const normalized = normalizeTicketNumber(value);
  return /^\d+$/.test(normalized) ? Number(normalized) : normalized;
};

export const getTicketSpreadsheetStatus = (
  ticket: TicketJazida,
  duplicateKeys: ReadonlySet<string>,
) => {
  if (isDuplicateTicket(ticket, duplicateKeys)) return 'DUPLICADO';
  if (ticket.statusFluxo === 'Rascunho') return 'RASCUNHO';
  const status = ticket.status || 'OK';
  if (status === 'OK') return 'CONFERIDO';
  if (status === 'Pendente') return 'PENDENTE';
  return status.toUpperCase();
};

const statusStyle = (status: string) => {
  if (status.includes('DUPLICADO') || status === 'ERRO DE IMPORTAÇÃO' || status === 'DIVERGÊNCIA') {
    return { fill: 'FFFFC7CE', font: 'FF9C0006' };
  }
  if (status === 'PENDENTE' || status.startsWith('VERIFICAR') || status.startsWith('SEM ')) {
    return { fill: 'FFFFEB9C', font: 'FF9C6500' };
  }
  if (status === 'RASCUNHO') return { fill: 'FFDDEBF7', font: 'FF1F4E78' };
  return { fill: 'FFC6EFCE', font: 'FF006100' };
};

const addLogo = (
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  base64: string | undefined,
  position: { col: number; row: number; endCol: number; endRow: number },
) => {
  if (!base64) return;
  const imageId = workbook.addImage({ base64, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: position.col, row: position.row },
    br: { col: position.endCol, row: position.endRow },
    editAs: 'oneCell',
  } as any);
};

const configureSheet = (
  workbook: ExcelJS.Workbook,
  tipo: TipoTicketJazida,
  items: TicketJazida[],
  duplicateKeys: ReadonlySet<string>,
  reneaLogoBase64?: string,
  spmarLogoBase64?: string,
) => {
  const isRecebimento = tipo === 'Recebimento';
  const worksheet = workbook.addWorksheet(isRecebimento ? 'RECEBIMENTO' : 'LIBERAÇÃO', {
    views: [{ showGridLines: false }],
  });
  const headers = isRecebimento
    ? ['Data', 'Ticket Nº', 'Prefixo', 'Placa', 'Hora de chegada', 'Tipo de material', 'Quantidade m³', 'Ramo de Descarga', 'Estaca', 'Status']
    : ['Data', 'Ticket Nº', 'Prefixo', 'Placa', 'Hora de saída', 'Tipo de material', 'Quantidade m³', 'Destino / Obra', 'Status / Conferência'];
  const widths = isRecebimento
    ? [8.55, 10.55, 11.11, 22.78, 13.66, 15.44, 17.22, 18.66, 15.78, 14.89, 15.33]
    : [8.55, 11, 11.11, 22.78, 13.66, 15.44, 19.11, 18.22, 15.78, 22.78];
  widths.forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });

  const lastDataColumn = isRecebimento ? 11 : 10;
  const statusColumn = isRecebimento ? 'K' : 'J';
  const title = isRecebimento ? 'RECEBIMENTO' : 'LIBERAÇÃO';
  worksheet.mergeCells(1, 2, 3, lastDataColumn);
  const titleCell = worksheet.getCell('B1');
  titleCell.value = title;
  titleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF000000' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = isRecebimento ? 37.8 : 37.2;
  worksheet.getRow(4).height = 19.2;

  addLogo(workbook, worksheet, reneaLogoBase64, { col: 1.05, row: 0.15, endCol: 3.45, endRow: 2.85 });
  addLogo(workbook, worksheet, spmarLogoBase64, {
    col: isRecebimento ? 8.45 : 7.45,
    row: 0.35,
    endCol: isRecebimento ? 10.8 : 9.8,
    endRow: 2.7,
  });

  const sortedItems = [...items].sort((a, b) =>
    a.data.localeCompare(b.data) || Number(normalizeTicketNumber(a.ticketNumero)) - Number(normalizeTicketNumber(b.ticketNumero))
  );
  const rows = sortedItems.map(item => {
    const date = parseExcelDate(item.data);
    const destino = item.destinoObra === 'Outros' ? item.destinoOutro || 'Outros' : item.destinoObra;
    return isRecebimento
      ? [date, ticketNumberValue(item.ticketNumero), item.prefixo, item.placa, parseExcelTime(item.horaChegada || item.horaSaida), item.tipoMaterial, Number(item.quantidadeM3) || 0, destino, item.estaca || '', getTicketSpreadsheetStatus(item, duplicateKeys)]
      : [date, ticketNumberValue(item.ticketNumero), item.prefixo, item.placa, parseExcelTime(item.horaSaida), item.tipoMaterial, Number(item.quantidadeM3) || 0, destino, getTicketSpreadsheetStatus(item, duplicateKeys)];
  });
  const tableRows = rows.length ? rows : [headers.map(() => null)];
  const table = worksheet.addTable({
    name: isRecebimento ? 'TabelaRecebimento' : 'TabelaLiberacao',
    ref: 'B4',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleLight1', showRowStripes: true, showColumnStripes: false },
    columns: headers.map(name => ({ name, filterButton: true })),
    rows: tableRows,
  });
  table.commit();

  const lastRow = 4 + tableRows.length;
  for (let index = 0; index < tableRows.length; index += 1) {
    const rowNumber = index + 5;
    const sourceItem = sortedItems[index];
    const date = sourceItem ? parseExcelDate(sourceItem.data) : null;
    const weekdayCell = worksheet.getCell(rowNumber, 1);
    weekdayCell.value = date;
    weekdayCell.numFmt = 'ddd';
    weekdayCell.alignment = { horizontal: 'center', vertical: 'middle' };
    weekdayCell.font = { name: 'Aptos Narrow', size: 11 };

    for (let column = 2; column <= lastDataColumn; column += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_FILL } };
    }

    worksheet.getCell(rowNumber, 2).numFmt = 'dd/mm/yyyy';
    worksheet.getCell(rowNumber, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(rowNumber, 3).numFmt = '0';
    worksheet.getCell(rowNumber, 6).numFmt = 'hh:mm';
    worksheet.getCell(rowNumber, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getCell(rowNumber, 8).numFmt = '0.##';
    worksheet.getCell(rowNumber, 8).alignment = { horizontal: 'right', vertical: 'middle' };

    const status = String(worksheet.getCell(`${statusColumn}${rowNumber}`).value || '');
    const colors = statusStyle(status);
    const statusCell = worksheet.getCell(`${statusColumn}${rowNumber}`);
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
    statusCell.font = { name: 'Calibri', size: 10, color: { argb: colors.font } };
  }

  for (let column = 2; column <= lastDataColumn; column += 1) {
    const cell = worksheet.getCell(4, column);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF222222' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'medium', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  }

  const countLabelColumn = lastDataColumn + 1;
  worksheet.getCell(3, countLabelColumn).value = 'QUANT VIAGEMS';
  worksheet.getCell(3, countLabelColumn).font = { name: 'Calibri', size: 10, bold: true };
  worksheet.getCell(3, countLabelColumn + 1).value = {
    formula: `SUBTOTAL(103,C5:C${lastRow})`,
    result: sortedItems.length,
  };
  worksheet.getCell(3, countLabelColumn + 1).font = { name: 'Calibri', size: 10, bold: true };

  for (let rowNumber = 5; rowNumber <= lastRow; rowNumber += 1) {
    worksheet.getCell(`${statusColumn}${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"CONFERIDO,PENDENTE,DUPLICADO,RASCUNHO,VERIFICAR"'],
    };
  }
  worksheet.addConditionalFormatting({
    ref: `${statusColumn}5:${statusColumn}${lastRow}`,
    rules: [
      { type: 'expression', priority: 1, formulae: [`$${statusColumn}5="DUPLICADO"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' } } } },
      { type: 'expression', priority: 2, formulae: [`$${statusColumn}5="CONFERIDO"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } }, font: { color: { argb: 'FF006100' } } } },
      { type: 'expression', priority: 3, formulae: [`$${statusColumn}5="PENDENTE"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C6500' } } } },
    ],
  });

  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    printArea: `B1:${statusColumn}${lastRow}`,
    printTitlesRow: '1:4',
  };
  return worksheet;
};

const styleControlSheet = (worksheet: ExcelJS.Worksheet, widths: number[]) => {
  widths.forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  worksheet.autoFilter = { from: 'A1', to: `${worksheet.getColumn(widths.length).letter}${Math.max(1, worksheet.rowCount)}` };
  worksheet.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF222222' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
};

const addOperationalControlSheets = (
  workbook: ExcelJS.Workbook,
  tickets: TicketJazida[],
) => {
  const control = buildTravelOperationControl(tickets);
  const reviewSheet = workbook.addWorksheet('CONFERÊNCIA VIAGENS', { views: [{ showGridLines: false }] });
  reviewSheet.addRow([
    'Ticket Nº',
    'Situação',
    'Data liberação',
    'Hora saída',
    'Data recebimento',
    'Hora chegada',
    'Duração',
    'Prefixo liberação',
    'Prefixo recebimento',
    'Placa liberação',
    'Placa recebimento',
    'Material liberação',
    'Material recebimento',
    'Quantidade liberação',
    'Quantidade recebimento',
    'Divergências',
    'Equipamento ID',
    'Material ID',
    'Local destino ID',
    'Ramo ID',
  ]);
  control.operations.forEach(operation => {
    reviewSheet.addRow([
      ticketNumberValue(operation.ticketNumber),
      operation.status.toUpperCase(),
      operation.release ? parseExcelDate(operation.release.data) : null,
      operation.release ? parseExcelTime(operation.release.horaSaida) : null,
      operation.receipt ? parseExcelDate(operation.receipt.data) : null,
      operation.receipt ? parseExcelTime(operation.receipt.horaChegada || operation.receipt.horaSaida) : null,
      formatTravelDuration(operation.durationMinutes),
      operation.release?.prefixo || '',
      operation.receipt?.prefixo || '',
      operation.release?.placa || '',
      operation.receipt?.placa || '',
      operation.release?.tipoMaterial || '',
      operation.receipt?.tipoMaterial || '',
      operation.release?.quantidadeM3 ?? '',
      operation.receipt?.quantidadeM3 ?? '',
      operation.divergences.map(item => item.label).join(', '),
      operation.equipmentId || '',
      operation.materialId || '',
      operation.destinationLocationId || '',
      operation.branchId || '',
    ]);
  });
  styleControlSheet(reviewSheet, [12, 19, 14, 12, 16, 12, 14, 16, 16, 16, 16, 18, 18, 18, 18, 24, 24, 24, 24, 24]);
  for (let rowNumber = 2; rowNumber <= reviewSheet.rowCount; rowNumber += 1) {
    reviewSheet.getCell(rowNumber, 3).numFmt = 'dd/mm/yyyy';
    reviewSheet.getCell(rowNumber, 4).numFmt = 'hh:mm';
    reviewSheet.getCell(rowNumber, 5).numFmt = 'dd/mm/yyyy';
    reviewSheet.getCell(rowNumber, 6).numFmt = 'hh:mm';
    const statusCell = reviewSheet.getCell(rowNumber, 2);
    const colors = statusStyle(String(statusCell.value || ''));
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
    statusCell.font = { color: { argb: colors.font }, bold: true };
  }

  const ticketControlSheet = workbook.addWorksheet('CONTROLE TICKETS', { views: [{ showGridLines: false }] });
  ticketControlSheet.addRow(['Ticket', 'Situação', 'Lote de impressão', 'Data de impressão', 'Liberação', 'Recebimento', 'Devoluções']);
  control.operations.forEach(operation => {
    const printedAt = operation.release?.loteImpressaoCriadoEm || operation.receipt?.loteImpressaoCriadoEm || '';
    const used = operation.release?.statusFluxo === 'Enviado' || operation.receipt?.statusFluxo === 'Enviado';
    ticketControlSheet.addRow([
      ticketNumberValue(operation.ticketNumber),
      used ? 'UTILIZADO' : operation.printedBatchId ? 'IMPRESSO' : 'CADASTRADO',
      operation.printedBatchId || '',
      printedAt ? new Date(printedAt) : null,
      operation.release ? 'SIM' : 'NÃO',
      operation.receipt ? 'SIM' : 'NÃO',
      operation.returnEvents.length,
    ]);
  });
  styleControlSheet(ticketControlSheet, [14, 15, 24, 20, 14, 14, 12]);
  for (let rowNumber = 2; rowNumber <= ticketControlSheet.rowCount; rowNumber += 1) {
    ticketControlSheet.getCell(rowNumber, 4).numFmt = 'dd/mm/yyyy hh:mm';
  }

  const indicators = workbook.addWorksheet('INDICADORES', { views: [{ showGridLines: false }] });
  [
    ['INDICADOR', 'VALOR'],
    ['Tickets únicos', control.totalTickets],
    ['Viagens conferidas', control.completeTrips],
    ['Liberações sem recebimento', control.releasesWithoutReceipt],
    ['Recebimentos sem liberação', control.receiptsWithoutRelease],
    ['Tickets divergentes', control.divergentTrips],
    ['Tickets duplicados', control.duplicateTickets],
    ['Pares com duas devoluções', control.returnedPairs],
    ['Tempo médio de viagem', formatTravelDuration(control.averageDurationMinutes)],
    ['Equipamentos vinculados por ID', control.linkedEquipment],
    ['Materiais vinculados por ID', control.linkedMaterials],
    ['Destinos vinculados por ID', control.linkedDestinations],
    ['Ramos vinculados por ID', control.linkedBranches],
  ].forEach(row => indicators.addRow(row));
  styleControlSheet(indicators, [38, 22]);
};

export const buildTicketSpreadsheetWorkbook = (options: TicketSpreadsheetOptions) => {
  const workbook = new ExcelJS.Workbook();
  configureCorporateWorkbook(workbook, 'Controle de viagens da jazida SABESP');
  configureSheet(workbook, 'Liberação', options.liberacoes, options.duplicateKeys, options.reneaLogoBase64, options.spmarLogoBase64);
  configureSheet(workbook, 'Recebimento', options.recebimentos, options.duplicateKeys, options.reneaLogoBase64, options.spmarLogoBase64);
  addOperationalControlSheets(workbook, [...options.liberacoes, ...options.recebimentos]);
  return workbook;
};

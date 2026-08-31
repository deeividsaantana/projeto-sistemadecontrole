import ExcelJS from 'exceljs';
import type { FleetCurrentState, FleetReportViewModel } from './domain';
import { summarizeFleetCategories } from './categorySummary';
import { OPERATIONAL_FLEET_REFERENCE } from './operationalFleetReference';
import { normalizePrefix } from '../utils/canonicalIdentity';
import reneaLogoUrl from '../assets/images/renea_logo_new.png';
import spmarLogoUrl from '../assets/images/spmar_logo.png';

const FONT_NAME = 'Aptos Narrow';
const FONT_SIZE = 11;
const GREEN = '15824B';
const DARK = '252A2F';
const HEADER_GRAY = 'D8DADD';
const LIGHT_GRAY = 'F7F7F7';
const BORDER = 'D0D3D6';
const SOFT_GREEN = 'EDF8F2';
const SOFT_RED = 'FDF0F0';
const SOFT_BLUE = 'EEF7FC';
const SOFT_YELLOW = 'FFF8E8';

const columnNumberFromAddress = (address: string): number =>
  address
    .replace(/\d/g, '')
    .toUpperCase()
    .split('')
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);

const rowNumberFromAddress = (address: string): number =>
  Number(address.replace(/\D/g, ''));

export interface FleetExcelResult {
  fileName: string;
  sheets: string[];
  rows: number;
}

const loadImageBase64 = async (url: string): Promise<string | undefined> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return undefined;
  }
};

const addHeaderLogos = (
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  logos: { renea?: string; spmar?: string },
): void => {
  if (logos.renea) {
    const imageId = workbook.addImage({ base64: logos.renea, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 0.08, row: 0.2 }, br: { col: 1.35, row: 1.75 }, editAs: 'oneCell' } as any);
  }
  if (logos.spmar) {
    const imageId = workbook.addImage({ base64: logos.spmar, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 7.55, row: 0.2 }, br: { col: 8.95, row: 1.72 }, editAs: 'oneCell' } as any);
  }
};

const applyBaseSheet = (sheet: ExcelJS.Worksheet): void => {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
  sheet.pageSetup.printTitlesRow = '1:1';
  sheet.properties.defaultRowHeight = 18;
  sheet.eachRow(row => {
    row.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: `FF${DARK}` } };
  });
};

const styleTitle = (
  sheet: ExcelJS.Worksheet,
  titleRange: string,
  title: string,
  subtitle?: string,
): void => {
  sheet.mergeCells(titleRange);
  const [startAddress, endAddress] = titleRange.split(':');
  const startRow = rowNumberFromAddress(startAddress);
  const startColumn = columnNumberFromAddress(startAddress);
  const endColumn = columnNumberFromAddress(endAddress);
  const cell = sheet.getCell(startRow, startColumn);
  cell.value = title;
  cell.font = { name: FONT_NAME, size: 16, bold: true, color: { argb: `FF${DARK}` } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  sheet.getRow(startRow).height = subtitle ? 30 : 24;
  if (subtitle) {
    const nextRow = startRow + 1;
    sheet.mergeCells(nextRow, startColumn, nextRow, endColumn);
    const subtitleCell = sheet.getCell(nextRow, startColumn);
    subtitleCell.value = subtitle;
    subtitleCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF687078' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(nextRow).height = 18;
  }
};

const styleHeaderRow = (row: ExcelJS.Row): void => {
  row.height = 22;
  row.eachCell(cell => {
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: `FF${DARK}` } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_GRAY}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: `FF${BORDER}` } },
      bottom: { style: 'thin', color: { argb: `FF${BORDER}` } },
      left: { style: 'thin', color: { argb: `FF${BORDER}` } },
      right: { style: 'thin', color: { argb: `FF${BORDER}` } },
    };
  });
};

const styleBodyRows = (
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  endRow: number,
  statusColumn?: number,
): void => {
  for (let rowNumber = headerRow + 1; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 19;
    row.eachCell(cell => {
      cell.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: `FF${DARK}` } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowNumber % 2 === 0 ? `FF${LIGHT_GRAY}` : 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = {
        bottom: { style: 'hair', color: { argb: `FF${BORDER}` } },
      };
    });
    if (statusColumn) {
      const statusCell = row.getCell(statusColumn);
      const status = String(statusCell.value ?? '');
      if (status.includes('operação')) statusCell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: 'FF176B45' } };
      if (status.includes('manutenção')) statusCell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: 'FF9F2D2D' } };
      if (status.includes('disposição')) statusCell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: 'FF246786' } };
    }
  }
};

const addTable = (
  sheet: ExcelJS.Worksheet,
  name: string,
  ref: string,
  columns: string[],
  rows: Array<Array<string | number | Date | null>>,
): void => {
  const safeRows = rows.length ? rows : [columns.map((_, index) =>
    index === 0 ? 'Nenhum registro encontrado para os filtros.' : null)];
  sheet.addTable({
    name,
    ref,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleLight1',
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: columns.map(nameValue => ({ name: nameValue, filterButton: true })),
    rows: safeRows,
  });
};

const createDetailedSummarySheet = (
  workbook: ExcelJS.Workbook,
  viewModel: FleetReportViewModel,
): void => {
  const sheet = workbook.addWorksheet('ANÁLISE');
  sheet.views = [{ showGridLines: false }];
  sheet.columns = [
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  styleTitle(
    sheet,
    'A1:G1',
    'RELATÓRIO DIÁRIO DE SITUAÇÃO OPERACIONAL',
    'FROTAS OPERACIONAIS · Complexo do Alto Tietê',
  );
  sheet.mergeCells('A3:G3');
  sheet.getCell('A3').value = viewModel.companyLabel;
  sheet.getCell('A3').alignment = { horizontal: 'center' };
  sheet.getCell('A3').font = { name: FONT_NAME, size: 10, bold: true, color: { argb: `FF${GREEN}` } };
  const metrics = [
    ['DATA', viewModel.reportDateLabel, 'F3F4F5'],
    ['TOTAL DE FROTAS', viewModel.metrics.total, 'F3F4F5'],
    ['EM OPERAÇÃO', viewModel.metrics.operating, SOFT_GREEN],
    ['EM MANUTENÇÃO', viewModel.metrics.maintenance + viewModel.metrics.waitingMaintenance, SOFT_RED],
    ['À DISPOSIÇÃO', viewModel.metrics.available, SOFT_BLUE],
    ['A CONFIRMAR', viewModel.metrics.pending, SOFT_YELLOW],
    ['HORAS PARADAS', viewModel.metrics.stoppedDurationLabel, SOFT_YELLOW],
  ] as const;
  metrics.forEach(([label, value, fill], index) => {
    const column = index + 1;
    const labelCell = sheet.getCell(5, column);
    const valueCell = sheet.getCell(6, column);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF666D74' } };
    valueCell.font = { name: FONT_NAME, size: 15, bold: true, color: { argb: `FF${DARK}` } };
    [labelCell, valueCell].forEach(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: `FF${BORDER}` } },
        bottom: { style: 'thin', color: { argb: `FF${BORDER}` } },
        left: { style: 'thin', color: { argb: `FF${BORDER}` } },
        right: { style: 'thin', color: { argb: `FF${BORDER}` } },
      };
    });
  });
  sheet.getRow(5).height = 20;
  sheet.getRow(6).height = 28;
  sheet.getCell('A9').value = 'Indicador';
  sheet.getCell('B9').value = 'Valor';
  const indicatorRows = [
    ['Aguardando motorista', viewModel.metrics.waitingDriver],
    ['Indisponíveis', viewModel.metrics.unavailable],
    ['Parados', viewModel.metrics.stopped],
    ['Não classificados', viewModel.metrics.unclassified],
    ['Disponibilidade', viewModel.metrics.availabilityRate / 100],
    ['Taxa em operação', viewModel.metrics.operatingRate / 100],
    ['Diferença de integridade', viewModel.metrics.integrityDifference],
  ];
  indicatorRows.forEach((row, index) => {
    sheet.getRow(10 + index).values = row;
  });
  styleHeaderRow(sheet.getRow(9));
  styleBodyRows(sheet, 9, 9 + indicatorRows.length);
  sheet.getCell('B14').numFmt = '0.0%';
  sheet.getCell('B15').numFmt = '0.0%';
  const categories = summarizeFleetCategories(viewModel.allRows);
  sheet.getRow(19).values = ['Categoria', 'Total', 'Em operação', 'Em manutenção', 'À disposição', 'A confirmar', 'Prefixos'];
  styleHeaderRow(sheet.getRow(19));
  categories.forEach((category, index) => {
    sheet.getRow(20 + index).values = [
      category.label,
      category.total,
      category.operating,
      category.maintenance,
      category.available,
      category.pending,
      category.prefixes.join(', '),
    ];
  });
  styleBodyRows(sheet, 19, 19 + categories.length);
  sheet.getColumn(7).width = 52;
  for (let row = 20; row <= 19 + categories.length; row += 1) {
    sheet.getCell(row, 7).alignment = { vertical: 'middle', wrapText: true };
  }
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
};

const createSummarySheet = (
  workbook: ExcelJS.Workbook,
  viewModel: FleetReportViewModel,
  logos: { renea?: string; spmar?: string } = {},
): void => {
  const sheet = workbook.addWorksheet('RESUMO', { views: [{ showGridLines: false }] });
  sheet.columns = [
    { width: 14 }, { width: 18 }, { width: 19 }, { width: 18 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 29 }, { width: 42 },
  ];
  const statesByPrefix = new Map(viewModel.allRows.map(state => [normalizePrefix(state.equipment.prefix), state]));
  const stateFor = (prefix: string) => statesByPrefix.get(normalizePrefix(prefix));
  const basculantes = OPERATIONAL_FLEET_REFERENCE.filter(item => item.group === 'Basculantes');
  const support = OPERATIONAL_FLEET_REFERENCE.filter(item => item.group === 'Apoio');
  const countStatus = (items: ReadonlyArray<typeof OPERATIONAL_FLEET_REFERENCE[number]>, status: string) =>
    items.filter(item => stateFor(item.prefix)?.operationalStatus === status).length;
  const operating = countStatus(OPERATIONAL_FLEET_REFERENCE, 'Em operação');
  const maintenance = OPERATIONAL_FLEET_REFERENCE.filter(item => {
    const status = stateFor(item.prefix)?.operationalStatus;
    return status === 'Em manutenção' || status === 'Aguardando manutenção';
  }).length;
  const missing = OPERATIONAL_FLEET_REFERENCE.filter(item => !stateFor(item.prefix)).length;
  const available = OPERATIONAL_FLEET_REFERENCE.filter(item => {
    const status = stateFor(item.prefix)?.operationalStatus;
    return status === 'À disposição' || status === 'Aguardando motorista';
  }).length;
  const statusLabel = (item: typeof OPERATIONAL_FLEET_REFERENCE[number]) => {
    const state = stateFor(item.prefix);
    return state?.operationalStatus || 'A confirmar';
  };
  const relationRows = OPERATIONAL_FLEET_REFERENCE.map(item => {
    const state = stateFor(item.prefix);
    return [
      viewModel.reportDateLabel,
      item.group,
      item.prefix,
      item.equipmentType,
      statusLabel(item),
      state?.departureTime || '',
      state?.driver?.employeeCode || '',
      state?.driver?.employeeName || '',
      state?.note || state?.maintenanceReason || '',
    ] as Array<string | number | Date | null>;
  });

  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = 'RELATÓRIO DIÁRIO DE SITUAÇÃO OPERACIONAL';
  sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF111111' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 29;
  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = `SITUAÇÃO OPERACIONAL DAS FROTAS — ${viewModel.reportDateLabel}`;
  sheet.getCell('A2').font = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${GREEN}` } };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 21;
  addHeaderLogos(workbook, sheet, logos);
  const topMetrics = [
    ['TOTAL BASCULANTES', basculantes.length, 'FFFFFFFF'],
    ['BASCULANTES EM OPERAÇÃO', countStatus(basculantes, 'Em operação'), SOFT_GREEN],
    ['BASCULANTES EM MANUTENÇÃO', basculantes.filter(item => ['Em manutenção', 'Aguardando manutenção'].includes(statusLabel(item))).length, SOFT_RED],
    ['SITUAÇÃO A CONFIRMAR', missing, SOFT_YELLOW],
    ['APOIO INFORMADO', support.filter(item => Boolean(stateFor(item.prefix))).length, SOFT_BLUE],
  ] as const;
  topMetrics.forEach(([label, value, fill], index) => {
    const column = index + 1;
    const labelCell = sheet.getCell(4, column);
    const valueCell = sheet.getCell(5, column);
    labelCell.value = label;
    valueCell.value = value;
    [labelCell, valueCell].forEach(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill.startsWith('FF') ? fill : `FF${fill}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: `FF${BORDER}` } }, bottom: { style: 'thin', color: { argb: `FF${BORDER}` } }, left: { style: 'thin', color: { argb: `FF${BORDER}` } }, right: { style: 'thin', color: { argb: `FF${BORDER}` } } };
    });
    labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF333333' } };
    valueCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: `FF${GREEN}` } };
  });
  sheet.getRow(4).height = 27;
  sheet.getRow(5).height = 30;
  // Compatibilidade com integrações antigas que leem os indicadores na linha 6.
  // A linha fica oculta para manter o layout aprovado sem duplicar visualmente os cards.
  sheet.getRow(6).values = ['', viewModel.metrics.total, viewModel.metrics.operating, viewModel.metrics.maintenance + viewModel.metrics.waitingMaintenance, viewModel.metrics.available, viewModel.metrics.pending, viewModel.metrics.stoppedDurationLabel];
  sheet.getRow(6).hidden = true;
  sheet.getRow(6).height = 0;

  sheet.mergeCells('A7:E7');
  sheet.getCell('A7').value = 'RESUMO DINÂMICO POR GRUPO E SITUAÇÃO';
  sheet.mergeCells('F7:I7');
  sheet.getCell('F7').value = `EQUIPAMENTOS A DISPOSIÇÃO / A CONFIRMAR — ${available + missing}`;
  [sheet.getCell('A7'), sheet.getCell('F7')].forEach(cell => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${GREEN}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: `FF${GREEN}` } } };
  });
  sheet.getRow(7).height = 22;
  ['GRUPO', 'Em operação', 'Em manutenção', 'À disposição / Falta de Motorista', 'Situação a confirmar'].forEach((label, index) => { sheet.getCell(8, index + 1).value = label; });
  sheet.mergeCells('F8:I8');
  sheet.getCell('F8').value = OPERATIONAL_FLEET_REFERENCE.filter(item => {
    const state = stateFor(item.prefix);
    return !state || state.operationalStatus === 'À disposição' || state.operationalStatus === 'Aguardando motorista';
  }).map(item => item.prefix).join(', ') || 'Nenhum equipamento';
  const summaryRows = [
    ['Apoio', countStatus(support, 'Em operação'), support.filter(item => ['Em manutenção', 'Aguardando manutenção'].includes(statusLabel(item))).length, support.filter(item => ['À disposição', 'Aguardando motorista'].includes(statusLabel(item))).length, support.filter(item => !stateFor(item.prefix)).length],
    ['Basculantes', countStatus(basculantes, 'Em operação'), basculantes.filter(item => ['Em manutenção', 'Aguardando manutenção'].includes(statusLabel(item))).length, basculantes.filter(item => ['À disposição', 'Aguardando motorista'].includes(statusLabel(item))).length, basculantes.filter(item => !stateFor(item.prefix)).length],
    ['Total', operating, maintenance, available, missing],
  ];
  summaryRows.forEach((row, index) => { sheet.getRow(9 + index).values = row; });
  styleHeaderRow(sheet.getRow(8));
  styleBodyRows(sheet, 8, 11);
  sheet.getCell('F8').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getCell('F8').font = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${DARK}` } };
  for (let row = 8; row <= 11; row += 1) for (let col = 6; col <= 9; col += 1) sheet.getCell(row, col).border = { top: { style: 'thin', color: { argb: `FF${BORDER}` } }, bottom: { style: 'thin', color: { argb: `FF${BORDER}` } }, left: { style: 'thin', color: { argb: `FF${BORDER}` } }, right: { style: 'thin', color: { argb: `FF${BORDER}` } } };

  sheet.mergeCells('A13:I13');
  sheet.getCell('A13').value = 'RELAÇÃO COMPLETA POR PREFIXO';
  sheet.getCell('A13').font = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${GREEN}` } };
  sheet.getCell('A13').alignment = { horizontal: 'center', vertical: 'middle' };
  addTable(sheet, 'RelacaoCompletaFrotas', 'A14', ['Data', 'Grupo', 'Prefixo', 'Tipo', 'Situação', 'Hora(s)', 'Matrícula', 'Motorista(s)', 'Observação'], relationRows);
  styleHeaderRow(sheet.getRow(14));
  styleBodyRows(sheet, 14, 14 + relationRows.length, 5);
  for (let row = 15; row <= 14 + relationRows.length; row += 1) {
    sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(row, 3).font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${DARK}` } };
    sheet.getCell(row, 9).alignment = { vertical: 'top', wrapText: true };
  }
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 }, printArea: `A1:I${14 + relationRows.length}`, printTitlesRow: '1:14' };
};

const operationRow = (state: FleetCurrentState): Array<string | number | Date | null> => [
  state.equipment.family,
  state.equipment.equipmentType,
  state.driver?.employeeCode || '',
  state.driver?.employeeName || 'Sem motorista',
  state.equipment.prefix,
  state.operationalStatus,
  state.departureTime || '',
  state.stoppedDurationLabel === '—' ? '' : state.stoppedDurationLabel,
  state.location || '',
  state.note || state.maintenanceReason || '',
];

const maintenanceRow = (state: FleetCurrentState): Array<string | number | Date | null> => [
  state.equipment.family,
  state.equipment.equipmentType,
  state.equipment.prefix,
  state.maintenanceEntryTime || '',
  state.stoppedDurationLabel === '—' ? '' : state.stoppedDurationLabel,
  state.operationalStatus,
  state.maintenanceReason || state.note || '',
  state.maintenanceOrderId || '',
];

const availableRow = (state: FleetCurrentState): Array<string | number | Date | null> => [
  state.equipment.family,
  state.equipment.equipmentType,
  state.driver?.employeeCode || '',
  state.driver?.employeeName || 'Sem motorista',
  state.equipment.prefix,
  state.operationalStatus,
  state.availableSince || state.releaseTime || '',
  state.stoppedDurationLabel === '—' ? '' : state.stoppedDurationLabel,
  state.location || '',
  state.note || '',
];

const createDataSheet = (
  workbook: ExcelJS.Workbook,
  config: {
    name: string;
    tableName: string;
    columns: string[];
    widths: number[];
    rows: Array<Array<string | number | Date | null>>;
    statusColumn?: number;
    wrapColumns?: number[];
  },
): void => {
  const sheet = workbook.addWorksheet(config.name);
  sheet.columns = config.widths.map(width => ({ width }));
  addTable(sheet, config.tableName, 'A1', config.columns, config.rows);
  styleHeaderRow(sheet.getRow(1));
  styleBodyRows(sheet, 1, Math.max(config.rows.length + 1, 2), config.statusColumn);
  (config.wrapColumns ?? []).forEach(columnNumber => {
    for (let row = 2; row <= Math.max(config.rows.length + 1, 2); row += 1) {
      sheet.getCell(row, columnNumber).alignment = {
        vertical: 'top',
        wrapText: true,
      };
      sheet.getRow(row).height = 30;
    }
  });
  applyBaseSheet(sheet);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: config.columns.length },
  };
};

const createHistorySheet = (
  workbook: ExcelJS.Workbook,
  viewModel: FleetReportViewModel,
): void => {
  const stateByEquipment = new Map(
    viewModel.allRows.map(state => [state.equipment.equipmentId, state]),
  );
  const rows = viewModel.history.map(event => {
    const state = stateByEquipment.get(event.equipmentId);
    const date = new Date(event.occurredAt);
    return [
      Number.isFinite(date.getTime()) ? date : null,
      state?.driver?.employeeCode || '',
      state?.driver?.employeeName || '',
      state?.equipment.prefix || '',
      event.kind,
      event.previousStatus || '',
      event.nextStatus,
      event.note || event.reason || '',
      event.createdBy || '',
    ] as Array<string | number | Date | null>;
  });
  createDataSheet(workbook, {
    name: 'HISTÓRICO',
    tableName: 'HistoricoCBs',
    columns: [
      'Data e hora',
      'Matrícula',
      'Motorista',
      'Prefixo',
      'Evento',
      'Status anterior',
      'Status novo',
      'Observação',
      'Responsável',
    ],
    widths: [20, 14, 32, 13, 24, 20, 20, 52, 24],
    rows,
    statusColumn: 7,
    wrapColumns: [8],
  });
  const sheet = workbook.getWorksheet('HISTÓRICO');
  if (sheet) {
    for (let row = 2; row <= Math.max(rows.length + 1, 2); row += 1) {
      sheet.getCell(row, 1).numFmt = 'dd/mm/yyyy hh:mm';
    }
  }
};

export const buildFleetWorkbook = (
  viewModel: FleetReportViewModel,
  logos: { renea?: string; spmar?: string } = {},
): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RENEA Infraestrutura';
  workbook.lastModifiedBy = 'Sistema RENEA';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;
  workbook.calcProperties.fullCalcOnLoad = true;
  createSummarySheet(workbook, viewModel, logos);
  createDataSheet(workbook, {
    name: 'OPERAÇÃO',
    tableName: 'OperacaoCBs',
    columns: [
      'Grupo',
      'Tipo',
      'Matrícula',
      'Nome / Motorista',
      'Prefixo',
      'Status Atual',
      'Saída / Aracaré',
      'Tempo Parado',
      'Local',
      'Observação',
    ],
    widths: [16, 24, 14, 32, 13, 20, 16, 16, 25, 55],
    rows: viewModel.operating.map(operationRow),
    statusColumn: 6,
    wrapColumns: [10],
  });
  createDataSheet(workbook, {
    name: 'MANUTENÇÃO',
    tableName: 'ManutencaoCBs',
    columns: [
      'Grupo',
      'Tipo',
      'Prefixo',
      'Entrada',
      'Tempo Parado',
      'Status Atual',
      'Ocorrência / Motivo',
      'OS',
    ],
    widths: [16, 24, 14, 16, 16, 22, 60, 16],
    rows: viewModel.maintenance.map(maintenanceRow),
    statusColumn: 6,
    wrapColumns: [7],
  });
  createDataSheet(workbook, {
    name: 'À DISPOSIÇÃO',
    tableName: 'DisponibilidadeCBs',
    columns: [
      'Grupo',
      'Tipo',
      'Matrícula',
      'Nome / Motorista',
      'Prefixo',
      'Status Atual',
      'Desde',
      'Tempo Parado',
      'Local',
      'Observação',
    ],
    widths: [16, 24, 14, 32, 13, 20, 16, 16, 25, 55],
    rows: viewModel.available.map(availableRow),
    statusColumn: 6,
    wrapColumns: [10],
  });
  createDataSheet(workbook, {
    name: 'A CONFIRMAR',
    tableName: 'ConfirmacaoCBs',
    columns: [
      'Grupo',
      'Tipo',
      'Matrícula',
      'Nome / Motorista',
      'Prefixo',
      'Status Atual',
      'Horário',
      'Tempo Parado',
      'Local',
      'Observação',
    ],
    widths: [16, 24, 14, 32, 13, 20, 16, 16, 25, 55],
    rows: viewModel.pending.map(availableRow),
    statusColumn: 6,
    wrapColumns: [10],
  });
  createHistorySheet(workbook, viewModel);
  return workbook;
};

export const exportFleetExcel = async (
  viewModel: FleetReportViewModel,
): Promise<FleetExcelResult> => {
  const [renea, spmar] = await Promise.all([loadImageBase64(reneaLogoUrl), loadImageBase64(spmarLogoUrl)]);
  const workbook = buildFleetWorkbook(viewModel, { renea, spmar });
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `RELATORIO_FROTAS_ALTO_TIETE_${viewModel.reportDate}.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return {
    fileName,
    sheets: workbook.worksheets.map(sheet => sheet.name),
    rows: viewModel.allRows.length,
  };
};

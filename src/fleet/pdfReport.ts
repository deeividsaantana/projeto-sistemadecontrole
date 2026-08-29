import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { FLEET_OPERATIONAL_STATUS, type FleetCurrentState, type FleetReportViewModel } from './domain';
import { getFleetStatusDefinition } from './status';
import { formatBrazilianDateTime } from './time';
import reneaLogoUrl from '../assets/images/renea_logo_new.png';
import spmarLogoUrl from '../assets/images/spmar_logo.png';
import { summarizeFleetCategories } from './categorySummary';

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN_X = 9;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const GREEN = '#15824B';
const DARK = '#242A30';
const GRAY = '#F0F1F2';
const BORDER = '#C9CDD1';
type JsPdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

type PdfRow = Record<string, string>;

export interface FleetPdfResult {
  fileName: string;
  pages: number;
  rows: number;
}

const loadImageData = async (url: string): Promise<string | undefined> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

const drawHeader = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  reneaLogo?: string,
  spmarLogo?: string,
): number => {
  if (reneaLogo) {
    // O arquivo oficial possui margens transparentes grandes. Estas dimensões
    // preservam a proporção original e posicionam apenas a área visível.
    document.addImage(reneaLogo, 'PNG', MARGIN_X - 14.5, -11.5, 80, 44.7, undefined, 'FAST');
  } else {
    document.setFont('helvetica', 'bold');
    document.setFontSize(12);
    document.setTextColor(GREEN);
    document.text('RENEA', MARGIN_X, 14);
  }
  if (spmarLogo) {
    document.addImage(spmarLogo, 'PNG', PAGE_WIDTH - MARGIN_X - 54, 5, 54, 11.7, undefined, 'FAST');
  } else {
    document.setFont('helvetica', 'bold');
    document.setFontSize(10);
    document.setTextColor('#4D545B');
    document.text('SPMAR', PAGE_WIDTH - MARGIN_X, 14, { align: 'right' });
  }
  document.setTextColor(DARK);
  document.setFont('helvetica', 'bold');
  document.setTextColor('#10223A');
  document.setFontSize(13.5);
  document.text('RELATÓRIO DIÁRIO DE SITUAÇÃO OPERACIONAL DAS FROTAS', PAGE_WIDTH / 2, 11.5, {
    align: 'center',
  });
  document.setFontSize(8.5);
  document.setTextColor('#086B3D');
  document.text(`Complexo do Alto Tietê · ${viewModel.reportDateLabel}`, PAGE_WIDTH / 2, 17, {
    align: 'center',
  });
  document.setDrawColor('#10223A');
  document.setLineWidth(0.45);
  document.line(MARGIN_X, 23, PAGE_WIDTH - MARGIN_X, 23);
  return 27;
};

const drawVehicleGlyph = (
  document: jsPDF,
  x: number,
  y: number,
  kind: 'dump' | 'water' | 'tractor' | 'fuel' | 'flatbed' = 'flatbed',
): void => {
  document.setDrawColor(GREEN);
  document.setLineWidth(0.45);
  document.rect(x + 7, y + 3, 5, 4);
  document.line(x + 7, y + 3, x + 10, y + 3);
  document.line(x + 10, y + 3, x + 12, y + 5);
  if (kind === 'water' || kind === 'fuel') {
    document.roundedRect(x, y + 2, 7, 4.5, 1.5, 1.5, 'S');
  } else if (kind === 'tractor') {
    document.rect(x + 3, y + 1, 4, 5.5);
    document.line(x, y + 6.5, x + 7, y + 6.5);
  } else if (kind === 'dump') {
    document.line(x, y + 1, x + 6.5, y + 2);
    document.line(x + 6.5, y + 2, x + 5, y + 6.5);
    document.line(x + 5, y + 6.5, x + 1, y + 6.5);
    document.line(x + 1, y + 6.5, x, y + 1);
  } else {
    document.rect(x, y + 3, 7, 3.5);
  }
  document.circle(x + 3, y + 8, 1.1);
  document.circle(x + 10, y + 8, 1.1);
};

const metricDefinitions = (
  viewModel: FleetReportViewModel,
): Array<{ label: string; value: string | number; fill: string }> => [
  { label: 'TOTAL DE FROTAS', value: viewModel.metrics.total, fill: '#FFFFFF' },
  { label: 'EM OPERAÇÃO', value: viewModel.metrics.operating, fill: '#FFFFFF' },
  { label: 'À DISPOSIÇÃO', value: viewModel.metrics.available, fill: '#FFFFFF' },
  { label: 'A CONFIRMAR', value: viewModel.metrics.pending, fill: '#FFFFFF' },
  { label: 'HORAS PARADAS', value: viewModel.metrics.stoppedDurationLabel, fill: '#FFFFFF' },
  { label: 'DISPONIBILIDADE', value: `${viewModel.metrics.availabilityRate.toFixed(1).replace('.', ',')}%`, fill: '#FFFFFF' },
];

const drawMetricStrip = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  startY: number,
): number => {
  const metrics = metricDefinitions(viewModel);
  const gap = 0;
  const width = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
  metrics.forEach((metric, index) => {
    const x = MARGIN_X + index * (width + gap);
    document.setFillColor(metric.fill);
    document.setDrawColor(BORDER);
    document.setLineWidth(0.2);
    document.roundedRect(x, startY, width, 18, index === 0 ? 1 : 0, index === 0 ? 1 : 0, 'FD');
    if (index > 0) document.line(x, startY + 2.5, x, startY + 15.5);
    const iconX = x + 11;
    const iconY = startY + 9;
    const isPending = metric.label === 'A CONFIRMAR';
    document.setDrawColor(isPending ? '#F2A900' : '#086B3D');
    document.setLineWidth(0.65);
    if (index === 0) {
      document.rect(iconX - 5, iconY - 4, 7, 6);
      document.rect(iconX + 2, iconY - 2.5, 4, 4.5);
      document.circle(iconX - 2.5, iconY + 3, 1.2);
      document.circle(iconX + 4, iconY + 3, 1.2);
    } else if (index === 1) {
      document.rect(iconX - 5, iconY - 5, 10, 10);
      document.line(iconX - 2.5, iconY, iconX - 0.5, iconY + 2);
      document.line(iconX - 0.5, iconY + 2, iconX + 3.5, iconY - 2.5);
    } else if (metric.label === 'A CONFIRMAR' || metric.label === 'HORAS PARADAS' || metric.label === 'À DISPOSIÇÃO') {
      document.circle(iconX, iconY, 5);
      document.line(iconX, iconY, iconX, iconY - 3);
      document.line(iconX, iconY, iconX + 2.5, iconY + 1.5);
    } else {
      document.circle(iconX, iconY, 5);
      document.line(iconX, iconY, iconX, iconY - 5);
      document.line(iconX, iconY, iconX + 5, iconY);
    }
    document.setTextColor('#10223A');
    document.setFont('helvetica', 'bold');
    document.setFontSize(6.2);
    document.text(metric.label, x + 23, startY + 6, { align: 'left' });
    document.setTextColor(isPending ? '#F2A900' : '#086B3D');
    document.setFontSize(15);
    document.text(String(metric.value), x + 23, startY + 14.5, { align: 'left' });
  });
  return startY + 22;
};

const drawCategorySummary = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  startY: number,
): number => {
  const categories = summarizeFleetCategories(viewModel.allRows);
  const dumpTruck = categories.find(category => category.key === 'dumpTruck');
  const support = categories.filter(category => category.key !== 'dumpTruck');
  const supportRows = [
    ['CAMINHÕES-PIPA', 'waterTruck'],
    ['CAMINHÃO COMBOIO', 'fuelTruck'],
    ['CAVALO MECÂNICO', 'tractor'],
    ['CAMINHÃO CARROCERIA', 'flatbed'],
  ] as const;
  const gap = 3;
  const leftWidth = 108;
  const rightX = MARGIN_X + leftWidth + gap;
  const rightWidth = CONTENT_WIDTH - leftWidth - gap;
  const height = 43;
  document.setDrawColor(BORDER);
  document.setLineWidth(0.25);
  document.roundedRect(MARGIN_X, startY, leftWidth, height, 1, 1, 'S');
  document.roundedRect(rightX, startY, rightWidth, height, 1, 1, 'S');
  document.setFont('helvetica', 'bold');
  document.setTextColor(DARK);
  document.setFontSize(10);
  drawVehicleGlyph(document, MARGIN_X + leftWidth / 2 - 29, startY + 1, 'dump');
  document.text('BASCULANTES', MARGIN_X + leftWidth / 2 + 3, startY + 7, { align: 'center' });
  const basculanteMetrics = [
    ['TOTAL', dumpTruck?.total ?? 0],
    ['EM OPERAÇÃO', dumpTruck?.operating ?? 0],
    ['À DISPOSIÇÃO', dumpTruck?.available ?? 0],
    ['A CONFIRMAR', dumpTruck?.pending ?? 0],
  ] as const;
  basculanteMetrics.forEach(([label, value], index) => {
    const x = MARGIN_X + 4 + index * 25;
    document.setFontSize(5.5);
    document.setTextColor('#687078');
    document.text(label, x, startY + 17);
    document.setFontSize(14);
    document.setTextColor(index === 3 ? '#B77900' : GREEN);
    document.text(String(value), x, startY + 29);
  });
  document.setFontSize(10);
  document.setTextColor(DARK);
  drawVehicleGlyph(document, rightX + rightWidth / 2 - 40, startY + 1, 'water');
  document.text('APOIO · PÁTIO ARACARÉ', rightX + rightWidth / 2 + 4, startY + 7, { align: 'center' });
  document.setFontSize(13);
  document.setTextColor(GREEN);
  const supportTotal = support.reduce((sum, category) => sum + category.total, 0);
  document.text(String(supportTotal), rightX + 13, startY + 25);
  document.setFontSize(5.3);
  document.setTextColor('#687078');
  document.text('EM OPERAÇÃO', rightX + 4, startY + 34);
  supportRows.forEach(([label, key], index) => {
    const category = support.find(item => item.key === key);
    const y = startY + 15 + index * 6;
    document.setFont('helvetica', 'bold');
    document.setFontSize(6.2);
    document.setTextColor(DARK);
    document.text(label, rightX + 32, y);
    document.setTextColor(GREEN);
    document.text(String(category?.total ?? 0), rightX + 78, y);
    document.setFont('helvetica', 'normal');
    document.setTextColor('#53606B');
    document.text(category?.prefixes.join(', ') || '—', rightX + 88, y);
  });
  return startY + height + 4;
};

const operationRows = (rows: FleetCurrentState[]): PdfRow[] => rows.map(state => ({
  group: state.equipment.family || '—',
  type: state.equipment.equipmentType || '—',
  employeeCode: state.driver?.employeeCode || '—',
  driver: state.driver?.employeeName || 'Sem motorista',
  prefix: state.equipment.prefix,
  status: state.operationalStatus,
  departure: state.departureTime || '—',
  stopped: state.stoppedDurationLabel,
  location: state.location || '—',
  note: state.note || state.maintenanceReason || '—',
}));

const maintenanceRows = (rows: FleetCurrentState[]): PdfRow[] => rows.map(state => ({
  prefix: state.equipment.prefix,
  entry: state.maintenanceEntryTime || 'Não informado',
  stopped: state.stoppedDurationLabel,
  status: state.operationalStatus,
  reason: state.maintenanceReason || state.note || 'Não informado',
}));

const availableRows = (rows: FleetCurrentState[]): PdfRow[] => rows.map(state => ({
  employeeCode: state.driver?.employeeCode || '—',
  driver: state.driver?.employeeName || 'Sem motorista',
  prefix: state.equipment.prefix,
  status: state.operationalStatus,
  since: state.availableSince || state.releaseTime || 'Não informado',
  stopped: state.stoppedDurationLabel,
  note: state.note || '—',
}));

const applyStatusCell = (
  data: CellHookData,
  statusColumn: number,
): void => {
  if (data.section !== 'body' || data.column.index !== statusColumn) return;
  const definition = getFleetStatusDefinition(
    String(data.cell.raw) as FleetCurrentState['operationalStatus'],
  );
  data.cell.styles.textColor = definition.reportColor;
  data.cell.styles.fillColor = definition.reportBackground;
  data.cell.styles.fontStyle = 'bold';
};

const prepareStatusPill = (data: CellHookData, statusColumn: number): void => {
  if (data.section !== 'body' || data.column.index !== statusColumn) return;
  data.cell.text = [];
  data.cell.styles.fillColor = '#FFFFFF';
};

const drawStatusPill = (document: jsPDF, data: CellHookData, statusColumn: number): void => {
  if (data.section !== 'body' || data.column.index !== statusColumn) return;
  const value = String(data.cell.raw) as FleetCurrentState['operationalStatus'];
  const definition = getFleetStatusDefinition(value);
  const label = value === FLEET_OPERATIONAL_STATUS.operating
    ? 'EM OPERAÇÃO'
    : value.toUpperCase();
  const pillWidth = Math.min(data.cell.width - 3, Math.max(18, document.getTextWidth(label) + 6));
  const pillX = data.cell.x + (data.cell.width - pillWidth) / 2;
  const pillY = data.cell.y + 1.1;
  const pillHeight = data.cell.height - 2.2;
  document.setFillColor(definition.reportColor);
  document.roundedRect(pillX, pillY, pillWidth, pillHeight, 1, 1, 'F');
  document.setFont('helvetica', 'bold');
  document.setFontSize(5.7);
  document.setTextColor('#FFFFFF');
  document.text(label, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.2, {
    align: 'center',
  });
};

const drawTableTitle = (
  document: jsPDF,
  title: string,
  y: number,
): number => {
  document.setFillColor('#E6E8EA');
  document.setDrawColor(BORDER);
  document.setLineWidth(0.2);
  document.rect(MARGIN_X, y, CONTENT_WIDTH, 6, 'FD');
  document.setTextColor(DARK);
  document.setFont('helvetica', 'bold');
  document.setFontSize(7.5);
  document.text(title.toUpperCase(), MARGIN_X + 2, y + 4);
  return y + 6;
};

const commonTableOptions = {
  theme: 'grid' as const,
  // A margem superior também é obrigatória: sem ela o AutoTable pode ocupar
  // o cabeçalho institucional ao iniciar uma tabela em uma página já criada.
  margin: { top: 31, left: MARGIN_X, right: MARGIN_X, bottom: 16 },
  styles: {
    font: 'helvetica',
    fontSize: 6.2,
    cellPadding: { top: 1.25, right: 1.2, bottom: 1.25, left: 1.2 },
    lineColor: BORDER,
    lineWidth: 0.15,
    textColor: DARK,
    overflow: 'linebreak' as const,
    valign: 'middle' as const,
  },
  headStyles: {
    fillColor: '#082343',
    textColor: '#FFFFFF',
    fontStyle: 'bold' as const,
    halign: 'center' as const,
    lineColor: '#AEB3B8',
  },
  alternateRowStyles: { fillColor: '#FAFAFA' },
  rowPageBreak: 'avoid' as const,
  showHead: 'everyPage' as const,
};

const drawOperationTable = (
  document: jsPDF,
  rows: FleetCurrentState[],
  startY: number,
  viewModel?: FleetReportViewModel,
  reneaLogo?: string,
  spmarLogo?: string,
): number => {
  const body: RowInput[] = rows.length
    ? operationRows(rows)
    : [['—', 'Nenhuma frota em operação neste período.', '—', '—', '—', '—', '—', '—', '—']];
  autoTable(document, {
    ...commonTableOptions,
    startY,
    head: [[
      'GRUPO',
      'TIPO',
      'PREFIXO',
      'SITUAÇÃO',
      'HORA DE SAÍDA',
      'MATRÍCULA',
      'MOTORISTA / OPERADOR',
      'LOCAL DE SAÍDA',
      'OBSERVAÇÃO',
    ]],
    body,
    columns: rows.length ? [
      { header: 'GRUPO', dataKey: 'group' },
      { header: 'TIPO', dataKey: 'type' },
      { header: 'PREFIXO', dataKey: 'prefix' },
      { header: 'SITUAÇÃO', dataKey: 'status' },
      { header: 'HORA DE SAÍDA', dataKey: 'departure' },
      { header: 'MATRÍCULA', dataKey: 'employeeCode' },
      { header: 'MOTORISTA / OPERADOR', dataKey: 'driver' },
      { header: 'LOCAL DE SAÍDA', dataKey: 'location' },
      { header: 'OBSERVAÇÃO', dataKey: 'note' },
    ] : undefined,
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 36 },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 29, halign: 'center' },
      4: { cellWidth: 23, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 58 },
      7: { cellWidth: 29 },
      8: { cellWidth: 39 },
    },
    didParseCell: data => prepareStatusPill(data, 3),
    didDrawCell: data => drawStatusPill(document, data, 3),
    didDrawPage: data => {
      if (data.pageNumber > 1 && viewModel) drawHeader(document, viewModel, reneaLogo, spmarLogo);
    },
  });
  return (document as JsPdfWithAutoTable).lastAutoTable.finalY;
};

const drawMaintenanceTable = (
  document: jsPDF,
  rows: FleetCurrentState[],
  startY: number,
): number => {
  const titleEnd = drawTableTitle(document, 'Frotas em manutenção', startY);
  const body: RowInput[] = rows.length
    ? maintenanceRows(rows)
    : [['—', '—', '—', 'Nenhum CB em manutenção.', '—']];
  autoTable(document, {
    ...commonTableOptions,
    startY: titleEnd,
    head: [['PREFIXO', 'ENTRADA', 'TEMPO PARADO', 'STATUS ATUAL', 'OCORRÊNCIA / MOTIVO']],
    body,
    columns: rows.length ? [
      { header: 'PREFIXO', dataKey: 'prefix' },
      { header: 'ENTRADA', dataKey: 'entry' },
      { header: 'TEMPO PARADO', dataKey: 'stopped' },
      { header: 'STATUS ATUAL', dataKey: 'status' },
      { header: 'OCORRÊNCIA / MOTIVO', dataKey: 'reason' },
    ] : undefined,
    bodyStyles: { fillColor: '#FEF8F8' },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 38, halign: 'center' },
      4: { cellWidth: 151 },
    },
    didParseCell: data => applyStatusCell(data, 3),
  });
  return (document as JsPdfWithAutoTable).lastAutoTable.finalY;
};

const drawAvailableTable = (
  document: jsPDF,
  rows: FleetCurrentState[],
  startY: number,
): number => {
  const titleEnd = drawTableTitle(document, 'Frotas à disposição', startY);
  const body: RowInput[] = rows.length
    ? availableRows(rows)
    : [['—', 'Nenhum CB à disposição.', '—', '—', '—', '—', '—']];
  autoTable(document, {
    ...commonTableOptions,
    startY: titleEnd,
    head: [[
      'MATRÍCULA',
      'NOME / MOTORISTA',
      'PREFIXO',
      'STATUS ATUAL',
      'DESDE',
      'TEMPO PARADO',
      'OBSERVAÇÃO',
    ]],
    body,
    columns: rows.length ? [
      { header: 'MATRÍCULA', dataKey: 'employeeCode' },
      { header: 'NOME / MOTORISTA', dataKey: 'driver' },
      { header: 'PREFIXO', dataKey: 'prefix' },
      { header: 'STATUS ATUAL', dataKey: 'status' },
      { header: 'DESDE', dataKey: 'since' },
      { header: 'TEMPO PARADO', dataKey: 'stopped' },
      { header: 'OBSERVAÇÃO', dataKey: 'note' },
    ] : undefined,
    bodyStyles: { fillColor: '#F4FAFD' },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 54 },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 101 },
    },
    didParseCell: data => applyStatusCell(data, 3),
  });
  return (document as JsPdfWithAutoTable).lastAutoTable.finalY;
};

const addPageFooters = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
): void => {
  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    document.setDrawColor(GREEN);
    document.setLineWidth(0.55);
    document.line(MARGIN_X, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12);
    document.setFont('helvetica', 'normal');
    document.setFontSize(5.5);
    document.setTextColor('#717980');
    document.text(
      `Gerado em ${formatBrazilianDateTime(viewModel.generatedAt)} · ${viewModel.companyLabel}`,
      MARGIN_X,
      PAGE_HEIGHT - 6,
    );
    document.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 6, {
      align: 'right',
    });
  }
};

const drawPendingBanner = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  startY: number,
): number => {
  const pending = viewModel.metrics.pending;
  document.setDrawColor('#F2A900');
  document.setLineWidth(0.3);
  document.roundedRect(MARGIN_X, startY, CONTENT_WIDTH, 13, 1, 1, 'S');
  document.setTextColor('#10223A');
  document.setFont('helvetica', 'bold');
  document.setFontSize(8.5);
  document.text('CONFERÊNCIAS PENDENTES', MARGIN_X + 15, startY + 7.8);
  document.setTextColor('#F2A900');
  document.setFontSize(15);
  document.text('!', MARGIN_X + 7, startY + 8.7, { align: 'center' });
  document.setTextColor('#24344A');
  document.setFont('helvetica', 'normal');
  document.setFontSize(7);
  const message = pending > 0
    ? `${pending} veículo${pending === 1 ? '' : 's'} aguardando confirmação de saída.`
    : 'Nenhuma conferência pendente para os equipamentos informados.';
  document.text(message, MARGIN_X + 68, startY + 5.2);
  document.text(
    'Conferir documentação e equipamentos antes do início da operação.',
    MARGIN_X + 68,
    startY + 9.2,
  );
  return startY + 13;
};

const ensureSectionRoom = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  currentY: number,
  estimatedHeight: number,
  reneaLogo?: string,
  spmarLogo?: string,
): number => {
  const contentBottom = PAGE_HEIGHT - 13;
  if (currentY + estimatedHeight <= contentBottom) return currentY;
  document.addPage('a4', 'landscape');
  return drawHeader(document, viewModel, reneaLogo, spmarLogo);
};

const buildFleetPdfDocument = (
  viewModel: FleetReportViewModel,
  reneaLogo?: string,
  spmarLogo?: string,
  compress = false,
): jsPDF => {
  const document = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress,
  });
  let y = drawHeader(document, viewModel, reneaLogo, spmarLogo);
  y = drawMetricStrip(document, viewModel, y);
  y = drawCategorySummary(document, viewModel, y);
  y = drawOperationTable(document, viewModel.allRows, y, viewModel, reneaLogo, spmarLogo);
  y = ensureSectionRoom(
    document,
    viewModel,
    y + 4,
    17,
    reneaLogo,
    spmarLogo,
  );
  drawPendingBanner(document, viewModel, y);
  addPageFooters(document, viewModel);
  return document;
};

export const generateFleetPdf = async (
  viewModel: FleetReportViewModel,
): Promise<FleetPdfResult> => {
  const [reneaLogo, spmarLogo] = await Promise.all([
    loadImageData(reneaLogoUrl),
    loadImageData(spmarLogoUrl),
  ]);
  const document = buildFleetPdfDocument(viewModel, reneaLogo, spmarLogo, true);
  const fileName = `RELATORIO_DIARIO_SITUACAO_OPERACIONAL_FROTAS_${viewModel.reportDate}.pdf`;
  document.save(fileName);
  return {
    fileName,
    pages: document.getNumberOfPages(),
    rows: viewModel.allRows.length,
  };
};

export const createFleetPdfArrayBuffer = async (
  viewModel: FleetReportViewModel,
): Promise<ArrayBuffer> => {
  const [reneaLogo, spmarLogo] = await Promise.all([
    loadImageData(reneaLogoUrl),
    loadImageData(spmarLogoUrl),
  ]);
  const document = buildFleetPdfDocument(viewModel, reneaLogo, spmarLogo);
  return document.output('arraybuffer');
};

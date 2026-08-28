import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import type { FleetCurrentState, FleetReportViewModel } from './domain';
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
    document.addImage(reneaLogo, 'PNG', MARGIN_X, 7, 33, 12, undefined, 'FAST');
  } else {
    document.setFont('helvetica', 'bold');
    document.setFontSize(12);
    document.setTextColor(GREEN);
    document.text('RENEA', MARGIN_X, 14);
  }
  if (spmarLogo) {
    document.addImage(spmarLogo, 'PNG', PAGE_WIDTH - MARGIN_X - 30, 7, 30, 12, undefined, 'FAST');
  } else {
    document.setFont('helvetica', 'bold');
    document.setFontSize(10);
    document.setTextColor('#4D545B');
    document.text('SPMAR', PAGE_WIDTH - MARGIN_X, 14, { align: 'right' });
  }
  document.setTextColor(DARK);
  document.setFont('helvetica', 'bold');
  document.setFontSize(12.5);
  document.text('RELATÓRIO DIÁRIO DE SITUAÇÃO OPERACIONAL', PAGE_WIDTH / 2, 11, {
    align: 'center',
  });
  document.setFontSize(10);
  document.text('FROTAS OPERACIONAIS · COMPLEXO DO ALTO TIETÊ', PAGE_WIDTH / 2, 16, {
    align: 'center',
  });
  document.setFont('helvetica', 'normal');
  document.setFontSize(7.5);
  document.setTextColor('#626A72');
  document.text(viewModel.operationName, PAGE_WIDTH / 2, 20, { align: 'center' });
  document.setDrawColor(GREEN);
  document.setLineWidth(0.7);
  document.line(MARGIN_X, 23, PAGE_WIDTH - MARGIN_X, 23);
  return 26;
};

const metricDefinitions = (
  viewModel: FleetReportViewModel,
): Array<{ label: string; value: string | number; fill: string }> => [
  { label: 'DATA', value: viewModel.reportDateLabel, fill: '#F3F4F5' },
  { label: 'TOTAL DE FROTAS', value: viewModel.metrics.total, fill: '#F3F4F5' },
  { label: 'EM OPERAÇÃO', value: viewModel.metrics.operating, fill: '#EDF8F2' },
  {
    label: 'EM MANUTENÇÃO',
    value: viewModel.metrics.maintenance + viewModel.metrics.waitingMaintenance,
    fill: '#FDF0F0',
  },
  { label: 'À DISPOSIÇÃO', value: viewModel.metrics.available, fill: '#EEF7FC' },
  {
    label: 'HORAS PARADAS',
    value: viewModel.metrics.stoppedDurationLabel,
    fill: '#FFF8E8',
  },
];

const drawMetricStrip = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  startY: number,
): number => {
  const metrics = metricDefinitions(viewModel);
  const gap = 1.5;
  const width = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
  metrics.forEach((metric, index) => {
    const x = MARGIN_X + index * (width + gap);
    document.setFillColor(metric.fill);
    document.setDrawColor(BORDER);
    document.setLineWidth(0.2);
    document.roundedRect(x, startY, width, 12, 0.6, 0.6, 'FD');
    document.setTextColor('#60676E');
    document.setFont('helvetica', 'bold');
    document.setFontSize(5.8);
    document.text(metric.label, x + width / 2, startY + 3.5, { align: 'center' });
    document.setTextColor(DARK);
    document.setFontSize(9);
    document.text(String(metric.value), x + width / 2, startY + 8.7, { align: 'center' });
  });
  return startY + 15;
};

const drawCategorySummary = (
  document: jsPDF,
  viewModel: FleetReportViewModel,
  startY: number,
): number => {
  const categories = summarizeFleetCategories(viewModel.allRows);
  const dumpTruck = categories.find(category => category.key === 'dumpTruck');
  const support = categories.filter(category => category.key !== 'dumpTruck');
  const gap = 3;
  const leftWidth = 108;
  const rightX = MARGIN_X + leftWidth + gap;
  const rightWidth = CONTENT_WIDTH - leftWidth - gap;
  const height = 27;
  document.setDrawColor(BORDER);
  document.setLineWidth(0.25);
  document.roundedRect(MARGIN_X, startY, leftWidth, height, 1, 1, 'S');
  document.roundedRect(rightX, startY, rightWidth, height, 1, 1, 'S');
  document.setFont('helvetica', 'bold');
  document.setTextColor(DARK);
  document.setFontSize(8.5);
  document.text('BASCULANTES', MARGIN_X + 4, startY + 5.5);
  const basculanteMetrics = [
    ['TOTAL', dumpTruck?.total ?? 0],
    ['EM OPERAÇÃO', dumpTruck?.operating ?? 0],
    ['A CONFIRMAR', dumpTruck?.pending ?? 0],
  ] as const;
  basculanteMetrics.forEach(([label, value], index) => {
    const x = MARGIN_X + 4 + index * 33;
    document.setFontSize(5.5);
    document.setTextColor('#687078');
    document.text(label, x, startY + 12);
    document.setFontSize(14);
    document.setTextColor(index === 2 ? '#B77900' : GREEN);
    document.text(String(value), x, startY + 21);
  });
  document.setFontSize(8.5);
  document.setTextColor(DARK);
  document.text('APOIO · PÁTIO ARACARÉ', rightX + 4, startY + 5.5);
  document.setFontSize(13);
  document.setTextColor(GREEN);
  const supportTotal = support.reduce((sum, category) => sum + category.total, 0);
  document.text(String(supportTotal), rightX + 4, startY + 15);
  document.setFontSize(5.3);
  document.setTextColor('#687078');
  document.text('EM OPERAÇÃO / INFORMADOS', rightX + 4, startY + 20);
  support.slice(0, 4).forEach((category, index) => {
    const y = startY + 10 + index * 4;
    document.setFont('helvetica', 'bold');
    document.setFontSize(5.8);
    document.setTextColor(DARK);
    document.text(`${category.label.toUpperCase()}  ${category.total}`, rightX + 32, y);
    document.setFont('helvetica', 'normal');
    document.setTextColor('#53606B');
    document.text(category.prefixes.join(', '), rightX + 78, y);
  });
  return startY + height + 3;
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
  data.cell.styles.fontStyle = 'bold';
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
  margin: { top: 41, left: MARGIN_X, right: MARGIN_X, bottom: 13 },
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
    fillColor: '#D8DADD',
    textColor: '#252A2F',
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
): number => {
  const titleEnd = drawTableTitle(document, 'Operação - Alto Tietê', startY);
  const body: RowInput[] = rows.length
    ? operationRows(rows)
    : [['—', 'Nenhuma frota em operação neste período.', '—', '—', '—', '—', '—', '—', '—']];
  autoTable(document, {
    ...commonTableOptions,
    startY: titleEnd,
    head: [[
      'GRUPO',
      'TIPO',
      'MATRÍCULA',
      'NOME / MOTORISTA',
      'PREFIXO',
      'STATUS ATUAL',
      'SAÍDA / ARACARÉ',
      'LOCAL DE SAÍDA',
      'OBSERVAÇÃO',
    ]],
    body,
    columns: rows.length ? [
      { header: 'GRUPO', dataKey: 'group' },
      { header: 'TIPO', dataKey: 'type' },
      { header: 'MATRÍCULA', dataKey: 'employeeCode' },
      { header: 'NOME / MOTORISTA', dataKey: 'driver' },
      { header: 'PREFIXO', dataKey: 'prefix' },
      { header: 'STATUS ATUAL', dataKey: 'status' },
      { header: 'SAÍDA / ARACARÉ', dataKey: 'departure' },
      { header: 'LOCAL DE SAÍDA', dataKey: 'location' },
      { header: 'OBSERVAÇÃO', dataKey: 'note' },
    ] : undefined,
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 31 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 47 },
      4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 27, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 31 },
      8: { cellWidth: 65 },
    },
    didParseCell: data => applyStatusCell(data, 5),
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
    document.setDrawColor('#D5D8DB');
    document.setLineWidth(0.2);
    document.line(MARGIN_X, PAGE_HEIGHT - 9, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 9);
    document.setFont('helvetica', 'normal');
    document.setFontSize(5.5);
    document.setTextColor('#717980');
    document.text(
      `Gerado em ${formatBrazilianDateTime(viewModel.generatedAt)} · ${viewModel.companyLabel}`,
      MARGIN_X,
      PAGE_HEIGHT - 5,
    );
    document.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 5, {
      align: 'right',
    });
  }
};

export const generateFleetPdf = async (
  viewModel: FleetReportViewModel,
): Promise<FleetPdfResult> => {
  const [reneaLogo, spmarLogo] = await Promise.all([
    loadImageData(reneaLogoUrl),
    loadImageData(spmarLogoUrl),
  ]);
  const document = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  let y = drawHeader(document, viewModel, reneaLogo, spmarLogo);
  y = drawMetricStrip(document, viewModel, y);
  y = drawCategorySummary(document, viewModel, y);
  drawOperationTable(document, viewModel.operating, y);
  document.addPage('a4', 'landscape');
  y = drawHeader(document, viewModel, reneaLogo, spmarLogo);
  y = drawMetricStrip(document, viewModel, y);
  y = drawCategorySummary(document, viewModel, y);
  y = drawMaintenanceTable(document, viewModel.maintenance, y);
  if (y > 155) {
    document.addPage('a4', 'landscape');
    y = drawHeader(document, viewModel, reneaLogo, spmarLogo);
    y = drawMetricStrip(document, viewModel, y);
  } else {
    y += 5;
  }
  drawAvailableTable(document, viewModel.available, y);
  addPageFooters(document, viewModel);
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
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = drawHeader(document, viewModel, reneaLogo, spmarLogo);
  y = drawMetricStrip(document, viewModel, y);
  y = drawCategorySummary(document, viewModel, y);
  drawOperationTable(document, viewModel.operating, y);
  document.addPage('a4', 'landscape');
  y = drawHeader(document, viewModel, reneaLogo, spmarLogo);
  y = drawMetricStrip(document, viewModel, y);
  y = drawCategorySummary(document, viewModel, y);
  y = drawMaintenanceTable(document, viewModel.maintenance, y);
  drawAvailableTable(document, viewModel.available, Math.min(y + 5, 155));
  addPageFooters(document, viewModel);
  return document.output('arraybuffer');
};

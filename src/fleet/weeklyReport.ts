import ExcelJS from 'exceljs';
import { classifyOperationalFleet } from './reconciliation';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ControleEquipamentoDiario } from '../types';
const reneaLogoUrl = new URL('../assets/images/renea_logo_new.png', import.meta.url).href;
const spmarLogoUrl = new URL('../assets/images/spmar_logo.png', import.meta.url).href;

export interface WeeklyFleetDay {
  date: string;
  total: number;
  operating: number;
  maintenance: number;
  available: number;
  pending: number;
  availabilityRate: number;
}

export interface WeeklyFleetReport {
  startDate: string;
  endDate: string;
  days: WeeklyFleetDay[];
  records: ControleEquipamentoDiario[];
  totals: Omit<WeeklyFleetDay, 'date' | 'availabilityRate'>;
  averages: Omit<WeeklyFleetDay, 'date' | 'availabilityRate'> & { availabilityRate: number };
}

export interface WeeklyExportResult {
  fileName: string;
  rows: number;
  pages?: number;
  sheets?: string[];
}

const parseIsoDate = (value: string): Date => new Date(`${value}T12:00:00`);

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string): string =>
  parseIsoDate(value).toLocaleDateString('pt-BR');

const isMaintenance = (status: string): boolean =>
  status === 'Em manutenção' || status === 'Aguardando manutenção';

export const buildWeeklyFleetReport = (
  records: ControleEquipamentoDiario[],
  requestedEndDate?: string,
): WeeklyFleetReport => {
  const validDates = records.map(record => record.data).filter(Boolean).sort();
  const endDate = requestedEndDate || validDates.at(-1) || toIsoDate(new Date());
  const start = parseIsoDate(endDate);
  start.setDate(start.getDate() - 6);
  const startDate = toIsoDate(start);
  const weeklyRecords = records
    .filter(record => record.data >= startDate && record.data <= endDate)
    .sort((left, right) => `${left.data}-${left.prefixo}`.localeCompare(`${right.data}-${right.prefixo}`, 'pt-BR', { numeric: true }));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isoDate = toIsoDate(date);
    const daily = weeklyRecords.filter(record => record.data === isoDate);
    const operating = daily.filter(record => record.status === 'Em operação').length;
    const maintenance = daily.filter(record => isMaintenance(record.status)).length;
    const available = daily.filter(record => record.status === 'Disponível').length;
    const pending = daily.filter(record => record.status === 'A confirmar').length;
    return {
      date: isoDate,
      total: daily.length,
      operating,
      maintenance,
      available,
      pending,
      availabilityRate: daily.length ? ((operating + available) / daily.length) * 100 : 0,
    };
  });
  const totals = days.reduce((sum, day) => ({
    total: sum.total + day.total,
    operating: sum.operating + day.operating,
    maintenance: sum.maintenance + day.maintenance,
    available: sum.available + day.available,
    pending: sum.pending + day.pending,
  }), { total: 0, operating: 0, maintenance: 0, available: 0, pending: 0 });
  const averages = {
    total: totals.total / days.length,
    operating: totals.operating / days.length,
    maintenance: totals.maintenance / days.length,
    available: totals.available / days.length,
    pending: totals.pending / days.length,
    availabilityRate: days.reduce((sum, day) => sum + day.availabilityRate, 0) / days.length,
  };
  return { startDate, endDate, days, records: weeklyRecords, totals, averages };
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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

export const exportWeeklyFleetPdf = async (
  report: WeeklyFleetReport,
): Promise<WeeklyExportResult> => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [reneaLogo, spmarLogo] = await Promise.all([
    loadImageData(reneaLogoUrl),
    loadImageData(spmarLogoUrl),
  ]);
  if (reneaLogo) pdf.addImage(reneaLogo, 'PNG', -5, -9, 76, 42, undefined, 'FAST');
  if (spmarLogo) pdf.addImage(spmarLogo, 'PNG', 235, 5, 53, 11.5, undefined, 'FAST');
  pdf.setTextColor('#10223A');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('RELATÓRIO SEMANAL DE SITUAÇÃO OPERACIONAL DAS FROTAS', 148.5, 12, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setTextColor('#086B3D');
  pdf.text(`Complexo do Alto Tietê · ${formatDate(report.startDate)} a ${formatDate(report.endDate)}`, 148.5, 18, { align: 'center' });
  pdf.setDrawColor('#10223A');
  pdf.line(9, 23, 288, 23);

  autoTable(pdf, {
    startY: 28,
    margin: { left: 9, right: 9 },
    head: [['Data', 'Total de frotas', 'Em operação', 'Em manutenção', 'À disposição', 'A confirmar', 'Disponibilidade']],
    body: report.days.map(day => [
      formatDate(day.date),
      day.total,
      day.operating,
      day.maintenance,
      day.available,
      day.pending,
      day.total ? `${day.availabilityRate.toFixed(1).replace('.', ',')}%` : '—',
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.4, halign: 'center', textColor: '#10223A' },
    headStyles: { fillColor: '#10223A', textColor: '#FFFFFF', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#F4F7F5' },
  });

  const summaryY = ((pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 75) + 7;
  pdf.setFontSize(9);
  pdf.setTextColor('#252A2F');
  pdf.text(`Acumulado: ${report.totals.total} lançamentos · ${report.totals.operating} em operação · ${report.totals.maintenance} em manutenção · ${report.totals.available} à disposição · ${report.totals.pending} a confirmar`, 9, summaryY);
  pdf.text(`Média diária: ${report.averages.total.toFixed(1).replace('.', ',')} frotas · ${report.averages.operating.toFixed(1).replace('.', ',')} em operação · disponibilidade média ${report.averages.availabilityRate.toFixed(1).replace('.', ',')}%`, 9, summaryY + 4.5);

  autoTable(pdf, {
    startY: summaryY + 10,
    margin: { left: 9, right: 9 },
    head: [['Data', 'Grupo', 'Tipo', 'Prefixo', 'Situação', 'Hora de saída', 'Matrícula', 'Motorista / operador', 'Observação']],
    body: report.records.map(record => {
      const classification = classifyOperationalFleet({
        prefixo: record.prefixo,
        familia: record.familia,
        tipo: record.tipoEquipamento || '',
        nome: record.tipoEquipamento || '',
      });
      return [
      formatDate(record.data), classification.group, classification.equipmentType, record.prefixo || '—',
      record.status || '—', record.horaSaida || '—', record.codigoFuncionario || '—',
      record.nomeMotorista || '—', record.observacao || '—',
      ];
    }),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.5, textColor: '#10223A' },
    headStyles: { fillColor: '#15824B', textColor: '#FFFFFF', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#F7F7F7' },
    columnStyles: { 8: { cellWidth: 46 } },
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(7);
    pdf.setTextColor('#687078');
    pdf.text(`Sistema RENEA · Página ${page} de ${pages}`, 288, 204, { align: 'right' });
  }
  const fileName = `RELATORIO_SEMANAL_FROTAS_${report.startDate}_A_${report.endDate}.pdf`;
  pdf.save(fileName);
  return { fileName, rows: report.records.length, pages };
};

export const buildWeeklyFleetWorkbook = (report: WeeklyFleetReport): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema RENEA';
  workbook.created = new Date();
  const summary = workbook.addWorksheet('RESUMO SEMANAL', { views: [{ showGridLines: false }] });
  summary.mergeCells('A1:G1');
  summary.getCell('A1').value = 'RELATÓRIO SEMANAL DE SITUAÇÃO OPERACIONAL DAS FROTAS';
  summary.getCell('A1').font = { name: 'Aptos Narrow', size: 16, bold: true, color: { argb: 'FF10223A' } };
  summary.getCell('A1').alignment = { horizontal: 'center' };
  summary.mergeCells('A2:G2');
  summary.getCell('A2').value = `Complexo do Alto Tietê · ${formatDate(report.startDate)} a ${formatDate(report.endDate)}`;
  summary.getCell('A2').alignment = { horizontal: 'center' };
  summary.addRow(['INDICADORES DA SEMANA', 'Acumulado', 'Média diária', '', '', '', '']);
  summary.addRow(['Total de frotas', report.totals.total, report.averages.total, '', '', '', '']);
  summary.addRow(['Em operação', report.totals.operating, report.averages.operating, '', '', '', '']);
  summary.addRow(['Em manutenção', report.totals.maintenance, report.averages.maintenance, '', '', '', '']);
  summary.addRow(['À disposição', report.totals.available, report.averages.available, '', '', '', '']);
  summary.addRow(['A confirmar', report.totals.pending, report.averages.pending, '', '', '', '']);
  summary.addRow(['Disponibilidade média', '', report.averages.availabilityRate / 100, '', '', '', '']);
  summary.columns = [
    { header: 'Data', key: 'date', width: 16 },
    { header: 'Total de frotas', key: 'total', width: 18 },
    { header: 'Em operação', key: 'operating', width: 18 },
    { header: 'Em manutenção', key: 'maintenance', width: 18 },
    { header: 'À disposição', key: 'available', width: 18 },
    { header: 'A confirmar', key: 'pending', width: 18 },
    { header: 'Disponibilidade', key: 'availability', width: 18 },
  ];
  summary.addRows(report.days.map(day => ({
    date: formatDate(day.date), total: day.total, operating: day.operating,
    maintenance: day.maintenance, available: day.available, pending: day.pending,
    availability: day.total ? day.availabilityRate / 100 : null,
  })));
  summary.getRow(3).font = { name: 'Aptos Narrow', bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10223A' } };
  summary.getRow(10).font = { name: 'Aptos Narrow', bold: true, color: { argb: 'FF15824B' } };
  summary.getRow(10).getCell(3).numFmt = '0.0%';
  summary.getRow(11).font = { name: 'Aptos Narrow', bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10223A' } };
  summary.getColumn('availability').numFmt = '0.0%';
  summary.autoFilter = { from: 'A11', to: 'G18' };
  summary.views = [{ state: 'frozen', ySplit: 11, showGridLines: false }];
  summary.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  const details = workbook.addWorksheet('DETALHAMENTO', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  details.columns = [
    { header: 'Data', key: 'date', width: 14 }, { header: 'Grupo', key: 'group', width: 18 },
    { header: 'Tipo', key: 'equipmentType', width: 24 }, { header: 'Prefixo', key: 'prefix', width: 14 }, { header: 'Situação', key: 'status', width: 22 },
    { header: 'Hora de saída', key: 'departure', width: 16 }, { header: 'Matrícula', key: 'employeeCode', width: 15 },
    { header: 'Motorista / operador', key: 'driver', width: 36 }, { header: 'Observação', key: 'note', width: 50 },
  ];
  details.addRows(report.records.map(record => {
    const classification = classifyOperationalFleet({ prefixo: record.prefixo, familia: record.familia, tipo: record.tipoEquipamento || '', nome: record.tipoEquipamento || '' });
    return ({
    date: formatDate(record.data), group: classification.group, equipmentType: classification.equipmentType, prefix: record.prefixo || '—',
    status: record.status || '—', departure: record.horaSaida || '—', employeeCode: record.codigoFuncionario || '—',
    driver: record.nomeMotorista || '—', note: record.observacao || '—',
    });
  }));
  details.getRow(1).font = { name: 'Aptos Narrow', bold: true, color: { argb: 'FFFFFFFF' } };
  details.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15824B' } };
  details.autoFilter = { from: 'A1', to: `I${Math.max(2, report.records.length + 1)}` };
  details.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return workbook;
};

export const exportWeeklyFleetExcel = async (
  report: WeeklyFleetReport,
): Promise<WeeklyExportResult> => {
  const workbook = buildWeeklyFleetWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `RELATORIO_SEMANAL_FROTAS_${report.startDate}_A_${report.endDate}.xlsx`;
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  return { fileName, rows: report.records.length, sheets: workbook.worksheets.map(sheet => sheet.name) };
};

import React, { useMemo, useState } from 'react';
import {
  Abastecimento,
  Comboio,
  Empresa,
  Equipamento,
  TicketJazida,
  TipoCombustivel,
} from '../types';
import {
  buildFuelAnalytics,
  buildJazidaAnalytics,
  FuelDetailRow,
  JazidaDetailRow,
} from '../utils/operationalAnalytics';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FilterX,
  Fuel,
  Gauge,
  Printer,
  Search,
  ShieldCheck,
  TicketCheck,
  Truck,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import reneaLogo from '../assets/images/renea_logo_new.png';
import reneaDashboardLogo from '../assets/images/logo-renea-branco.svg';
import spmarLogo from '../assets/images/spmar_logo.png';
import {
  addCorporateSummarySheet,
  configureCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../utils/excelCorporate';

type OperationalReportsDashboardProps = {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  abastecimentos: Abastecimento[];
  ticketsJazida: TicketJazida[];
};

type DashboardMode = 'combustivel' | 'jazida';
type RowLimit = 50 | 200 | 0;

const COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#a78bfa', '#f43f5e', '#14b8a6', '#84cc16'];
const CHART_TOOLTIP = {
  backgroundColor: '#020617',
  border: '1px solid #334155',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 11,
};

const number = (value: number, digits = 0) => Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: digits,
});

const percent = (value: number) => `${number(value, 1)}%`;
const formatDate = (value: string) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
const formatDateTime = (value: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
};

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
};

const rollingRange = (days: number) => {
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(0, days - 1) * 86_400_000);
  const toIso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
};

const imageAsDataUrl = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error('Logo indisponível');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

const stripDataUrl = (value: string) => value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const escape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const content = [headers, ...rows].map(row => row.map(escape).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'emerald',
}: {
  key?: React.Key;
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet';
}) {
  const classes = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    sky: 'border-sky-500/20 bg-sky-500/5 text-sky-300',
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
    rose: 'border-rose-500/20 bg-rose-500/5 text-rose-300',
    violet: 'border-violet-500/20 bg-violet-500/5 text-violet-300',
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
        <span className="rounded-lg bg-slate-950/70 p-2"><Icon className="h-4 w-4" /></span>
      </div>
      <strong className="block font-mono text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{detail}</span>
    </div>
  );
}

function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1 border-b border-slate-800 pb-3">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">{title}</h3>
      <p className="text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

export default function OperationalReportsDashboard({
  empresas,
  equipamentos,
  comboios,
  combustiveis,
  abastecimentos,
  ticketsJazida,
}: OperationalReportsDashboardProps) {
  const initialRange = currentMonthRange();
  const [mode, setMode] = useState<DashboardMode>('combustivel');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [company, setCompany] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [comboioId, setComboioId] = useState('');
  const [fuelTypeId, setFuelTypeId] = useState('');
  const [material, setMaterial] = useState('');
  const [destination, setDestination] = useState('');
  const [search, setSearch] = useState('');
  const [rowLimit, setRowLimit] = useState<RowLimit>(50);
  const [isExporting, setIsExporting] = useState(false);

  const fuelAnalytics = useMemo(() => buildFuelAnalytics({
    abastecimentos,
    equipamentos,
    empresas,
    comboios,
    combustiveis,
    filters: {
      startDate,
      endDate,
      companyId: mode === 'combustivel' ? company : '',
      equipmentId,
      comboioId,
      fuelTypeId,
      search,
    },
  }), [abastecimentos, equipamentos, empresas, comboios, combustiveis, startDate, endDate, company, equipmentId, comboioId, fuelTypeId, search, mode]);

  const jazidaAnalytics = useMemo(() => buildJazidaAnalytics({
    tickets: ticketsJazida,
    filters: {
      startDate,
      endDate,
      company: mode === 'jazida' ? company : '',
      material,
      destination,
      search,
    },
  }), [ticketsJazida, startDate, endDate, company, material, destination, search, mode]);

  const jazidaOptions = useMemo(() => ({
    companies: Array.from(new Set(ticketsJazida.map(ticket => ticket.empresa).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    materials: Array.from(new Set(ticketsJazida.map(ticket => ticket.tipoMaterial).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    destinations: Array.from(new Set(ticketsJazida.map(ticket => ticket.destinoOutro || ticket.destinoObra).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }), [ticketsJazida]);

  const filteredEquipments = useMemo(() => equipamentos
    .filter(item => !company || item.empresaId === company)
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })), [equipamentos, company]);

  const invalidPeriod = Boolean(startDate && endDate && startDate > endDate);
  const totalRows = mode === 'combustivel' ? fuelAnalytics.details.length : jazidaAnalytics.details.length;
  const visibleRows = rowLimit ? Math.min(totalRows, rowLimit) : totalRows;
  const periodLabel = startDate || endDate
    ? `${startDate ? formatDate(startDate) : 'início'} a ${endDate ? formatDate(endDate) : 'hoje'}`
    : 'todo o histórico';

  const setPeriod = (kind: 'today' | '7' | '30' | 'month' | 'all') => {
    if (kind === 'today') {
      const today = todayIso();
      setStartDate(today);
      setEndDate(today);
    } else if (kind === '7' || kind === '30') {
      const range = rollingRange(Number(kind));
      setStartDate(range.start);
      setEndDate(range.end);
    } else if (kind === 'month') {
      const range = currentMonthRange();
      setStartDate(range.start);
      setEndDate(range.end);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const clearFilters = () => {
    const range = currentMonthRange();
    setStartDate(range.start);
    setEndDate(range.end);
    setCompany('');
    setEquipmentId('');
    setComboioId('');
    setFuelTypeId('');
    setMaterial('');
    setDestination('');
    setSearch('');
  };

  const changeMode = (nextMode: DashboardMode) => {
    setMode(nextMode);
    setCompany('');
    setEquipmentId('');
    setComboioId('');
    setFuelTypeId('');
    setMaterial('');
    setDestination('');
    setSearch('');
  };

  const exportCsv = () => {
    if (mode === 'combustivel') {
      downloadCsv(`RENEA_COMBUSTIVEL_${startDate || 'INICIO'}_${endDate || 'ATUAL'}.csv`, [
        'Data', 'Hora', 'Prefixo', 'Equipamento', 'Empresa', 'Comboio', 'Combustível', 'Litros',
        'Bomba inicial', 'Bomba final', 'Status', 'Origem', 'Responsável', 'Pendências',
      ], fuelAnalytics.details.map(row => [
        formatDate(row.date), row.time, row.prefix, row.equipment, row.company, row.comboio, row.fuel,
        row.liters, row.pumpInitial, row.pumpFinal, row.status, row.origin, row.responsible,
        row.warnings.join(' | '),
      ]));
    } else {
      downloadCsv(`RENEA_JAZIDA_${startDate || 'INICIO'}_${endDate || 'ATUAL'}.csv`, [
        'Data', 'Ticket', 'Criação', 'Liberação devolvida', 'Retorno liberação', 'Recebimento devolvido',
        'Retorno recebimento', 'Prefixo', 'Placa', 'Equipamento', 'Empresa', 'Material', 'Destino',
        'Quantidade', 'Unidade', 'Nota fiscal', 'Duplicidades', 'Pendências',
      ], jazidaAnalytics.details.map(row => [
        formatDate(row.date), row.number, formatDateTime(row.createdAt), row.releaseReturned ? 'Sim' : 'Não',
        formatDateTime(row.releaseReturnedAt), row.receiptReturned ? 'Sim' : 'Não', formatDateTime(row.receiptReturnedAt),
        row.prefix, row.plate, row.equipment, row.company, row.material, row.destination, row.volume, row.unit,
        row.invoice, row.duplicateCount, row.issues.join(' | '),
      ]));
    }
  };

  const addLogosToSheet = async (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => {
    try {
      const [reneaData, spmarData] = await Promise.all([imageAsDataUrl(reneaLogo), imageAsDataUrl(spmarLogo)]);
      const reneaId = workbook.addImage({ base64: stripDataUrl(reneaData), extension: 'png' });
      const spmarId = workbook.addImage({ base64: stripDataUrl(spmarData), extension: 'png' });
      worksheet.addImage(reneaId, { tl: { col: 0.05, row: 0.05 }, ext: { width: 125, height: 52 } });
      worksheet.addImage(spmarId, { tl: { col: 1.05, row: 0.1 }, ext: { width: 92, height: 42 } });
    } catch (error) {
      console.warn('O relatório foi gerado sem as imagens de marca.', error);
    }
  };

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const title = mode === 'combustivel' ? 'Painel analítico de Combustível' : 'Painel analítico da Jazida';
      configureCorporateWorkbook(workbook, `${title} - ${periodLabel}`);
      const summaryMetrics: Array<[string, string | number]> = mode === 'combustivel'
        ? [
          ['Período', periodLabel],
          ['Volume total (L)', fuelAnalytics.totalLiters],
          ['Abastecimentos', fuelAnalytics.totalRecords],
          ['Frotas abastecidas', fuelAnalytics.activeFleets],
          ['Empresas', fuelAnalytics.activeCompanies],
          ['Média por abastecimento (L)', Number(fuelAnalytics.averageLiters.toFixed(2))],
          ['Registros para conferir', fuelAnalytics.warningRecords],
          ['Qualidade dos registros', percent(fuelAnalytics.qualityPercentage)],
          ['Volume do período anterior (L)', fuelAnalytics.previousLiters],
        ]
        : [
          ['Período', periodLabel],
          ['Tickets controlados', jazidaAnalytics.totalTickets],
          ['Liberações devolvidas', jazidaAnalytics.releaseReturned],
          ['Recebimentos devolvidos', jazidaAnalytics.receiptReturned],
          ['Pares completos', jazidaAnalytics.completePairs],
          ['Pendentes de liberação', jazidaAnalytics.pendingRelease],
          ['Pendentes de recebimento', jazidaAnalytics.pendingReceipt],
          ['Volume informado', jazidaAnalytics.totalVolume],
          ['Conferência das vias', percent(jazidaAnalytics.conferencePercentage)],
          ['Números duplicados', jazidaAnalytics.duplicateTickets],
        ];
      const summary = addCorporateSummarySheet(workbook, title, summaryMetrics, [
        `Período: ${periodLabel}`,
        company ? `Empresa: ${mode === 'combustivel' ? empresas.find(item => item.id === company)?.nome || company : company}` : '',
        search ? `Busca: ${search}` : '',
      ]);
      summary.getRow(1).height = 58;
      await addLogosToSheet(workbook, summary);

      const dailySheet = workbook.addWorksheet('EVOLUÇÃO DIÁRIA');
      if (mode === 'combustivel') {
        dailySheet.addRow([]); dailySheet.addRow([]);
        dailySheet.addRow(['Data', 'Litros', 'Abastecimentos', 'Registros para conferir']);
        fuelAnalytics.daily.forEach(row => dailySheet.addRow([formatDate(row.date), row.liters, row.records, row.warnings]));
        styleCorporateWorksheet(dailySheet, { title: `Evolução diária - ${periodLabel}`, headerRow: 3, lastColumn: 4, recordCount: fuelAnalytics.daily.length });
      } else {
        dailySheet.addRow([]); dailySheet.addRow([]);
        dailySheet.addRow(['Data', 'Tickets', 'Liberações', 'Recebimentos', 'Completos', 'Pendentes', 'Volume']);
        jazidaAnalytics.daily.forEach(row => dailySheet.addRow([formatDate(row.date), row.tickets, row.release, row.receipt, row.complete, row.pending, row.volume]));
        styleCorporateWorksheet(dailySheet, { title: `Evolução diária - ${periodLabel}`, headerRow: 3, lastColumn: 7, recordCount: jazidaAnalytics.daily.length });
      }

      const rankingSheet = workbook.addWorksheet(mode === 'combustivel' ? 'RANKING FROTAS' : 'RANKING EMPRESAS');
      rankingSheet.addRow([]); rankingSheet.addRow([]);
      if (mode === 'combustivel') {
        rankingSheet.addRow(['Prefixo', 'Equipamento / Empresa', 'Litros', 'Abastecimentos', 'Média', 'Participação', 'Pendências', 'Último abastecimento']);
        fuelAnalytics.fleets.forEach(row => rankingSheet.addRow([
          row.name, row.detail, row.liters, row.records, Number(row.average.toFixed(2)), percent(row.percentage), row.warningCount, formatDate(row.lastDate),
        ]));
        styleCorporateWorksheet(rankingSheet, { title: `Consumo por frota - ${periodLabel}`, headerRow: 3, lastColumn: 8, recordCount: fuelAnalytics.fleets.length });
      } else {
        rankingSheet.addRow(['Empresa', 'Tickets', 'Volume', 'Completos', 'Pendentes', 'Participação']);
        jazidaAnalytics.companies.forEach(row => rankingSheet.addRow([row.name, row.tickets, row.volume, row.complete, row.pending, percent(row.percentage)]));
        styleCorporateWorksheet(rankingSheet, { title: `Tickets por empresa - ${periodLabel}`, headerRow: 3, lastColumn: 6, recordCount: jazidaAnalytics.companies.length });
      }

      const detailSheet = workbook.addWorksheet('DADOS DETALHADOS');
      detailSheet.addRow([]); detailSheet.addRow([]);
      if (mode === 'combustivel') {
        detailSheet.addRow(['Data', 'Hora', 'Prefixo', 'Equipamento', 'Empresa', 'Comboio', 'Combustível', 'Litros', 'Bomba inicial', 'Bomba final', 'Diferença', 'Status', 'Origem', 'Responsável', 'Pendências']);
        fuelAnalytics.details.forEach(row => detailSheet.addRow([
          formatDate(row.date), row.time, row.prefix, row.equipment, row.company, row.comboio, row.fuel, row.liters,
          row.pumpInitial, row.pumpFinal, Number(row.pumpDifference.toFixed(3)), row.status, row.origin, row.responsible, row.warnings.join(' | '),
        ]));
        styleCorporateWorksheet(detailSheet, { title: `Abastecimentos detalhados - ${periodLabel}`, headerRow: 3, lastColumn: 15, recordCount: fuelAnalytics.details.length });
      } else {
        detailSheet.addRow(['Data', 'Ticket', 'Criado em', 'Liberação', 'Retorno liberação', 'Recebimento', 'Retorno recebimento', 'Prefixo', 'Placa', 'Equipamento', 'Empresa', 'Material', 'Destino', 'Quantidade', 'Unidade', 'NF', 'Duplicidades', 'Pendências']);
        jazidaAnalytics.details.forEach(row => detailSheet.addRow([
          formatDate(row.date), row.number, formatDateTime(row.createdAt), row.releaseReturned ? 'Devolvida' : 'Pendente', formatDateTime(row.releaseReturnedAt),
          row.receiptReturned ? 'Devolvida' : 'Pendente', formatDateTime(row.receiptReturnedAt), row.prefix, row.plate, row.equipment,
          row.company, row.material, row.destination, row.volume, row.unit, row.invoice, row.duplicateCount, row.issues.join(' | '),
        ]));
        styleCorporateWorksheet(detailSheet, { title: `Tickets detalhados - ${periodLabel}`, headerRow: 3, lastColumn: 18, recordCount: jazidaAnalytics.details.length });
      }
      await downloadCorporateWorkbook(workbook, `RENEA_${mode.toUpperCase()}_${startDate || 'INICIO'}_${endDate || 'ATUAL'}.xlsx`);
    } catch (error) {
      console.error('Falha ao gerar a planilha analítica.', error);
      alert('Não foi possível gerar a planilha. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      try {
        const [reneaData, spmarData] = await Promise.all([imageAsDataUrl(reneaLogo), imageAsDataUrl(spmarLogo)]);
        doc.addImage(reneaData, 'PNG', 12, 8, 34, 15);
        doc.addImage(spmarData, 'PNG', 250, 9, 30, 13);
      } catch (error) {
        console.warn('PDF gerado sem as imagens de marca.', error);
      }
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(mode === 'combustivel' ? 'RELATÓRIO ANALÍTICO DE COMBUSTÍVEL' : 'RELATÓRIO ANALÍTICO DA JAZIDA', 148.5, 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`RENEA Infraestrutura • ${periodLabel} • emitido em ${new Date().toLocaleString('pt-BR')}`, 148.5, 20, { align: 'center' });

      const metrics = mode === 'combustivel'
        ? [
          ['Volume', `${number(fuelAnalytics.totalLiters, 2)} L`],
          ['Abastecimentos', number(fuelAnalytics.totalRecords)],
          ['Frotas', number(fuelAnalytics.activeFleets)],
          ['Média', `${number(fuelAnalytics.averageLiters, 2)} L`],
          ['Qualidade', percent(fuelAnalytics.qualityPercentage)],
          ['Conferir', number(fuelAnalytics.warningRecords)],
        ]
        : [
          ['Tickets', number(jazidaAnalytics.totalTickets)],
          ['Liberações', number(jazidaAnalytics.releaseReturned)],
          ['Recebimentos', number(jazidaAnalytics.receiptReturned)],
          ['Completos', number(jazidaAnalytics.completePairs)],
          ['Conferência', percent(jazidaAnalytics.conferencePercentage)],
          ['Pendentes', number(jazidaAnalytics.pendingAny)],
        ];
      autoTable(doc, {
        startY: 27,
        head: [metrics.map(item => item[0])],
        body: [metrics.map(item => item[1])],
        theme: 'grid',
        styles: { fontSize: 9, halign: 'center', cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        bodyStyles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: 'bold' },
        margin: { left: 12, right: 12 },
      });
      if (mode === 'combustivel') {
        autoTable(doc, {
          startY: 50,
          head: [['Data', 'Hora', 'Frota', 'Equipamento', 'Empresa', 'Comboio', 'Produto', 'Litros', 'Bombas', 'Status / conferência']],
          body: fuelAnalytics.details.map(row => [
            formatDate(row.date), row.time, row.prefix, row.equipment, row.company, row.comboio, row.fuel,
            number(row.liters, 2), `${number(row.pumpInitial, 2)} → ${number(row.pumpFinal, 2)}`,
            row.warnings.join(' | ') || 'OK',
          ]),
          theme: 'striped',
          styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak' },
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: { 3: { cellWidth: 33 }, 4: { cellWidth: 29 }, 5: { cellWidth: 24 }, 9: { cellWidth: 43 } },
          margin: { left: 8, right: 8 },
          didDrawPage: data => {
            doc.setFontSize(7); doc.setTextColor(100); doc.text(`Página ${data.pageNumber}`, 285, 202, { align: 'right' });
          },
        });
      } else {
        autoTable(doc, {
          startY: 50,
          head: [['Data', 'Ticket', 'Criação', 'Liberação', 'Recebimento', 'Frota / placa', 'Empresa', 'Material', 'Destino', 'Qtd.', 'NF', 'Qualidade']],
          body: jazidaAnalytics.details.map(row => [
            formatDate(row.date), row.number, formatDateTime(row.createdAt),
            row.releaseReturned ? formatDateTime(row.releaseReturnedAt) : 'PENDENTE',
            row.receiptReturned ? formatDateTime(row.receiptReturnedAt) : 'PENDENTE',
            `${row.prefix} / ${row.plate}`, row.company, row.material, row.destination,
            `${number(row.volume, 2)} ${row.unit}`, row.invoice, row.issues.join(' | ') || 'OK',
          ]),
          theme: 'striped',
          styles: { fontSize: 6.2, cellPadding: 1.35, overflow: 'linebreak' },
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: { 2: { cellWidth: 25 }, 3: { cellWidth: 27 }, 4: { cellWidth: 27 }, 8: { cellWidth: 27 }, 11: { cellWidth: 37 } },
          margin: { left: 7, right: 7 },
          didDrawPage: data => {
            doc.setFontSize(7); doc.setTextColor(100); doc.text(`Página ${data.pageNumber}`, 285, 202, { align: 'right' });
          },
        });
      }
      doc.save(`RENEA_${mode.toUpperCase()}_${startDate || 'INICIO'}_${endDate || 'ATUAL'}.pdf`);
    } catch (error) {
      console.error('Falha ao gerar o PDF analítico.', error);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const fuelKpis = [
    { label: 'Volume no período', value: `${number(fuelAnalytics.totalLiters, 2)} L`, detail: `${number(fuelAnalytics.totalRecords)} abastecimentos`, icon: Fuel, tone: 'emerald' as const },
    { label: 'Frotas abastecidas', value: number(fuelAnalytics.activeFleets), detail: `${number(fuelAnalytics.activeCompanies)} empresas`, icon: Truck, tone: 'sky' as const },
    { label: 'Média por lançamento', value: `${number(fuelAnalytics.averageLiters, 2)} L`, detail: fuelAnalytics.peakDay ? `Pico: ${formatDate(fuelAnalytics.peakDay.date)} • ${number(fuelAnalytics.peakDay.liters, 2)} L` : 'Sem movimentação', icon: Gauge, tone: 'violet' as const },
    { label: 'Qualidade cadastral', value: percent(fuelAnalytics.qualityPercentage), detail: `${number(fuelAnalytics.warningRecords)} registros para conferir`, icon: ShieldCheck, tone: fuelAnalytics.warningRecords ? 'amber' as const : 'emerald' as const },
    { label: 'Comparação anterior', value: fuelAnalytics.variationPercentage === null ? '—' : `${fuelAnalytics.variationPercentage >= 0 ? '+' : ''}${percent(fuelAnalytics.variationPercentage)}`, detail: `${number(fuelAnalytics.previousLiters, 2)} L no período anterior`, icon: BarChart3, tone: fuelAnalytics.variationPercentage !== null && fuelAnalytics.variationPercentage > 15 ? 'amber' as const : 'sky' as const },
  ];

  const jazidaKpis = [
    { label: 'Tickets controlados', value: number(jazidaAnalytics.totalTickets), detail: `${number(jazidaAnalytics.totalVolume, 2)} em quantidade informada`, icon: TicketCheck, tone: 'emerald' as const },
    { label: 'Liberações devolvidas', value: number(jazidaAnalytics.releaseReturned), detail: `${number(jazidaAnalytics.pendingRelease)} ainda pendentes`, icon: ClipboardCheck, tone: jazidaAnalytics.pendingRelease ? 'amber' as const : 'emerald' as const },
    { label: 'Recebimentos devolvidos', value: number(jazidaAnalytics.receiptReturned), detail: `${number(jazidaAnalytics.pendingReceipt)} ainda pendentes`, icon: CheckCircle2, tone: jazidaAnalytics.pendingReceipt ? 'sky' as const : 'emerald' as const },
    { label: 'Pares completos', value: number(jazidaAnalytics.completePairs), detail: `${number(jazidaAnalytics.pendingAny)} com alguma via faltante`, icon: ShieldCheck, tone: jazidaAnalytics.pendingAny ? 'amber' as const : 'emerald' as const },
    { label: 'Conferência das vias', value: percent(jazidaAnalytics.conferencePercentage), detail: `${number(jazidaAnalytics.duplicateTickets)} número(s) duplicado(s)`, icon: Gauge, tone: jazidaAnalytics.duplicateTickets ? 'rose' as const : 'violet' as const },
  ];

  const fuelInsights = [
    fuelAnalytics.fleets[0] ? `Maior consumo: ${fuelAnalytics.fleets[0].name}, com ${number(fuelAnalytics.fleets[0].liters, 2)} L (${percent(fuelAnalytics.fleets[0].percentage)} do período).` : 'Ainda não há consumo no período.',
    fuelAnalytics.companies[0] ? `Empresa com maior volume: ${fuelAnalytics.companies[0].name}, ${number(fuelAnalytics.companies[0].liters, 2)} L.` : 'Nenhuma empresa identificada no período.',
    fuelAnalytics.warningRecords ? `${fuelAnalytics.warningRecords} lançamento(s) pedem conferência: ${fuelAnalytics.unknownFleets} sem frota, ${fuelAnalytics.pumpDivergences} com diferença de bomba e ${fuelAnalytics.duplicateRecords} possível(is) duplicado(s).` : 'Todos os lançamentos filtrados passaram pelas verificações automáticas.',
    'A ordem das linhas não é usada para validar bombas: cada lançamento e comboio é conferido individualmente.',
  ];

  const jazidaInsights = [
    jazidaAnalytics.pendingAny ? `${jazidaAnalytics.pendingAny} ticket(s) ainda não fecharam o par das duas vias.` : 'Todos os tickets filtrados fecharam as duas vias.',
    jazidaAnalytics.companies[0] ? `${jazidaAnalytics.companies[0].name} concentra ${jazidaAnalytics.companies[0].tickets} ticket(s) no período.` : 'Nenhuma empresa identificada no período.',
    jazidaAnalytics.duplicateTickets ? `${jazidaAnalytics.duplicateTickets} número(s) têm repetição na mesma via e devem ser revisados.` : 'Nenhuma duplicidade por número, dia e via foi detectada.',
    jazidaAnalytics.incompleteRecords ? `${jazidaAnalytics.incompleteRecords} ticket(s) possuem cadastro incompleto ou uma via ainda não cadastrada.` : 'Os cadastros essenciais dos tickets estão completos.',
  ];
  const hasQualityAlert = mode === 'combustivel'
    ? fuelAnalytics.warningRecords > 0
    : jazidaAnalytics.pendingAny > 0 || jazidaAnalytics.duplicateTickets > 0;

  return (
    <section className="space-y-5 print:hidden" id="operational-reports-dashboard">
      <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 shadow-2xl shadow-emerald-950/20">
        <div className="flex flex-col gap-5 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-2xl border border-emerald-400/20 bg-slate-950/80 px-3 py-2.5 shadow-lg shadow-emerald-950/20"><img src={reneaDashboardLogo} alt="RENEA Infraestrutura" className="h-9 w-auto object-contain sm:h-10" /></div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-400">Central de conferência operacional</span>
              <h2 className="mt-1 text-xl font-black text-white">Dashboards de Combustível e Jazida</h2>
              <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-400">Análise diária, comparativos, qualidade cadastral, pendências e relatórios completos a partir da mesma base usada nos lançamentos.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportCsv} disabled={!totalRows || invalidPeriod} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black text-slate-300 transition hover:border-emerald-500 hover:text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" /> CSV</button>
            <button type="button" onClick={exportExcel} disabled={!totalRows || invalidPeriod || isExporting} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white transition hover:bg-emerald-500 disabled:opacity-40"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel completo</button>
            <button type="button" onClick={exportPdf} disabled={!totalRows || invalidPeriod || isExporting} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-black text-white transition hover:bg-slate-700 disabled:opacity-40"><Printer className="h-3.5 w-3.5" /> PDF com logo</button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/35 p-2">
          <button type="button" onClick={() => changeMode('combustivel')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${mode === 'combustivel' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}><Fuel className="h-4 w-4" /> Combustível</button>
          <button type="button" onClick={() => changeMode('jazida')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${mode === 'jazida' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}><TicketCheck className="h-4 w-4" /> Jazida</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {[
              ['today', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['month', 'Mês atual'], ['all', 'Todo o histórico'],
            ].map(([id, label]) => <button key={id} type="button" onClick={() => setPeriod(id as 'today' | '7' | '30' | 'month' | 'all')} className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300">{label}</button>)}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Data inicial</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" /></label>
            <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Data final</span><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" /></label>
            <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Empresa</span><select value={company} onChange={event => { setCompany(event.target.value); setEquipmentId(''); }} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"><option value="">Todas</option>{mode === 'combustivel' ? empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>) : jazidaOptions.companies.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            {mode === 'combustivel' ? <>
              <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Frota</span><select value={equipmentId} onChange={event => setEquipmentId(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"><option value="">Todas</option>{filteredEquipments.map(item => <option key={item.id} value={item.id}>{item.prefixo} — {item.nome}</option>)}</select></label>
              <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Comboio</span><select value={comboioId} onChange={event => setComboioId(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"><option value="">Todos</option>{comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Combustível</span><select value={fuelTypeId} onChange={event => setFuelTypeId(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"><option value="">Todos</option>{combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            </> : <>
              <label className="space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Material</span><select value={material} onChange={event => setMaterial(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"><option value="">Todos</option>{jazidaOptions.materials.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="space-y-1 lg:col-span-2"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Destino</span><select value={destination} onChange={event => setDestination(event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"><option value="">Todos</option>{jazidaOptions.destinations.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            </>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="relative flex-1 space-y-1"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Busca livre</span><Search className="absolute bottom-2.5 left-3 h-3.5 w-3.5 text-slate-600" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === 'combustivel' ? 'Prefixo, placa, equipamento, empresa, responsável...' : 'Ticket, prefixo, placa, equipamento, empresa, NF...'} className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-700 focus:border-emerald-500" /></label>
            <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-[10px] font-black text-slate-300 hover:border-emerald-500 hover:text-emerald-300"><FilterX className="h-3.5 w-3.5" /> Limpar filtros</button>
          </div>
          {invalidPeriod && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">A data inicial não pode ser posterior à data final.</div>}
        </div>
      </div>

      {!invalidPeriod && <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(mode === 'combustivel' ? fuelKpis : jazidaKpis).map(item => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              detail={item.detail}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-2">
            <PanelTitle title={mode === 'combustivel' ? 'Evolução diária do consumo' : 'Retorno diário das duas vias'} detail={mode === 'combustivel' ? 'Volume e quantidade de abastecimentos ao longo do período filtrado.' : 'Tickets criados, pares completos e pendências por dia de controle.'} />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {mode === 'combustivel' ? <AreaChart data={fuelAnalytics.daily} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="fuelArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="95%" stopColor="#10b981" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number) => [`${number(value, 2)} L`, 'Volume']} /><Area type="monotone" dataKey="liters" stroke="#10b981" strokeWidth={3} fill="url(#fuelArea)" />
                </AreaChart> : <BarChart data={jazidaAnalytics.daily} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={CHART_TOOLTIP} /><Bar dataKey="complete" name="Pares completos" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} /><Bar dataKey="pending" name="Com pendência" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <PanelTitle title="Leitura gerencial" detail="Conclusões automáticas para orientar a conferência diária." />
            <div className="space-y-3">
              {(mode === 'combustivel' ? fuelInsights : jazidaInsights).map((insight, index) => <div key={insight} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/55 p-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${index === 2 ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{index + 1}</span><p className="text-[10px] leading-relaxed text-slate-300">{insight}</p></div>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <PanelTitle title={mode === 'combustivel' ? 'Consumo por empresa' : 'Tickets por empresa'} detail="Participação das empresas no período selecionado." />
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mode === 'combustivel' ? fuelAnalytics.companies.slice(0, 7) : jazidaAnalytics.companies.slice(0, 7)} dataKey={mode === 'combustivel' ? 'liters' : 'tickets'} nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>{(mode === 'combustivel' ? fuelAnalytics.companies : jazidaAnalytics.companies).slice(0, 7).map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number) => [mode === 'combustivel' ? `${number(value, 2)} L` : `${number(value)} ticket(s)`, 'Total']} /></PieChart></ResponsiveContainer></div>
            <div className="space-y-2">{(mode === 'combustivel' ? fuelAnalytics.companies : jazidaAnalytics.companies).slice(0, 5).map((row, index) => <div key={row.name} className="flex items-center justify-between gap-3 text-[10px]"><span className="flex min-w-0 items-center gap-2 text-slate-400"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><b className="truncate text-slate-200">{row.name}</b></span><span className="shrink-0 font-mono font-black text-white">{'liters' in row ? `${number(row.liters, 2)} L` : `${number(row.tickets)} tickets`}</span></div>)}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <PanelTitle title={mode === 'combustivel' ? 'Ranking por frota' : 'Materiais movimentados'} detail={mode === 'combustivel' ? 'Equipamentos com maior volume abastecido.' : 'Distribuição dos tickets por tipo de material.'} />
            <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={(mode === 'combustivel' ? fuelAnalytics.fleets : jazidaAnalytics.materials).slice(0, 8)} margin={{ top: 0, right: 12, left: 10, bottom: 0 }}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis dataKey={mode === 'combustivel' ? 'name' : 'name'} type="category" width={86} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number) => [mode === 'combustivel' ? `${number(value, 2)} L` : `${number(value)} ticket(s)`, 'Total']} /><Bar dataKey={mode === 'combustivel' ? 'liters' : 'tickets'} fill="#10b981" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2 xl:col-span-1">
            <PanelTitle title={mode === 'combustivel' ? 'Distribuição por comboio' : 'Destinos mais utilizados'} detail={mode === 'combustivel' ? 'Volume por unidade de abastecimento, sem misturar a sequência das bombas.' : 'Frentes que mais receberam materiais no período.'} />
            <div className="space-y-3">{(mode === 'combustivel' ? fuelAnalytics.comboios : jazidaAnalytics.destinations).slice(0, 8).map((row, index) => {
              const maximum = mode === 'combustivel' ? fuelAnalytics.comboios[0]?.liters || 1 : jazidaAnalytics.destinations[0]?.tickets || 1;
              const value = 'liters' in row ? row.liters : row.tickets;
              return <div key={row.name} className="space-y-1.5"><div className="flex items-center justify-between gap-2 text-[10px]"><span className="truncate font-bold text-slate-300">{index + 1}. {row.name}</span><span className="shrink-0 font-mono font-black text-white">{mode === 'combustivel' ? `${number(value, 2)} L` : `${number(value)} tickets`}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-400" style={{ width: `${Math.max(3, (value / maximum) * 100)}%` }} /></div></div>;
            })}{(mode === 'combustivel' ? fuelAnalytics.comboios.length : jazidaAnalytics.destinations.length) === 0 && <p className="py-16 text-center text-xs italic text-slate-600">Sem dados para o período.</p>}</div>
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${hasQualityAlert ? 'border-amber-500/25 bg-amber-500/5' : 'border-emerald-500/25 bg-emerald-500/5'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-slate-950 p-2.5"><AlertTriangle className={`h-5 w-5 ${hasQualityAlert ? 'text-amber-300' : 'text-emerald-300'}`} /></span><div><h3 className="text-sm font-black text-white">Central de qualidade e pendências</h3><p className="mt-1 text-[10px] text-slate-400">Os dados permanecem salvos; este painel apenas destaca o que merece conferência.</p></div></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{mode === 'combustivel' ? <>
              {[['Sem frota', fuelAnalytics.unknownFleets], ['Diferença bomba', fuelAnalytics.pumpDivergences], ['Duplicidade', fuelAnalytics.duplicateRecords], ['Total conferir', fuelAnalytics.warningRecords]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-center"><b className="block font-mono text-lg text-white">{value}</b><span className="text-[8px] font-black uppercase tracking-wider text-slate-500">{label}</span></div>)}
            </> : <>
              {[['Falta liberação', jazidaAnalytics.pendingRelease], ['Falta recebimento', jazidaAnalytics.pendingReceipt], ['Duplicidades', jazidaAnalytics.duplicateTickets], ['Cadastro incompleto', jazidaAnalytics.incompleteRecords]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-center"><b className="block font-mono text-lg text-white">{value}</b><span className="text-[8px] font-black uppercase tracking-wider text-slate-500">{label}</span></div>)}
            </>}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">Dados detalhados para auditoria</h3><p className="mt-1 text-[10px] text-slate-500">Mostrando {number(visibleRows)} de {number(totalRows)} registro(s). Excel, PDF e CSV sempre exportam todos os resultados filtrados.</p></div><select value={rowLimit} onChange={event => setRowLimit(Number(event.target.value) as RowLimit)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-bold text-slate-300"><option value={50}>Exibir 50</option><option value={200}>Exibir 200</option><option value={0}>Exibir todos</option></select></div>
          <div className="max-h-[34rem] overflow-auto">
            {totalRows === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-8 text-center"><CalendarDays className="h-8 w-8 text-slate-700" /><p className="text-xs font-bold text-slate-500">Nenhum registro corresponde aos filtros selecionados.</p></div> : mode === 'combustivel' ? <table className="min-w-[1280px] w-full text-left text-[10px]"><thead className="sticky top-0 z-10 bg-slate-950 text-[8px] font-black uppercase tracking-wider text-slate-500"><tr><th className="p-3">Data/hora</th><th>Frota / equipamento</th><th>Empresa</th><th>Comboio</th><th>Produto</th><th className="text-right">Litros</th><th>Bombas</th><th>Responsável</th><th>Origem</th><th className="pr-3">Conferência</th></tr></thead><tbody className="divide-y divide-slate-800/70">{fuelAnalytics.details.slice(0, visibleRows).map((row: FuelDetailRow) => <tr key={row.id} className="text-slate-300 hover:bg-slate-800/40"><td className="p-3 font-mono"><b className="block text-white">{formatDate(row.date)}</b>{row.time}</td><td><b className="font-mono text-emerald-300">{row.prefix}</b><span className="ml-2 text-slate-500">{row.equipment}</span></td><td>{row.company}</td><td>{row.comboio}</td><td>{row.fuel}</td><td className="text-right font-mono font-black text-white">{number(row.liters, 2)} L</td><td className="font-mono text-slate-500">{number(row.pumpInitial, 2)} → {number(row.pumpFinal, 2)}</td><td>{row.responsible}</td><td>{row.origin}</td><td className="max-w-64 pr-3">{row.warnings.length ? <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-bold text-amber-300">{row.warnings.join(' • ')}</span> : <span className="inline-flex rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-bold text-emerald-300">Conferido</span>}</td></tr>)}</tbody></table> : <table className="min-w-[1420px] w-full text-left text-[10px]"><thead className="sticky top-0 z-10 bg-slate-950 text-[8px] font-black uppercase tracking-wider text-slate-500"><tr><th className="p-3">Data / ticket</th><th>Criação</th><th>Via liberação</th><th>Via recebimento</th><th>Frota / placa</th><th>Empresa</th><th>Material</th><th>Destino</th><th>Qtd.</th><th>NF</th><th className="pr-3">Conferência</th></tr></thead><tbody className="divide-y divide-slate-800/70">{jazidaAnalytics.details.slice(0, visibleRows).map((row: JazidaDetailRow) => <tr key={row.id} className="text-slate-300 hover:bg-slate-800/40"><td className="p-3"><b className="block text-white">{formatDate(row.date)}</b><span className="font-mono font-black text-emerald-300">#{row.number}</span></td><td className="text-slate-500">{formatDateTime(row.createdAt)}</td><td>{row.releaseReturned ? <span className="font-bold text-emerald-300">Devolvida<br /><small className="font-normal text-slate-500">{formatDateTime(row.releaseReturnedAt)}</small></span> : <span className="font-bold text-amber-300">Pendente</span>}</td><td>{row.receiptReturned ? <span className="font-bold text-sky-300">Devolvida<br /><small className="font-normal text-slate-500">{formatDateTime(row.receiptReturnedAt)}</small></span> : <span className="font-bold text-amber-300">Pendente</span>}</td><td><b className="font-mono text-white">{row.prefix}</b><span className="ml-2 text-slate-500">{row.plate}</span></td><td>{row.company}</td><td>{row.material}</td><td>{row.destination}</td><td className="font-mono font-black text-white">{number(row.volume, 2)} {row.unit}</td><td>{row.invoice}</td><td className="max-w-64 pr-3">{row.issues.length ? <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-bold text-amber-300">{row.issues.join(' • ')}</span> : <span className="inline-flex rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-bold text-emerald-300">Conferido</span>}</td></tr>)}</tbody></table>}
          </div>
        </div>
      </>}

      <div className="flex items-center gap-3 border-t border-slate-800 pt-5"><Building2 className="h-4 w-4 text-emerald-400" /><div><h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Relatórios administrativos adicionais</h3><p className="text-[10px] text-slate-600">Abaixo permanecem os modelos antigos de frota, lubrificação, presença e apontamentos.</p></div></div>
    </section>
  );
}

import { loadAutoTable } from './pdfLoader';
import type { jsPDF } from './pdfLoader';
import { gerarEmUmaFolha } from './pdfUmaFolha';

import reneaLogo from '../assets/images/renea_logo_new.png';
import spmarLogo from '../assets/images/spmar_logo.png';

export type UniversalPdfColumn = { header: string; dataKey: string; align?: 'left' | 'center' | 'right' };
type Cor = [number, number, number];
export type UniversalPdfReportOptions = {
  title: string;
  subtitle?: string;
  columns: UniversalPdfColumn[];
  rows: object[];
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  company?: string;
  work?: string;
  contract?: string;
  period?: string;
  issuedBy?: string;
  reportNumber?: string;
  filters?: string[];
  summary?: Array<{ label: string; value: string | number }>;
  /** Título em cima da tabela principal (quando há gráficos ou seções antes dela). */
  tableTitle?: string;
  /** Linha de total no fim da tabela principal. */
  totalRow?: object;
  /** Tabelas a mais depois da principal, cada uma com título (ex.: total por equipamento). */
  sections?: Array<{ title: string; note?: string; columns: UniversalPdfColumn[]; rows: object[]; totalRow?: object }>;
  /** Gráficos (PNG) lado a lado depois do resumo; a largura de cada um segue a proporção da imagem. */
  charts?: Array<{ title: string; dataUrl: string; width: number; height: number }>;
  /** Cor do texto de uma célula (ex.: atraso em vermelho). */
  cellColor?: (dataKey: string, value: string) => Cor | undefined;
};

const imageAsDataUrl = async (url: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();
    return await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return ''; }
};

const safeFileName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
const text = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);
const linha = (columns: UniversalPdfColumn[], row: object, total = false) => {
  const record = row as Record<string, unknown>;
  // Na linha de total, a coluna sem valor fica em branco em vez de travessão.
  return Object.fromEntries(columns.map(column => [column.dataKey, total && (record[column.dataKey] ?? '') === '' ? '' : text(record[column.dataKey])]));
};
const estilosDasColunas = (columns: UniversalPdfColumn[]) =>
  Object.fromEntries(columns.filter(column => column.align).map(column => [column.dataKey, { halign: column.align }]));
const ESTILO_TOTAL = { fillColor: [236, 253, 245] as [number, number, number], textColor: [15, 23, 42] as [number, number, number], fontStyle: 'bold' as const };

export async function generateUniversalPdfReport(options: UniversalPdfReportOptions) {
  const orientacao = options.orientation || (options.columns.length > 7 ? 'landscape' : 'portrait');
  const autoTable = await loadAutoTable();
  const margin = 12;
  const [logo, partnerLogo] = await Promise.all([imageAsDataUrl(reneaLogo), imageAsDataUrl(spmarLogo)]);
  const emittedAt = new Date();
  const emission = emittedAt.toLocaleString('pt-BR');
  const institutional = options.company || 'RENEA · Sistema Integrado de Gestão Operacional';
  const reportCode = options.reportNumber || `REN-${emittedAt.toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const headerHeight = 43;

  // Cabeçalho, filtros, resumo, gráficos e tabelas; devolve onde terminam.
  const desenhar = (doc: jsPDF) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const drawHeader = () => {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
      if (logo) {
        try { doc.addImage(logo, 'PNG', margin, 4, 46, 25, undefined, 'FAST'); } catch { /* text fallback below */ }
      }
      if (partnerLogo) { try { doc.addImage(partnerLogo, 'PNG', pageWidth - margin - 53, 5, 53, 11.5, undefined, 'FAST'); } catch { /* optional partner logo */ } }
      if (!logo) { doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(30, 41, 59); doc.text('RENEA', margin, 17); }
      const titleX = margin + 52;
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(institutional, titleX, 11);
      doc.setFontSize(14); doc.text(options.title.toUpperCase(), titleX, 18);
      if (options.subtitle) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.text(options.subtitle, titleX, 23); }
      doc.setDrawColor(16, 185, 129); doc.setLineWidth(.6); doc.line(margin, 27, pageWidth - margin, 27);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(71, 85, 105);
      doc.text(`Obra: ${options.work || 'Todas / não informada'}`, margin, 32);
      doc.text(`Contrato: ${options.contract || 'Não informado'}`, margin, 36.5);
      doc.text(`Período: ${options.period || 'Conforme filtros do relatório'}`, pageWidth / 2, 32);
      doc.text(`Emissão: ${emission}`, pageWidth / 2, 36.5);
      doc.text(`Responsável: ${options.issuedBy || 'Usuário autenticado RENEA'}`, pageWidth - margin, 32, { align: 'right' });
      doc.text(`Relatório: ${reportCode}`, pageWidth - margin, 36.5, { align: 'right' });
    };

    let startY = headerHeight + 3;
    if (options.filters?.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105);
      const filterLines = doc.splitTextToSize(`Filtros aplicados: ${options.filters.join(' · ')}`, pageWidth - margin * 2);
      doc.text(filterLines, margin, startY);
      startY += filterLines.length * 3.4 + 2;
    }
    if (options.summary?.length) {
      const gap = 2, available = pageWidth - margin * 2, width = (available - gap * (options.summary.length - 1)) / options.summary.length;
      options.summary.forEach((item, index) => {
        const x = margin + index * (width + gap);
        doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(x, startY, width, 12, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.2); doc.setTextColor(100, 116, 139); doc.text(item.label.toUpperCase(), x + 2, startY + 4);
        doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.text(text(item.value), x + 2, startY + 9.5);
      });
      startY += 16;
    }
    if (options.charts?.length) {
      const gap = 6;
      const available = pageWidth - margin * 2 - gap * (options.charts.length - 1);
      const maxHeight = 72;
      // Mesma altura para todos; a largura sai da proporção de cada imagem.
      const sumRatio = options.charts.reduce((total, chart) => total + chart.width / chart.height, 0);
      const height = Math.min(maxHeight, available / sumRatio);
      let x = margin;
      for (const chart of options.charts) {
        const width = height * (chart.width / chart.height);
        doc.setDrawColor(226, 232, 240); doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, startY, width, height + 9, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
        doc.text(chart.title, x + 3, startY + 5);
        try { doc.addImage(chart.dataUrl, 'PNG', x + 2, startY + 7.5, width - 4, height - 1, undefined, 'FAST'); } catch { /* gráfico opcional */ }
        x += width + gap;
      }
      startY += height + 14;
    }
    const colorir = (data: { section: string; column: { dataKey: string | number }; cell: { raw: unknown; styles: { textColor: unknown; fontStyle: string } } }) => {
      if (data.section !== 'body' || !options.cellColor) return;
      const cor = options.cellColor(String(data.column.dataKey), String(data.cell.raw ?? ''));
      if (cor) { data.cell.styles.textColor = cor; data.cell.styles.fontStyle = 'bold'; }
    };

    if (options.tableTitle) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.text(options.tableTitle, margin, startY + 2);
      startY += 5;
    }
    autoTable(doc, {
      startY,
      margin: { top: headerHeight + 3, right: margin, bottom: 14, left: margin },
      columns: options.columns,
      body: options.rows.map(row => linha(options.columns, row)),
      foot: options.totalRow ? [linha(options.columns, options.totalRow, true)] : undefined,
      showFoot: 'lastPage',
      footStyles: ESTILO_TOTAL,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: .15, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: estilosDasColunas(options.columns),
      didParseCell: colorir,
    });

    for (const secao of options.sections || []) {
      const anterior = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
      let y = anterior + 8;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.text(secao.title, margin, y);
      if (secao.note) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105); doc.text(secao.note, margin, y + 4); y += 4; }
      autoTable(doc, {
        startY: y + 2,
        margin: { top: headerHeight + 3, right: margin, bottom: 14, left: margin },
        columns: secao.columns,
        body: secao.rows.map(row => linha(secao.columns, row)),
        foot: secao.totalRow ? [linha(secao.columns, secao.totalRow, true)] : undefined,
        showFoot: 'lastPage',
        footStyles: ESTILO_TOTAL,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 6.8, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: .15, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: estilosDasColunas(secao.columns),
        didParseCell: colorir,
      });
    }

    drawHeader();
    return ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 14;
  };

  const doc = await gerarEmUmaFolha({ orientacao, compress: false, alargar: true }, desenhar, (folha, altura) => {
    const pageWidth = folha.internal.pageSize.getWidth();
    folha.setDrawColor(226, 232, 240); folha.line(margin, altura - 10, pageWidth - margin, altura - 10);
    folha.setFont('helvetica', 'normal'); folha.setFontSize(6); folha.setTextColor(100, 116, 139);
    folha.text('Documento oficial RENEA · Dados gerados a partir dos filtros e registros do sistema.', margin, altura - 6);
  });
  doc.save(options.fileName || `${safeFileName(options.title)}_${emittedAt.toISOString().slice(0, 10)}.pdf`);
  return { rows: options.rows.length, reportCode };
}

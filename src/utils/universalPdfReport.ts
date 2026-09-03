import type { jsPDF } from 'jspdf';
import { loadJsPdf, loadAutoTable } from './pdfLoader';

import reneaLogo from '../assets/images/renea_logo_new.png';
import spmarLogo from '../assets/images/spmar_logo.png';

export type UniversalPdfColumn = { header: string; dataKey: string };
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

export async function generateUniversalPdfReport(options: UniversalPdfReportOptions) {
  const doc = new (await loadJsPdf())({ orientation: options.orientation || (options.columns.length > 7 ? 'landscape' : 'portrait'), unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTable();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const [logo, partnerLogo] = await Promise.all([imageAsDataUrl(reneaLogo), imageAsDataUrl(spmarLogo)]);
  const emittedAt = new Date();
  const emission = emittedAt.toLocaleString('pt-BR');
  const institutional = options.company || 'RENEA · Sistema Integrado de Gestão Operacional';
  const reportCode = options.reportNumber || `REN-${emittedAt.toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const headerHeight = 43;

  const drawHeader = (page: number) => {
    doc.setPage(page);
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    if (logo) {
      try { doc.addImage(logo, 'PNG', -5, -9, 76, 42, undefined, 'FAST'); } catch { /* text fallback below */ }
    }
    if (partnerLogo) { try { doc.addImage(partnerLogo, 'PNG', pageWidth - margin - 53, 5, 53, 11.5, undefined, 'FAST'); } catch { /* optional partner logo */ } }
    if (!logo) { doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(30, 41, 59); doc.text('RENEA', margin, 17); }
    doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(institutional, margin + 42, 11);
    doc.setFontSize(14); doc.text(options.title.toUpperCase(), margin + 42, 18);
    if (options.subtitle) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.text(options.subtitle, margin + 42, 23); }
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

  autoTable(doc, {
    startY,
    margin: { top: headerHeight + 3, right: margin, bottom: 14, left: margin },
    columns: options.columns,
    body: options.rows.map(row => {
      const record = row as Record<string, unknown>;
      return Object.fromEntries(options.columns.map(column => [column.dataKey, text(record[column.dataKey])]));
    }),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: .15, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: data => { if (data.pageNumber > 1) drawHeader(data.pageNumber); },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    drawHeader(page);
    doc.setPage(page); doc.setDrawColor(226, 232, 240); doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 116, 139);
    doc.text('Documento oficial RENEA · Dados gerados a partir dos filtros e registros do sistema.', margin, pageHeight - 6);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }
  doc.save(options.fileName || `${safeFileName(options.title)}_${emittedAt.toISOString().slice(0, 10)}.pdf`);
  return { pages, rows: options.rows.length, reportCode };
}

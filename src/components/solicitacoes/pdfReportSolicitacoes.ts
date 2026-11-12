import type { jsPDF } from 'jspdf';
import { loadAutoTable, loadJsPdf } from '../../utils/pdfLoader';
import type { Solicitacao } from '../../utils/solicitacoes';
import { formatarDia, situacaoDe, situacaoDoItem } from '../../utils/solicitacoes';
import reneaLogoUrl from '../../assets/images/renea_logo_new.png';
import spmarLogoUrl from '../../assets/images/spmar_logo.png';
import { OBRA } from '../../config/obra';

type AutoTable = (doc: jsPDF, options: Record<string, unknown>) => void;

const loadImage = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch { return undefined; }
};

const text = (value: unknown) => String(value ?? '—');
const moeda = (value?: number) => value === undefined ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusColor = (status: string) => status === 'Em Atraso' ? '#B91C1C' : status === 'Entregue' ? '#15824B' : '#334155';

const header = (doc: jsPDF, logos: { renea?: string; spmar?: string }, titulo: string, subtitulo: string) => {
  if (logos.renea) doc.addImage(logos.renea, 'PNG', -5, -7, 43, 24, undefined, 'FAST');
  else { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor('#15824B'); doc.text('RENEA', 9, 13); }
  if (logos.spmar) doc.addImage(logos.spmar, 'PNG', 244, 6, 44, 9.5, undefined, 'FAST');
  doc.setFont('helvetica', 'bold'); doc.setTextColor('#10223A'); doc.setFontSize(13);
  doc.text(titulo.toUpperCase(), 148.5, 11, { align: 'center' });
  doc.setFontSize(8); doc.setTextColor('#086B3D'); doc.text(`${OBRA.nome} · ${subtitulo}`, 148.5, 17, { align: 'center' });
  doc.setDrawColor('#10223A'); doc.setLineWidth(0.45); doc.line(9, 23, 288, 23);
};

const footer = (doc: jsPDF) => {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setDrawColor('#15824B'); doc.setLineWidth(0.55); doc.line(9, 198, 288, 198);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor('#717980');
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${OBRA.nome}`, 9, 204);
    doc.text(`Página ${page} de ${pages}`, 288, 204, { align: 'right' });
  }
};

const metric = (doc: jsPDF, x: number, label: string, value: string | number, color: string) => {
  doc.setDrawColor('#C9CDD1'); doc.setFillColor('#FFFFFF'); doc.roundedRect(x, 28, 53.5, 18, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor('#10223A'); doc.text(label, x + 4, 34);
  doc.setFontSize(15); doc.setTextColor(color); doc.text(String(value), x + 4, 42);
};

export const gerarRelatorioSolicitacoesPdf = async (solicitacoes: readonly Solicitacao[], hoje: string) => {
  const [JsPdf, autoTableModule, logos] = await Promise.all([
    loadJsPdf(), loadAutoTable(), Promise.all([loadImage(reneaLogoUrl), loadImage(spmarLogoUrl)]),
  ]);
  const autoTable = autoTableModule as unknown as AutoTable;
  const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const atrasadas = solicitacoes.filter(sol => situacaoDe(sol, hoje) === 'Em Atraso').length;
  const entregues = solicitacoes.filter(sol => sol.etapa === 'Entregue').length;
  const itens = solicitacoes.reduce((total, sol) => total + sol.itens.length, 0);
  header(doc, { renea: logos[0], spmar: logos[1] }, 'Relatório de solicitações e suprimentos', `posição em ${formatarDia(hoje)}`);
  metric(doc, 9, 'PEDIDOS', solicitacoes.length, '#15824B');
  metric(doc, 64, 'ITENS', itens, '#10223A');
  metric(doc, 119, 'EM ATRASO', atrasadas, atrasadas ? '#B91C1C' : '#15824B');
  metric(doc, 174, 'ENTREGUES', entregues, '#15824B');
  metric(doc, 229, 'VALOR APROVADO', moeda(solicitacoes.reduce((total, sol) => total + (sol.valorTotal ?? 0), 0)), '#10223A');
  autoTable(doc, {
    startY: 51, margin: { top: 28, left: 9, right: 9, bottom: 16 },
    head: [['SOLICITAÇÃO', 'SOLICITANTE', 'FRENTE / LOCAL', 'ITEM', 'QTD.', 'UN.', 'PRAZO', 'SUPRIMENTOS', 'SITUAÇÃO']],
    body: solicitacoes.flatMap(sol => sol.itens.map(item => [
      sol.numero, sol.solicitante, sol.localDestino || sol.frente, item.descricao,
      String(item.quantidade).replace('.', ','), item.unidade, formatarDia(item.prazoDesejado),
      sol.comprador || sol.fornecedor || '—', situacaoDe(sol, hoje),
    ])),
    theme: 'grid', styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 1.4, lineColor: '#C9CDD1', textColor: '#242A30', valign: 'middle' },
    headStyles: { fillColor: '#082343', textColor: '#FFFFFF', fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: '#FAFAFA' }, showHead: 'everyPage', rowPageBreak: 'avoid',
    columnStyles: { 0: { cellWidth: 23, fontStyle: 'bold' }, 1: { cellWidth: 28 }, 2: { cellWidth: 42 }, 3: { cellWidth: 62 }, 4: { cellWidth: 14, halign: 'right' }, 5: { cellWidth: 12, halign: 'center' }, 6: { cellWidth: 22, halign: 'center' }, 7: { cellWidth: 35 }, 8: { cellWidth: 31, halign: 'center' } },
    didParseCell: (data: { section: string; column: { index: number }; cell: { raw: unknown; styles: Record<string, unknown> } }) => {
      if (data.section === 'body' && data.column.index === 8) { data.cell.styles.textColor = statusColor(String(data.cell.raw)); data.cell.styles.fontStyle = 'bold'; }
    },
    didDrawPage: (data: { pageNumber: number }) => { if (data.pageNumber > 1) header(doc, { renea: logos[0], spmar: logos[1] }, 'Relatório de solicitações e suprimentos', `posição em ${formatarDia(hoje)}`); },
  });
  doc.addPage('a4', 'landscape');
  header(doc, { renea: logos[0], spmar: logos[1] }, 'Conferência e histórico', `solicitações · ${formatarDia(hoje)}`);
  const linhas = solicitacoes.flatMap(sol => sol.itens.map(item => [sol.numero, item.descricao, `${item.quantidade} ${item.unidade}`, `${item.quantidadeRecebida ?? 0} ${item.unidade}`, situacaoDoItem(item), sol.notaFiscal || '—']));
  autoTable(doc, { startY: 29, margin: { top: 28, left: 9, right: 9, bottom: 16 }, head: [['PEDIDO', 'ITEM', 'SOLICITADO', 'RECEBIDO', 'CONFERÊNCIA', 'NF']], body: linhas.length ? linhas : [['—', 'Nenhum item para conferência.', '—', '—', '—', '—']], theme: 'grid', styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.6, lineColor: '#C9CDD1', textColor: '#242A30' }, headStyles: { fillColor: '#082343', textColor: '#FFFFFF', fontStyle: 'bold' }, alternateRowStyles: { fillColor: '#FAFAFA' }, showHead: 'everyPage', columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' }, 1: { cellWidth: 100 }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 38, halign: 'center' }, 5: { cellWidth: 38 } } });
  footer(doc);
  const fileName = `RELATORIO_SOLICITACOES_SUPRIMENTOS_${hoje}.pdf`;
  doc.save(fileName);
  return { fileName, pages: doc.getNumberOfPages(), rows: itens };
};

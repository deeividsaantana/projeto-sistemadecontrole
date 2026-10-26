/**
 * Arquivos que saem de Viagens da jazida: a conferência do dia (PDF, CSV e
 * Excel) e a planilha de tickets no modelo da SABESP. Só leem os dados.
 */
import { createCorporateWorkbook, downloadCorporateWorkbook } from '../../utils/excelCorporate';
import { buildTicketSpreadsheetWorkbook } from '../../utils/ticketSpreadsheetExport';
import type { JazidaDailyControl } from '../../utils/jazidaDailyControl';
import { loadJsPdf } from '../../utils/pdfLoader';
import { isoDay } from '../../shared/ui/PeriodFilter';
import type { TicketJazida } from '../../types';
import reneaLogoFull from '../../assets/images/renea_logo_new.png';
import spmarLogo from '../../assets/images/spmar_logo.png';
import { formatEventDateTime } from './constantes';

type ConferenciaDoDia = JazidaDailyControl;

export const exportTicketControlExcel = async (dailyControl: ConferenciaDoDia, controlDate: string) => {
  const wb = await createCorporateWorkbook();
  const summary = wb.addWorksheet('RESUMO DO DIA');
  summary.addRow(['CONFERÊNCIA DIÁRIA DE TICKETS - JAZIDA']);
  summary.addRow(['Data', controlDate.split('-').reverse().join('/')]);
  summary.addRow(['Números criados / impressos', dailyControl.totalCriados]);
  summary.addRow(['Vias de liberação devolvidas', dailyControl.liberacoesRecebidas]);
  summary.addRow(['Vias de recebimento devolvidas', dailyControl.recebimentosRecebidos]);
  summary.addRow(['Tickets completos (duas vias)', dailyControl.paresCompletos]);
  summary.addRow(['Pendentes de liberação', dailyControl.pendentesLiberacao.join(', ') || 'Nenhum']);
  summary.addRow(['Pendentes de recebimento', dailyControl.pendentesRecebimento.join(', ') || 'Nenhum']);
  summary.getColumn(1).width = 34;
  summary.getColumn(2).width = 70;
  summary.getRow(1).font = { bold: true, size: 14 };

  const ws = wb.addWorksheet('CHECKLIST DAS VIAS');
  ws.addRow(['Ticket Nº', 'Criado / impresso em', 'Liberação', 'Devolução liberação', 'Recebimento', 'Devolução recebimento', 'Prefixo', 'Placa', 'Nota fiscal', 'Data NF', 'Observações da NF']);
  dailyControl.rows.forEach(row => {
    const ticket = row.liberacao || row.recebimento;
    ws.addRow([
      row.numero,
      formatEventDateTime(row.criadoEm),
      row.liberacaoRecebida ? 'DEVOLVIDA' : 'PENDENTE',
      formatEventDateTime(row.liberacaoRecebidaEm),
      row.recebimentoRecebido ? 'DEVOLVIDA' : 'PENDENTE',
      formatEventDateTime(row.recebimentoRecebidoEm),
      ticket?.prefixo || '',
      ticket?.placa || '',
      row.recebimento?.notaFiscalNumero || row.liberacao?.notaFiscalNumero || '',
      row.recebimento?.notaFiscalData || row.liberacao?.notaFiscalData || '',
      row.recebimento?.notaFiscalObservacao || row.liberacao?.notaFiscalObservacao || '',
    ]);
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'K1' };
  ws.columns.forEach((column, index) => { column.width = index === 10 ? 38 : index < 6 ? 23 : 16; });
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008D4C' } };
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `conferencia_jazida_${controlDate}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
};

export const exportTicketControlPdf = async (dailyControl: ConferenciaDoDia, controlDate: string) => {
  const doc = new (await loadJsPdf())('l', 'mm', 'a4');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(`Conferência diária da Jazida - ${controlDate.split('-').reverse().join('/')}`, 12, 14);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Criados: ${dailyControl.totalCriados} | Liberações: ${dailyControl.liberacoesRecebidas} | Recebimentos: ${dailyControl.recebimentosRecebidos} | Completos: ${dailyControl.paresCompletos} | Progresso: ${dailyControl.percentualConferencia}%`, 12, 21);
  doc.text(`Faltam liberações: ${dailyControl.pendentesLiberacao.join(', ') || 'nenhuma'}`, 12, 27, { maxWidth: 275 });
  doc.text(`Faltam recebimentos: ${dailyControl.pendentesRecebimento.join(', ') || 'nenhum'}`, 12, 33, { maxWidth: 275 });
  const headers = ['Ticket', 'Criação', 'Liberação', 'Hora devolução', 'Recebimento', 'Hora devolução', 'Prefixo', 'Placa', 'NF'];
  const xs = [12, 35, 82, 111, 156, 190, 235, 253, 273];
  headers.forEach((header, index) => { doc.setFont('helvetica', 'bold'); doc.text(header, xs[index], 43); });
  let y = 50;
  dailyControl.rows.forEach(row => {
    if (y > 194) { doc.addPage(); y = 18; }
    const ticket = row.liberacao || row.recebimento;
    const values = [
      row.numero,
      formatEventDateTime(row.criadoEm),
      row.liberacaoRecebida ? 'OK' : 'PENDENTE',
      formatEventDateTime(row.liberacaoRecebidaEm),
      row.recebimentoRecebido ? 'OK' : 'PENDENTE',
      formatEventDateTime(row.recebimentoRecebidoEm),
      ticket?.prefixo || '-',
      ticket?.placa || '-',
      row.recebimento?.notaFiscalNumero || row.liberacao?.notaFiscalNumero || '-',
    ];
    values.forEach((value, index) => { doc.setFont('helvetica', 'normal'); doc.text(String(value), xs[index], y, { maxWidth: index === 1 || index === 3 || index === 5 ? 42 : 20 }); });
    y += 8;
  });
  doc.save(`conferencia_jazida_${controlDate}.pdf`);
};

export const exportTicketControlCsv = (dailyControl: ConferenciaDoDia, controlDate: string) => {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Ticket Nº', 'Criado / impresso em', 'Liberação', 'Devolução liberação', 'Recebimento', 'Devolução recebimento', 'Prefixo', 'Placa', 'Nota fiscal', 'Data NF', 'Observações da NF'],
    ...dailyControl.rows.map(row => {
      const ticket = row.liberacao || row.recebimento;
      return [row.numero, formatEventDateTime(row.criadoEm), row.liberacaoRecebida ? 'DEVOLVIDA' : 'PENDENTE', formatEventDateTime(row.liberacaoRecebidaEm), row.recebimentoRecebido ? 'DEVOLVIDA' : 'PENDENTE', formatEventDateTime(row.recebimentoRecebidoEm), ticket?.prefixo || '', ticket?.placa || '', row.recebimento?.notaFiscalNumero || row.liberacao?.notaFiscalNumero || '', row.recebimento?.notaFiscalData || row.liberacao?.notaFiscalData || '', row.recebimento?.notaFiscalObservacao || row.liberacao?.notaFiscalObservacao || ''];
    }),
  ];
  const blob = new Blob([`\uFEFF${rows.map(row => row.map(escape).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `conferencia_jazida_${controlDate}.csv`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/** Planilha "Controle de viagens" com as abas de liberação e recebimento já filtradas. */
export const exportarPlanilhaDeTickets = async (
  liberacoes: TicketJazida[],
  recebimentos: TicketJazida[],
  duplicateKeys: ReadonlySet<string>,
  filtrado: boolean,
) => {
  const [reneaLogoBase64, spmarLogoBase64] = await Promise.all([
    getBase64ImageFromUrl(reneaLogoFull),
    getBase64ImageFromUrl(spmarLogo),
  ]);
  const wb = await buildTicketSpreadsheetWorkbook({
    liberacoes,
    recebimentos,
    duplicateKeys,
    reneaLogoBase64,
    spmarLogoBase64,
  });
  const sufixo = filtrado ? '_filtrado' : '';
  await downloadCorporateWorkbook(wb, `CONTROLE DE VIAGEMS JAZIDA SABESP${sufixo}_${isoDay(new Date())}.xlsx`);
};

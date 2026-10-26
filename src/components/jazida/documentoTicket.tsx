/**
 * Documento do ticket da jazida: a folha A4 com as duas vias (liberação em
 * cima, recebimento embaixo, linha de corte no meio). A prévia na tela e o PDF
 * desenham o mesmo papel. As medidas seguem o papel impresso, por isso as
 * cores e tamanhos daqui não seguem o padrão das telas.
 */
import React from 'react';
import type { jsPDF } from 'jspdf';
import { loadJsPdf } from '../../utils/pdfLoader';
import type { TicketJazida } from '../../types';
import reneaLogoFull from '../../assets/images/renea_logo_new.png';
import { OBRA } from '../../config/obra';

const TicketSingleDocument = ({ ticket }: { ticket: TicketJazida }) => {
  const isReceipt = (ticket.tipoTicket || 'Liberação') === 'Recebimento';
  const blankPrint = ticket.impressaoEmBranco === true;
  const material = blankPrint ? '' : ticket.tipoMaterial === 'Outros' ? ticket.materialOutro || 'Outros' : ticket.tipoMaterial;
  const destination = blankPrint ? '' : ticket.destinoObra === 'Outros' ? ticket.destinoOutro || 'Outros' : ticket.destinoObra;
  const materials = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Outros'];
  const field = (label: string, value: React.ReactNode, className = '') => (
    <div className={`min-h-14 border-r border-b border-[#cfd7d1] p-2 ${className}`}>
      <div className="text-xs font-bold uppercase text-[#53605a]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-950">{value || (blankPrint ? '' : '—')}</div>
    </div>
  );

  return (
    <div className="aspect-[1.414/1] min-w-[760px] w-full overflow-hidden border border-[#cfd7d1] bg-white text-slate-950">
      <div className="grid grid-cols-[1fr_1.6fr_.55fr] border-l border-t border-[#cfd7d1]">
        <div className="h-24 border-r border-b border-[#cfd7d1] p-3 flex items-center">
          <img src={reneaLogoFull} alt="RENEA" className="max-h-14 max-w-44 object-contain" />
        </div>
        <div className="h-24 border-r border-b border-[#cfd7d1] grid place-items-center text-center px-3">
          <div><h2 className="text-base font-bold uppercase">Ticket de {isReceipt ? 'Recebimento - Obra' : 'Liberação - Jazida'}</h2><p className="mt-1 text-xs text-[#53605a]">{OBRA.nome}</p></div>
        </div>
        <div className="h-24 border-r border-b border-[#cfd7d1] p-2">
          <div className="text-xs font-bold uppercase text-[#53605a]">Ticket Nº</div>
          <div className="mt-3 border-b border-[#cfd7d1] pb-1 text-center text-2xl font-bold">{ticket.ocultarNumeroImpressao ? '' : ticket.ticketNumero}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-l border-[#cfd7d1]">
        {field('Prefixo', blankPrint ? '' : ticket.prefixo)}
        {field('Placa', blankPrint ? '' : ticket.placa)}
        {field('Data', blankPrint ? '' : ticket.data.split('-').reverse().join('/'))}
        {field(isReceipt ? 'Hora de chegada' : 'Hora de saída', blankPrint ? '' : isReceipt ? ticket.horaChegada || ticket.horaSaida : ticket.horaSaida)}
      </div>

      <div className="border-l border-r border-b border-[#cfd7d1] p-3 min-h-20">
        <div className="text-xs font-bold uppercase text-[#53605a]">Tipo de material</div>
        <div className="mt-4 grid grid-cols-6 gap-3">
          {materials.map(option => <div key={option} className="flex items-center gap-2 text-xs"><span className={`h-4 w-4 border border-[#d7ded9] grid place-items-center font-bold ${!blankPrint && (material === option || (option === 'Outros' && ticket.tipoMaterial === 'Outros')) ? 'bg-white text-[#14231e]' : ''}`}>{!blankPrint && (material === option || (option === 'Outros' && ticket.tipoMaterial === 'Outros')) ? 'X' : ''}</span>{option}</div>)}
        </div>
        {!blankPrint && ticket.tipoMaterial === 'Outros' && <div className="mt-2 text-xs">Especificação: <strong>{material}</strong></div>}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_.8fr] border-l border-[#cfd7d1]">
        {field('Quantidade', blankPrint ? '' : `${ticket.quantidadeM3} ${ticket.unidadeQuantidade || 'm³'}`)}
        {field(isReceipt ? 'Ramo de descarga' : 'Destino / obra', destination)}
        {field('Estaca', blankPrint ? '' : ticket.estaca || '—')}
      </div>

      <div className="border-l border-r border-b border-[#cfd7d1] p-3 min-h-16">
        <div className="text-xs font-bold uppercase text-[#53605a]">Carga conforme?</div>
        <div className="mt-3 flex gap-12 text-xs"><span className="flex items-center gap-2"><i className={`not-italic h-4 w-4 border border-[#d7ded9] grid place-items-center font-bold ${!blankPrint && ticket.cargaConforme === true ? 'bg-white text-[#14231e]' : ''}`}>{!blankPrint && ticket.cargaConforme === true ? 'X' : ''}</i>Sim</span><span className="flex items-center gap-2"><i className={`not-italic h-4 w-4 border border-[#d7ded9] grid place-items-center font-bold ${!blankPrint && ticket.cargaConforme === false ? 'bg-white text-[#14231e]' : ''}`}>{!blankPrint && ticket.cargaConforme === false ? 'X' : ''}</i>Não</span></div>
      </div>

      <div className="border-l border-r border-b border-[#cfd7d1] p-3 min-h-24">
        <div className="text-xs font-bold uppercase text-[#53605a]">Divergências / observações</div>
        <p className="mt-3 text-xs leading-relaxed">{blankPrint ? '' : ticket.observacao || 'Sem observações.'}</p>
      </div>

      <div className="grid grid-cols-2 border-l border-[#cfd7d1]">
        <div className="min-h-28 border-r border-b border-[#cfd7d1] p-3">
          <div className="text-xs font-bold uppercase text-[#53605a]">Assinatura - {isReceipt ? 'Recebedor' : 'Responsável pela liberação'}</div>
          {!blankPrint && ticket.assinaturaDigital && <img src={ticket.assinaturaDigital} alt="Assinatura digital" className="mx-auto h-14 max-w-[80%] object-contain" />}
          <div className="mt-1 border-t border-[#cfd7d1] pt-1 text-center text-xs">{blankPrint ? '' : ticket.nomeLegivel || ticket.responsavelLiberacao || 'Nome legível'}</div>
        </div>
        <div className="min-h-28 border-r border-b border-[#cfd7d1] p-3 flex flex-col justify-end">
          <div className="border-t border-[#cfd7d1] pt-1 text-center text-xs">Assinatura - Conferente da obra / Nome legível</div>
        </div>
      </div>
      <div className="border-x border-b border-[#cfd7d1] py-1 text-center text-xs uppercase text-[#65716b]">Via de {ticket.tipoTicket || 'Liberação'} | Documento digital RENEA</div>
    </div>
  );
};

export const TicketDocumentPreview = ({ releaseTicket, receiptTicket }: { releaseTicket: TicketJazida; receiptTicket: TicketJazida }) => (
  <div className="aspect-[210/297] min-w-[760px] w-full overflow-hidden bg-white p-3 shadow-lg" id="ticket-print-preview">
    <div className="flex h-full flex-col justify-between">
      <TicketSingleDocument ticket={releaseTicket} />
      <div className="relative border-t border-dashed border-[#cfd7d1]"><span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs uppercase text-[#65716b]">Linha de corte</span></div>
      <TicketSingleDocument ticket={receiptTicket} />
    </div>
  </div>
);

const loadTicketLogo = async () => {
  try {
    const response = await fetch(reneaLogoFull);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { /* o título textual mantém o documento utilizável */ }
  return '';
};

const drawTicketPairOnPdf = (doc: jsPDF, releaseTicket: TicketJazida, receiptTicket: TicketJazida, logo: string) => {
  const drawCopy = (ticket: TicketJazida, top: number, copyLabel: string) => {
    const isReceipt = (ticket.tipoTicket || 'Liberação') === 'Recebimento';
    const blankPrint = ticket.impressaoEmBranco === true;
    const material = blankPrint ? '' : ticket.tipoMaterial === 'Outros' ? ticket.materialOutro || 'Outros' : ticket.tipoMaterial;
    const destination = blankPrint ? '' : ticket.destinoObra === 'Outros' ? ticket.destinoOutro || 'Outros' : ticket.destinoObra;
    const left = 8;
    const width = 194;
    const line = (x1: number, y1: number, x2: number, y2: number) => doc.line(x1, y1, x2, y2);
    const label = (text: string, x: number, y: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(71, 85, 105); doc.text(text.toUpperCase(), x, y); };
    const value = (text: string, x: number, y: number, maxWidth?: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(15, 23, 42); doc.text(String(text || (blankPrint ? '' : '—')), x, y, maxWidth ? { maxWidth } : undefined); };
    const box = (x: number, y: number, checked: boolean) => { doc.rect(x, y, 4, 4); if (checked) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('X', x + 0.8, y + 3.3); } };

    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.25);
    doc.rect(left, top, width, 134);
    line(left, top + 20, left + width, top + 20);
    line(left + 55, top, left + 55, top + 20);
    line(left + 165, top, left + 165, top + 20);
    if (logo) doc.addImage(logo, 'PNG', left + 10, top + 1, 32.2, 18);
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('RENEA', left + 5, top + 13); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(`TICKET DE ${isReceipt ? 'RECEBIMENTO - OBRA' : 'LIBERAÇÃO - JAZIDA'}`, left + 60, top + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.text(OBRA.nome, left + 60, top + 13);
    label('Ticket Nº', left + 169, top + 5); doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(ticket.ocultarNumeroImpressao ? '' : ticket.ticketNumero, left + 179.5, top + 14, { align: 'center' });

    const vehicleTop = top + 20;
    [0, 48, 96, 142, 194].forEach(offset => line(left + offset, vehicleTop, left + offset, vehicleTop + 14));
    [['Prefixo', blankPrint ? '' : ticket.prefixo], ['Placa', blankPrint ? '' : ticket.placa], ['Data', blankPrint ? '' : ticket.data.split('-').reverse().join('/')], [isReceipt ? 'Hora de chegada' : 'Hora de saída', blankPrint ? '' : isReceipt ? ticket.horaChegada || ticket.horaSaida : ticket.horaSaida]].forEach(([name, content], index) => { const x = left + [3, 51, 99, 145][index]; label(name, x, vehicleTop + 4); value(content, x, vehicleTop + 10); });
    line(left, vehicleTop + 14, left + width, vehicleTop + 14);

    const materialTop = vehicleTop + 14;
    label('Tipo de material', left + 3, materialTop + 4);
    ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Outros'].forEach((option, index) => { const x = left + 5 + index * 31; box(x, materialTop + 8, !blankPrint && (material === option || (option === 'Outros' && ticket.tipoMaterial === 'Outros'))); value(option, x + 6, materialTop + 11.5); });
    line(left, materialTop + 18, left + width, materialTop + 18);

    const detailTop = materialTop + 18;
    line(left + 55, detailTop, left + 55, detailTop + 14); line(left + 145, detailTop, left + 145, detailTop + 14);
    label('Quantidade (m³ / caçamba)', left + 3, detailTop + 4); value(blankPrint || ticket.quantidadeM3 <= 0 ? '' : `${ticket.quantidadeM3} ${ticket.unidadeQuantidade || 'm³'}`, left + 3, detailTop + 10);
    label(isReceipt ? 'Ramo de descarga' : 'Destino / obra', left + 58, detailTop + 4); value(destination, left + 58, detailTop + 10, 82);
    label('Estaca', left + 148, detailTop + 4); value(blankPrint ? '' : ticket.estaca || '—', left + 148, detailTop + 10);
    line(left, detailTop + 14, left + width, detailTop + 14);

    const conformTop = detailTop + 14;
    label('Carga conforme?', left + 3, conformTop + 4); box(left + 78, conformTop + 5, !blankPrint && ticket.cargaConforme === true); value('SIM', left + 84, conformTop + 8.5); box(left + 110, conformTop + 5, !blankPrint && ticket.cargaConforme === false); value('NÃO', left + 116, conformTop + 8.5);
    line(left, conformTop + 14, left + width, conformTop + 14);

    const obsTop = conformTop + 14;
    label('Divergências / observações', left + 3, obsTop + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(blankPrint ? '' : ticket.observacao || '', width - 8).slice(0, 4), left + 3, obsTop + 10);
    line(left, obsTop + 29, left + width, obsTop + 29);

    const signatureTop = obsTop + 29;
    line(left + width / 2, signatureTop, left + width / 2, signatureTop + 22);
    label(`Assinatura - ${isReceipt ? 'Recebedor' : 'Responsável pela liberação'}`, left + 3, signatureTop + 4);
    if (!blankPrint && ticket.assinaturaDigital) { try { doc.addImage(ticket.assinaturaDigital, 'PNG', left + 8, signatureTop + 4, 70, 11); } catch { /* assinatura inválida não interrompe */ } }
    line(left + 4, signatureTop + 16, left + width / 2 - 4, signatureTop + 16); value(blankPrint ? '' : ticket.nomeLegivel || ticket.responsavelLiberacao || 'Nome legível', left + 4, signatureTop + 20);
    label('Assinatura - Conferente / Fiscal', left + width / 2 + 3, signatureTop + 4); line(left + width / 2 + 4, signatureTop + 16, left + width - 4, signatureTop + 16); value('Nome legível', left + width / 2 + 4, signatureTop + 20);
    line(left, signatureTop + 22, left + width, signatureTop + 22);
    doc.setFontSize(5); doc.setTextColor(100, 116, 139); doc.text(`VIA DE ${copyLabel} | DOCUMENTO DIGITAL RENEA`, left + width / 2, signatureTop + 25, { align: 'center' });
  };

  drawCopy(releaseTicket, 7, 'LIBERAÇÃO');
  doc.setLineDashPattern([2, 2], 0); doc.line(8, 148.5, 202, 148.5); doc.setLineDashPattern([], 0);
  doc.setFontSize(5); doc.setTextColor(100, 116, 139); doc.text('LINHA DE CORTE', 105, 147.5, { align: 'center' });
  drawCopy(receiptTicket, 156, 'RECEBIMENTO');
};

export const generatePairedTicketPdf = async (releaseTicket: TicketJazida, receiptTicket: TicketJazida) => {
  const doc = new (await loadJsPdf())('p', 'mm', 'a4');
  const logo = await loadTicketLogo();
  drawTicketPairOnPdf(doc, releaseTicket, receiptTicket, logo);
  doc.save(`ticket_liberacao_recebimento_${releaseTicket.ticketNumero}.pdf`);
};

export const generateTicketBookPdf = async (
  pairs: Array<{ releaseTicket: TicketJazida; receiptTicket: TicketJazida }>,
  fileName: string
) => {
  const doc = new (await loadJsPdf())('p', 'mm', 'a4');
  const logo = await loadTicketLogo();
  pairs.forEach((pair, index) => {
    if (index > 0) doc.addPage();
    drawTicketPairOnPdf(doc, pair.releaseTicket, pair.receiptTicket, logo);
  });
  doc.save(fileName);
};

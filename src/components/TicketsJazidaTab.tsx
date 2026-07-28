/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Truck,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  FileSpreadsheet,
  FilterX,
  Printer,
  Eye,
  MapPin,
  Upload,
  CopyPlus,
  Link2,
  ClipboardCheck,
  Clock3,
  CheckCircle2,
  FilePenLine,
  SlidersHorizontal,
  ChevronDown,
  CalendarDays
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { addCorporateSummarySheet, configureCorporateWorkbook, downloadCorporateWorkbook, loadValidatedWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import { jsPDF } from 'jspdf';
import { TicketJazida, TipoMaterialJazida, DestinoObraJazida, EmpresaTicketJazida, TipoTicketJazida } from '../types';
import reneaLogoFull from '../assets/images/renea_logo_new.png';

interface TicketsJazidaTabProps {
  tickets: TicketJazida[];
  onSaveTicket: (item: TicketJazida, isNew: boolean) => void;
  onDeleteTicket: (id: string) => void;
  onImportTickets: (items: TicketJazida[]) => void;
  onReserveTicketNumber: () => Promise<string>;
  onReserveTicketNumbers: (count: number) => Promise<string[]>;
}

const TIPOS_MATERIAL: TipoMaterialJazida[] = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Argila', 'Mataco', 'Solo mole', 'Outros'];
const DESTINOS_OBRA: DestinoObraJazida[] = [
  'Marginal', 'Ramo 200', 'Ramo 300', 'Ramo 500', 'Ramo 600', 'Ramo 800', 'Ramo 900', 'Ramo 1000',
  'Ramo 2000', 'Agulha', 'Ramo 200 Alargamento', 'Ramo 500 Marginal', 'Ramo 600 Ferradura',
  'Rua Padre Eustáquio', 'Padre Eustáquio', 'SP066 Ibar', 'Canteiro da Marginal',
  'Ferradura', 'Coluna de Brita', 'Apoio', 'Jazida', 'Outros'
];
const EMPRESAS_TICKET: EmpresaTicketJazida[] = ['RENEA', 'Terceiro', 'Outros'];

type PrintedTicketBatch = {
  id: string;
  inicio: number;
  fim: number;
  criadoEm: string;
  numeros?: string[];
  modo?: 'Em branco' | 'Pré-preenchido';
};

const TICKET_PREFIX = '100';
const normalizeTicketNumber = (value: string | number) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith(TICKET_PREFIX) ? digits : `${TICKET_PREFIX}${digits}`;
};
const baseTicketNumber = (value: string | number) => {
  const normalized = normalizeTicketNumber(value);
  return normalized.startsWith(TICKET_PREFIX) ? Number(normalized.slice(TICKET_PREFIX.length)) : Number(normalized);
};


const TicketSingleDocument = ({ ticket }: { ticket: TicketJazida }) => {
  const isReceipt = (ticket.tipoTicket || 'Liberação') === 'Recebimento';
  const blankPrint = ticket.impressaoEmBranco === true;
  const material = blankPrint ? '' : ticket.tipoMaterial === 'Outros' ? ticket.materialOutro || 'Outros' : ticket.tipoMaterial;
  const destination = blankPrint ? '' : ticket.destinoObra === 'Outros' ? ticket.destinoOutro || 'Outros' : ticket.destinoObra;
  const materials = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Outros'];
  const field = (label: string, value: React.ReactNode, className = '') => (
    <div className={`min-h-14 border-r border-b border-slate-500 p-2 ${className}`}>
      <div className="text-[9px] font-bold uppercase text-slate-600">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-950">{value || (blankPrint ? '' : '—')}</div>
    </div>
  );

  return (
    <div className="aspect-[1.414/1] min-w-[760px] w-full overflow-hidden border border-slate-500 bg-white text-slate-950">
      <div className="grid grid-cols-[1fr_1.6fr_.55fr] border-l border-t border-slate-500">
        <div className="h-24 border-r border-b border-slate-500 p-3 flex items-center">
          <img src={reneaLogoFull} alt="RENEA" className="max-h-14 max-w-44 object-contain" />
        </div>
        <div className="h-24 border-r border-b border-slate-500 grid place-items-center text-center px-3">
          <div><h2 className="text-base font-bold uppercase">Ticket de {isReceipt ? 'Recebimento - Obra' : 'Liberação - Jazida'}</h2><p className="mt-1 text-[10px] text-slate-600">Complexo Alto Tietê</p></div>
        </div>
        <div className="h-24 border-r border-b border-slate-500 p-2">
          <div className="text-[9px] font-bold uppercase text-slate-600">Ticket Nº</div>
          <div className="mt-3 border-b border-slate-500 pb-1 text-center text-2xl font-bold">{ticket.ocultarNumeroImpressao ? '' : ticket.ticketNumero}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-l border-slate-500">
        {field('Prefixo', blankPrint ? '' : ticket.prefixo)}
        {field('Placa', blankPrint ? '' : ticket.placa)}
        {field('Data', blankPrint ? '' : ticket.data.split('-').reverse().join('/'))}
        {field(isReceipt ? 'Hora de chegada' : 'Hora de saída', blankPrint ? '' : isReceipt ? ticket.horaChegada || ticket.horaSaida : ticket.horaSaida)}
      </div>

      <div className="border-l border-r border-b border-slate-500 p-3 min-h-20">
        <div className="text-[9px] font-bold uppercase text-slate-600">Tipo de material</div>
        <div className="mt-4 grid grid-cols-6 gap-3">
          {materials.map(option => <div key={option} className="flex items-center gap-2 text-xs"><span className={`h-4 w-4 border border-slate-600 grid place-items-center font-bold ${!blankPrint && (material === option || (option === 'Outros' && ticket.tipoMaterial === 'Outros')) ? 'bg-slate-900 text-white' : ''}`}>{!blankPrint && (material === option || (option === 'Outros' && ticket.tipoMaterial === 'Outros')) ? 'X' : ''}</span>{option}</div>)}
        </div>
        {!blankPrint && ticket.tipoMaterial === 'Outros' && <div className="mt-2 text-xs">Especificação: <strong>{material}</strong></div>}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_.8fr] border-l border-slate-500">
        {field('Quantidade', blankPrint ? '' : `${ticket.quantidadeM3} ${ticket.unidadeQuantidade || 'm³'}`)}
        {field(isReceipt ? 'Ramo de descarga' : 'Destino / obra', destination)}
        {field('Estaca', blankPrint ? '' : ticket.estaca || '—')}
      </div>

      <div className="border-l border-r border-b border-slate-500 p-3 min-h-16">
        <div className="text-[9px] font-bold uppercase text-slate-600">Carga conforme?</div>
        <div className="mt-3 flex gap-12 text-xs"><span className="flex items-center gap-2"><i className={`not-italic h-4 w-4 border border-slate-600 grid place-items-center font-bold ${!blankPrint && ticket.cargaConforme === true ? 'bg-slate-900 text-white' : ''}`}>{!blankPrint && ticket.cargaConforme === true ? 'X' : ''}</i>Sim</span><span className="flex items-center gap-2"><i className={`not-italic h-4 w-4 border border-slate-600 grid place-items-center font-bold ${!blankPrint && ticket.cargaConforme === false ? 'bg-slate-900 text-white' : ''}`}>{!blankPrint && ticket.cargaConforme === false ? 'X' : ''}</i>Não</span></div>
      </div>

      <div className="border-l border-r border-b border-slate-500 p-3 min-h-24">
        <div className="text-[9px] font-bold uppercase text-slate-600">Divergências / observações</div>
        <p className="mt-3 text-xs leading-relaxed">{blankPrint ? '' : ticket.observacao || 'Sem observações.'}</p>
      </div>

      <div className="grid grid-cols-2 border-l border-slate-500">
        <div className="min-h-28 border-r border-b border-slate-500 p-3">
          <div className="text-[9px] font-bold uppercase text-slate-600">Assinatura - {isReceipt ? 'Recebedor' : 'Responsável pela liberação'}</div>
          {!blankPrint && ticket.assinaturaDigital && <img src={ticket.assinaturaDigital} alt="Assinatura digital" className="mx-auto h-14 max-w-[80%] object-contain" />}
          <div className="mt-1 border-t border-slate-500 pt-1 text-center text-[10px]">{blankPrint ? '' : ticket.nomeLegivel || ticket.responsavelLiberacao || 'Nome legível'}</div>
        </div>
        <div className="min-h-28 border-r border-b border-slate-500 p-3 flex flex-col justify-end">
          <div className="border-t border-slate-500 pt-1 text-center text-[10px]">Assinatura - Conferente da obra / Nome legível</div>
        </div>
      </div>
      <div className="border-x border-b border-slate-500 py-1 text-center text-[7px] uppercase text-slate-500">Via de {ticket.tipoTicket || 'Liberação'} | Documento digital RENEA</div>
    </div>
  );
};

const TicketDocumentPreview = ({ releaseTicket, receiptTicket }: { releaseTicket: TicketJazida; receiptTicket: TicketJazida }) => (
  <div className="aspect-[210/297] min-w-[760px] w-full overflow-hidden bg-white p-3 shadow-lg" id="ticket-print-preview">
    <div className="flex h-full flex-col justify-between">
      <TicketSingleDocument ticket={releaseTicket} />
      <div className="relative border-t border-dashed border-slate-500"><span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[7px] uppercase text-slate-500">Linha de corte</span></div>
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
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.text('Complexo Alto Tietê', left + 60, top + 13);
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

const generatePairedTicketPdf = async (releaseTicket: TicketJazida, receiptTicket: TicketJazida) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const logo = await loadTicketLogo();
  drawTicketPairOnPdf(doc, releaseTicket, receiptTicket, logo);
  doc.save(`ticket_liberacao_recebimento_${releaseTicket.ticketNumero}.pdf`);
};

const generateTicketBookPdf = async (
  pairs: Array<{ releaseTicket: TicketJazida; receiptTicket: TicketJazida }>,
  fileName: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const logo = await loadTicketLogo();
  pairs.forEach((pair, index) => {
    if (index > 0) doc.addPage();
    drawTicketPairOnPdf(doc, pair.releaseTicket, pair.receiptTicket, logo);
  });
  doc.save(fileName);
};

export default function TicketsJazidaTab({ tickets, onSaveTicket, onDeleteTicket, onImportTickets, onReserveTicketNumber, onReserveTicketNumbers }: TicketsJazidaTabProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [viewingTicket, setViewingTicket] = useState<TicketJazida | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; items: TicketJazida[]; ignored: number } | null>(null);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [ticketTab, setTicketTab] = useState<TipoTicketJazida>('Liberação');
  const [linkMessage, setLinkMessage] = useState('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [batchStartNumber, setBatchStartNumber] = useState('');
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [batchNumberMode, setBatchNumberMode] = useState<'automatico' | 'manual'>('manual');
  const [batchDirection, setBatchDirection] = useState<'crescente' | 'decrescente'>('crescente');
  const [batchFillMode, setBatchFillMode] = useState<'em-branco' | 'pre-preenchido'>('em-branco');
  const [batchSaveDrafts, setBatchSaveDrafts] = useState(true);
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchPrefixo, setBatchPrefixo] = useState('');
  const [batchPlaca, setBatchPlaca] = useState('');
  const [batchTipoMaterial, setBatchTipoMaterial] = useState<TipoMaterialJazida>('Solo');
  const [batchQuantidadeM3, setBatchQuantidadeM3] = useState<number>(1);
  const [batchDestinoObra, setBatchDestinoObra] = useState<DestinoObraJazida>('Marginal');
  const [batchEmpresa, setBatchEmpresa] = useState<EmpresaTicketJazida>('RENEA');
  const [printedBatches, setPrintedBatches] = useState<PrintedTicketBatch[]>(() => {
    try {
      const saved = localStorage.getItem('renea_jazida_printed_batches') || localStorage.getItem('jazidaPrintedTicketBatches') || '[]';
      return JSON.parse(saved);
    } catch { return []; }
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [tipoTicket, setTipoTicket] = useState<TipoTicketJazida>('Liberação');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [ticketNumero, setTicketNumero] = useState('');
  const [prefixo, setPrefixo] = useState('');
  const [placa, setPlaca] = useState('');
  const [familiaEquipamento, setFamiliaEquipamento] = useState('');
  const [equipamentoNome, setEquipamentoNome] = useState('');
  const [horaChegada, setHoraChegada] = useState('08:00');
  const [horaSaida, setHoraSaida] = useState('08:00');
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterialJazida>('Solo');
  const [quantidadeM3, setQuantidadeM3] = useState<number>(1);
  const [destinoObra, setDestinoObra] = useState<DestinoObraJazida>('Marginal');
  const [destinoOutro, setDestinoOutro] = useState('');
  const [responsavelLiberacao, setResponsavelLiberacao] = useState('');
  const [nomeLegivel, setNomeLegivel] = useState('');
  const [empresa, setEmpresa] = useState<EmpresaTicketJazida>('RENEA');
  const [estaca, setEstaca] = useState('');
  const [observacao, setObservacao] = useState('');

  // Filters
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fDataInicial, setFDataInicial] = useState('');
  const [fDataFinal, setFDataFinal] = useState('');
  const [fTicketNumero, setFTicketNumero] = useState('');
  const [fPrefixo, setFPrefixo] = useState('');
  const [fPlaca, setFPlaca] = useState('');
  const [fTipoMaterial, setFTipoMaterial] = useState('');
  const [fDestinoObra, setFDestinoObra] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fStatus, setFStatus] = useState('');

  const resetFormFields = () => {
    setEditingId(null);
    setValidationError('');
    setTipoTicket(ticketTab);
    setData(new Date().toISOString().split('T')[0]);
    setTicketNumero('');
    setPrefixo('');
    setPlaca('');
    setFamiliaEquipamento('');
    setEquipamentoNome('');
    const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
    setHoraChegada(nowTime);
    setHoraSaida(nowTime);
    setTipoMaterial('Solo');
    setQuantidadeM3(1);
    setDestinoObra('Marginal');
    setDestinoOutro('');
    setResponsavelLiberacao('');
    setNomeLegivel('');
    setEmpresa('RENEA');
    setEstaca('');
    setObservacao('');
  };

  const handleOpenCreate = () => {
    resetFormFields();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (t: TicketJazida) => {
    setEditingId(t.id);
    setValidationError('');
    setTipoTicket(t.tipoTicket || 'Liberação');
    setData(t.data);
    setTicketNumero(t.ticketNumero);
    setPrefixo(t.prefixo);
    setPlaca(t.placa);
    setFamiliaEquipamento(t.familiaEquipamento || '');
    setEquipamentoNome(t.equipamentoNome || '');
    setHoraChegada(t.horaChegada || t.horaSaida);
    setHoraSaida(t.horaSaida);
    setTipoMaterial(t.tipoMaterial);
    setQuantidadeM3(t.quantidadeM3);
    setDestinoObra(t.destinoObra);
    setDestinoOutro(t.destinoOutro || '');
    setResponsavelLiberacao(t.responsavelLiberacao);
    setNomeLegivel(t.nomeLegivel);
    setEmpresa(t.empresa);
    setEstaca(t.estaca || '');
    setObservacao(t.observacao);
    setIsFormOpen(true);
  };

  const findLiberacaoByTicketNumero = (numero: string) => tickets.find(t =>
    (t.tipoTicket || 'Liberação') === 'Liberação' &&
    normalizeTicketNumber(t.ticketNumero) === normalizeTicketNumber(numero)
  );

  const applyLiberacaoCloneToForm = (numero: string, force = false) => {
    const liberacao = findLiberacaoByTicketNumero(numero);
    if (!liberacao) return false;

    if (force || !prefixo.trim()) setPrefixo(liberacao.prefixo);
    if (force || !placa.trim()) setPlaca(liberacao.placa);
    if (force || !familiaEquipamento.trim()) setFamiliaEquipamento(liberacao.familiaEquipamento || '');
    if (force || !equipamentoNome.trim()) setEquipamentoNome(liberacao.equipamentoNome || '');
    if (force || quantidadeM3 <= 1) setQuantidadeM3(liberacao.quantidadeM3 || 1);
    if (force || tipoMaterial === 'Solo') setTipoMaterial(liberacao.tipoMaterial);
    if (force || empresa === 'RENEA') setEmpresa(liberacao.empresa);
    return true;
  };

  const handleCloneRecebimentoFromLiberacao = (liberacao: TicketJazida) => {
    const alreadyExists = tickets.some(t =>
      (t.tipoTicket || 'Liberação') === 'Recebimento' &&
      normalizeTicketNumber(t.ticketNumero) === normalizeTicketNumber(liberacao.ticketNumero)
    );
    if (alreadyExists) {
      setTicketTab('Recebimento');
      setImportMessage('');
      setValidationError(`Já existe um recebimento para o Ticket Nº ${liberacao.ticketNumero}.`);
      return;
    }

    const now = new Date().toISOString();
    const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
    onSaveTicket({
      ...liberacao,
      id: `ticket-recebimento-${Date.now()}`,
      tipoTicket: 'Recebimento',
      horaChegada: nowTime,
      horaSaida: liberacao.horaSaida || '',
      estaca: '',
      observacao: `Recebimento gerado a partir da liberação Nº ${liberacao.ticketNumero}.`,
      status: 'OK',
      statusFluxo: 'Rascunho',
      origemRegistro: 'Admin',
      criadoEm: now,
      atualizadoEm: now,
    }, true);
    setTicketTab('Recebimento');
    setValidationError('');
    setImportMessage(`Recebimento do Ticket Nº ${liberacao.ticketNumero} gerado com CB ${liberacao.prefixo} e placa ${liberacao.placa} clonados.`);
  };

  const limparFiltros = () => {
    setSearchQuery(''); setFDataInicial(''); setFDataFinal(''); setFTicketNumero('');
    setFPrefixo(''); setFPlaca(''); setFTipoMaterial(''); setFDestinoObra(''); setFEmpresa(''); setFStatus('');
  };

  const hasFiltrosAtivos = !!(searchQuery || fDataInicial || fDataFinal || fTicketNumero || fPrefixo || fPlaca || fTipoMaterial || fDestinoObra || fEmpresa || fStatus);
  const activeFilterCount = [searchQuery, fDataInicial, fDataFinal, fTicketNumero, fPrefixo, fPlaca, fTipoMaterial, fDestinoObra, fEmpresa, fStatus].filter(Boolean).length;

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyPeriod = (days?: number) => {
    if (!days) {
      setFDataInicial('');
      setFDataFinal('');
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setFDataInicial(formatLocalDate(start));
    setFDataFinal(formatLocalDate(end));
  };

  const isPeriodActive = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return fDataInicial === formatLocalDate(start) && fDataFinal === formatLocalDate(end);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!ticketNumero.trim()) { setValidationError('Informe o Nº do Ticket.'); return; }
    if (!data) { setValidationError('Informe a Data.'); return; }
    if (!prefixo.trim()) { setValidationError('Informe o Prefixo.'); return; }
    if (!placa.trim()) { setValidationError('Informe a Placa.'); return; }
    if (tipoTicket === 'Recebimento' && !horaChegada) { setValidationError('Informe a Hora de Chegada.'); return; }
    if (tipoTicket === 'Liberação' && !horaSaida) { setValidationError('Informe a Hora de Saída.'); return; }
    if (!tipoMaterial) { setValidationError('Selecione o Tipo de Material.'); return; }
    if (!quantidadeM3 || quantidadeM3 <= 0) { setValidationError('Quantidade (m³) deve ser maior que zero.'); return; }
    if (destinoObra === 'Outros' && !destinoOutro.trim()) { setValidationError('Informe o destino ou ramo de descarga.'); return; }

    const normalizedTicketNumber = normalizeTicketNumber(ticketNumero);
    if (!normalizedTicketNumber) { setValidationError('Informe uma numeração válida para o ticket.'); return; }

    const duplicado = tickets.some(t =>
      normalizeTicketNumber(t.ticketNumero) === normalizedTicketNumber &&
      (t.tipoTicket || 'Liberação') === tipoTicket &&
      t.id !== editingId
    );
    if (duplicado) { setValidationError('Já existe um ticket com esse número nesta aba. O Ticket Nº não pode se repetir no mesmo tipo.'); return; }

    const isNew = editingId === null;
    const now = new Date().toISOString();
    const existing = !isNew ? tickets.find(t => t.id === editingId) : undefined;

    onSaveTicket({
      ...(existing || {}),
      id: isNew ? `ticket-${Date.now()}` : editingId!,
      data,
      tipoTicket,
      ticketNumero: normalizedTicketNumber,
      prefixo: prefixo.trim(),
      placa: placa.trim().toUpperCase(),
      familiaEquipamento: familiaEquipamento.trim(),
      equipamentoNome: equipamentoNome.trim(),
      horaChegada: tipoTicket === 'Recebimento' ? horaChegada : existing?.horaChegada,
      horaSaida: tipoTicket === 'Liberação' ? horaSaida : (horaChegada || horaSaida),
      tipoMaterial,
      quantidadeM3: Number(quantidadeM3),
      destinoObra,
      destinoOutro: destinoOutro.trim(),
      estaca: estaca.trim(),
      responsavelLiberacao: responsavelLiberacao.trim(),
      nomeLegivel: nomeLegivel.trim(),
      empresa,
      observacao: observacao.trim(),
      status: 'OK',
      statusFluxo: existing?.statusFluxo || 'Enviado',
      unidadeQuantidade: existing?.unidadeQuantidade || 'm³',
      origemRegistro: existing?.origemRegistro || 'Admin',
      enviadoEm: existing?.enviadoEm || (isNew ? now : undefined),
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    }, isNew);

    setIsFormOpen(false);
    resetFormFields();
  };

  const q = searchQuery.toLowerCase().trim();

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const tipo = t.tipoTicket || 'Liberação';
      if (tipo !== ticketTab) return false;
      const flowStatus = t.statusFluxo || 'Enviado';
      const qualityStatus = t.status || 'OK';
      if (fDataInicial && t.data < fDataInicial) return false;
      if (fDataFinal && t.data > fDataFinal) return false;
      if (fTicketNumero && !t.ticketNumero.toLowerCase().includes(fTicketNumero.toLowerCase())) return false;
      if (fPrefixo && !t.prefixo.toLowerCase().includes(fPrefixo.toLowerCase())) return false;
      if (fPlaca && !t.placa.toLowerCase().includes(fPlaca.toLowerCase())) return false;
      if (fTipoMaterial && t.tipoMaterial !== fTipoMaterial) return false;
      if (fDestinoObra && t.destinoObra !== fDestinoObra) return false;
      if (fEmpresa && t.empresa !== fEmpresa) return false;
      if (fStatus && !([flowStatus, qualityStatus].includes(fStatus))) return false;

      if (q) {
        const haystack = [
          t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
          t.tipoMaterial, t.destinoObra, t.destinoOutro, t.estaca, t.empresa, t.responsavelLiberacao,
          t.nomeLegivel, t.observacao, t.data
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data) || (b.horaChegada || b.horaSaida).localeCompare(a.horaChegada || a.horaSaida));
  }, [tickets, ticketTab, fDataInicial, fDataFinal, fTicketNumero, fPrefixo, fPlaca, fTipoMaterial, fDestinoObra, fEmpresa, fStatus, q]);

  const resumo = useMemo(() => {
    const totalTickets = filteredTickets.length;
    const totalM3 = filteredTickets
      .filter(ticket => (ticket.unidadeQuantidade || 'm³') === 'm³')
      .reduce((sum, ticket) => sum + (Number(ticket.quantidadeM3) || 0), 0);
    const totalCacambas = filteredTickets
      .filter(ticket => ticket.unidadeQuantidade === 'caçamba')
      .reduce((sum, ticket) => sum + (Number(ticket.quantidadeM3) || 0), 0);
    const okCount = filteredTickets.filter(t => (t.status || 'OK') === 'OK').length;
    const pendCount = filteredTickets.filter(t => (t.status || 'OK') === 'Pendente').length;
    const dupCount = filteredTickets.filter(t => (t.status || 'OK') === 'Duplicado').length;
    return { totalTickets, totalM3, totalCacambas, okCount, pendCount, dupCount };
  }, [filteredTickets]);

  const flowDashboard = useMemo(() => {
    const grouped = new Map<string, { numero: string; liberacao?: TicketJazida; recebimento?: TicketJazida }>();
    [...tickets]
      .sort((a, b) => String(a.atualizadoEm || a.criadoEm || '').localeCompare(String(b.atualizadoEm || b.criadoEm || '')))
      .forEach(ticket => {
        const pair: { numero: string; liberacao?: TicketJazida; recebimento?: TicketJazida } =
          grouped.get(ticket.ticketNumero) || { numero: ticket.ticketNumero };
        if ((ticket.tipoTicket || 'Liberação') === 'Liberação') pair.liberacao = ticket;
        else pair.recebimento = ticket;
        grouped.set(ticket.ticketNumero, pair);
      });
    const pairs = Array.from(grouped.values()).sort((a, b) => Number(b.numero) - Number(a.numero));
    const drafts = tickets.filter(ticket => ticket.statusFluxo === 'Rascunho').length;
    const pending = pairs.filter(pair => pair.liberacao?.statusFluxo !== 'Rascunho'
      && pair.liberacao && (!pair.recebimento || pair.recebimento.statusFluxo === 'Rascunho')).length;
    const completed = pairs.filter(pair => pair.liberacao && pair.recebimento
      && pair.liberacao.statusFluxo !== 'Rascunho'
      && pair.recebimento.statusFluxo !== 'Rascunho').length;
    return { pairs, drafts, pending, completed };
  }, [tickets]);


  const formatSequentialNumber = (start: string, offset: number) => {
    const base = baseTicketNumber(start);
    if (!Number.isFinite(base)) return '';
    return normalizeTicketNumber(base + offset);
  };

  const buildBatchTicket = (number: string, type: TipoTicketJazida, batchId: string): TicketJazida => {
    const now = new Date().toISOString();
    const blank = batchFillMode === 'em-branco';
    return {
      id: `ticket-lote-${type === 'Liberação' ? 'lib' : 'rec'}-${number}-${Date.now()}`,
      data: blank ? '' : batchDate,
      tipoTicket: type,
      ticketNumero: number,
      prefixo: blank ? '' : batchPrefixo.trim().toUpperCase(),
      placa: blank ? '' : batchPlaca.trim().toUpperCase(),
      familiaEquipamento: '',
      equipamentoNome: '',
      horaSaida: '',
      horaChegada: '',
      tipoMaterial: blank ? '' as TipoMaterialJazida : batchTipoMaterial,
      quantidadeM3: blank ? 0 : Number(batchQuantidadeM3) || 0,
      destinoObra: blank ? '' as DestinoObraJazida : batchDestinoObra,
      destinoOutro: '',
      responsavelLiberacao: '',
      nomeLegivel: '',
      empresa: blank ? '' as EmpresaTicketJazida : batchEmpresa,
      estaca: '',
      observacao: '',
      unidadeQuantidade: 'm³',
      status: 'Pendente',
      statusFluxo: 'Rascunho',
      origemRegistro: 'Admin',
      criadoEm: now,
      atualizadoEm: now,
      impressaoEmBranco: blank,
      ocultarNumeroImpressao: false,
      loteImpressaoId: batchId,
      loteImpressaoCriadoEm: now,
    };
  };

  const openBatchModal = () => {
    setBatchStartNumber('');
    setBatchQuantity(10);
    setBatchNumberMode('manual');
    setBatchDirection('crescente');
    setBatchFillMode('em-branco');
    setBatchSaveDrafts(true);
    setBatchDate(new Date().toISOString().split('T')[0]);
    setBatchPrefixo('');
    setBatchPlaca('');
    setBatchTipoMaterial('Solo');
    setBatchQuantidadeM3(1);
    setBatchDestinoObra('Marginal');
    setBatchEmpresa('RENEA');
    setValidationError('');
    setImportMessage('');
    setIsBatchModalOpen(true);
  };

  const handleGenerateBatchTickets = async () => {
    setValidationError('');
    setImportMessage('');
    const quantity = Math.max(1, Math.min(200, Math.floor(Number(batchQuantity) || 0)));
    if (batchNumberMode === 'manual' && !batchStartNumber.trim()) {
      setValidationError('Informe o primeiro número da sequência.');
      return;
    }
    if (batchFillMode === 'pre-preenchido' && !batchDate) {
      setValidationError('Informe a data dos tickets.');
      return;
    }

    setIsBatchPrinting(true);
    try {
      const reserved = batchNumberMode === 'automatico'
        ? await onReserveTicketNumbers(quantity)
        : Array.from({ length: quantity }, (_, index) => formatSequentialNumber(
            batchStartNumber,
            batchDirection === 'crescente' ? index : -index,
          ));
      const numbers = reserved.filter(Boolean);
      if (numbers.length !== quantity) throw new Error('Faixa de numeração inválida.');
      const batchId = `lote-${Date.now()}`;
      const pairs = numbers.map(number => ({
        releaseTicket: buildBatchTicket(number, 'Liberação', batchId),
        receiptTicket: buildBatchTicket(number, 'Recebimento', batchId),
      }));
      const fileMode = batchFillMode === 'em-branco' ? 'em_branco' : 'pre_preenchidos';
      await generateTicketBookPdf(pairs, `tickets_${fileMode}_${numbers[0]}_${numbers[numbers.length - 1]}.pdf`);

      if (batchSaveDrafts) {
        const existingKeys = new Set(tickets.map(ticket =>
          `${normalizeTicketNumber(ticket.ticketNumero)}|${ticket.tipoTicket || 'Liberação'}`
        ));
        const drafts = pairs
        .flatMap(pair => [pair.releaseTicket, pair.receiptTicket])
        .filter(ticket => !existingKeys.has(`${ticket.ticketNumero}|${ticket.tipoTicket || 'Liberação'}`));
        if (drafts.length > 0) onImportTickets(drafts);
      }

      const bases = numbers.map(baseTicketNumber).filter(Number.isFinite);
      const novoLote: PrintedTicketBatch = {
        id: batchId,
        inicio: Math.min(...bases),
        fim: Math.max(...bases),
        numeros: numbers,
        modo: batchFillMode === 'em-branco' ? 'Em branco' : 'Pré-preenchido',
        criadoEm: new Date().toISOString(),
      };
      setPrintedBatches(prev => {
        const next = [novoLote, ...prev];
        localStorage.setItem('renea_jazida_printed_batches', JSON.stringify(next));
        return next;
      });
      setImportMessage(`${numbers.length} número(s) impressos em duas vias${batchSaveDrafts ? ' e salvos como rascunhos editáveis' : ''}.`);
      setIsBatchModalOpen(false);
    } catch (err) {
      console.error('Erro ao gerar tickets sequenciais:', err);
      setValidationError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF da sequência.');
    } finally {
      setIsBatchPrinting(false);
    }
  };

  // Índice calculado uma única vez por alteração da lista. Antes, cada número de cada
  // lote percorria todos os tickets duas vezes, o que deixava a tela muito pesada.
  const ticketCompletionIndex = useMemo(() => {
    const index = new Map<number, { liberacao: boolean; recebimento: boolean }>();
    tickets.forEach(ticket => {
      const numero = baseTicketNumber(ticket.ticketNumero);
      if (!Number.isFinite(numero)) return;
      const status = index.get(numero) || { liberacao: false, recebimento: false };
      if ((ticket.tipoTicket || 'Liberação') === 'Liberação') status.liberacao = true;
      else status.recebimento = true;
      index.set(numero, status);
    });
    return index;
  }, [tickets]);

  const ticketControlRows = useMemo(() => printedBatches.map(batch => {
    const total = Math.max(0, batch.fim - batch.inicio + 1);
    let liberacoes = 0;
    let recebimentos = 0;
    let completas = 0;

    for (let numero = batch.inicio; numero <= batch.fim; numero += 1) {
      const status = ticketCompletionIndex.get(numero);
      if (!status) continue;
      if (status.liberacao) liberacoes += 1;
      if (status.recebimento) recebimentos += 1;
      if (status.liberacao && status.recebimento) completas += 1;
    }

    return { ...batch, total, liberacoes, recebimentos, completas, pendentes: total - completas };
  }), [printedBatches, ticketCompletionIndex]);

  const ticketControlTotals = useMemo(() => ticketControlRows.reduce((totals, row) => ({
    total: totals.total + row.total,
    liberacoes: totals.liberacoes + row.liberacoes,
    recebimentos: totals.recebimentos + row.recebimentos,
    completas: totals.completas + row.completas,
    pendentes: totals.pendentes + row.pendentes,
  }), { total: 0, liberacoes: 0, recebimentos: 0, completas: 0, pendentes: 0 }), [ticketControlRows]);

  const exportTicketControlExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Controle de tickets');
    ws.addRow(['Data da impressão', 'Numeração inicial', 'Numeração final', 'Tickets enviados', 'Liberações preenchidas', 'Recebimentos preenchidos', 'Viagens completas', 'Pendentes']);
    ticketControlRows.forEach(r => ws.addRow([new Date(r.criadoEm).toLocaleString('pt-BR'), normalizeTicketNumber(r.inicio), normalizeTicketNumber(r.fim), r.total, r.liberacoes, r.recebimentos, r.completas, r.pendentes]));
    ws.columns.forEach(c => { c.width = 24; });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'controle_tickets_jazida.xlsx'; a.click(); URL.revokeObjectURL(a.href);
  };

  const exportTicketControlPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Controle de tickets enviados para preenchimento', 12, 15);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    const headers = ['Impressão', 'Inicial', 'Final', 'Enviados', 'Lib.', 'Rec.', 'Viagens completas', 'Pendentes'];
    const xs = [12, 58, 88, 118, 150, 172, 194, 246];
    headers.forEach((h,i) => doc.text(h, xs[i], 25));
    let y=32;
    ticketControlRows.forEach(r => { if (y > 190) { doc.addPage(); y=18; } const vals=[new Date(r.criadoEm).toLocaleString('pt-BR'),normalizeTicketNumber(r.inicio),normalizeTicketNumber(r.fim),r.total,r.liberacoes,r.recebimentos,r.completas,r.pendentes]; vals.forEach((v,i)=>doc.text(String(v),xs[i],y)); y+=7; });
    doc.save('controle_tickets_jazida.pdf');
  };

  const copyPublicLink = async () => {
    const link = `${window.location.origin}/ticket-link/geral`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkMessage('Link copiado.');
    } catch {
      setLinkMessage(link);
    }
    window.setTimeout(() => setLinkMessage(''), 3500);
  };

  const statusStyles: Record<string, string> = {
    'OK': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Pendente': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Duplicado': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'Verificar quantidade': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Verificar bomba': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Erro de importação': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'Rascunho': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    'Enviado': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  };

  const normalizeImportHeader = (value: string) =>
    String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const TICKET_COLUMN_SYNONYMS: Record<string, string[]> = {
    data: ['data'],
    ticketNumero: ['ticket nº', 'ticket n', 'ticket numero', 'ticket no'],
    prefixo: ['prefixo', 'frota'],
    familiaEquipamento: ['familia do equipamento', 'familia equipamento'],
    equipamentoNome: ['equipamento', 'equipamento descricao', 'equipamento / descricao', 'descricao'],
    placa: ['placa'],
    horaSaida: ['hora de saida', 'hora saida', 'saida'],
    horaChegada: ['hora de chegada', 'hora chegada', 'chegada'],
    tipoMaterial: ['tipo de material', 'material'],
    quantidadeM3: ['quantidade m3', 'quantidade m³', 'quantidade', 'qtd m3', 'qtd m³'],
    destinoObra: ['destino obra', 'destino / obra', 'destino'],
    ramoDescarga: ['ramo de descarga', 'ramo descarga', 'ramo'],
    empresa: ['empresa'],
    estaca: ['estaca'],
    status: ['status conferencia', 'status / conferencia', 'status', 'conferencia'],
  };

  const readCellValue = (cell: ExcelJS.Cell): any => {
    const value = cell.value as any;
    if (value && typeof value === 'object') {
      if (value.result !== undefined) return value.result;
      if (value.text !== undefined) return value.text;
      if (Array.isArray(value.richText)) return value.richText.map((part: any) => part.text || '').join('');
    }
    return value;
  };

  const parseDateValue = (value: any) => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') {
      const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
      return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
    }
    const text = String(value).trim();
    const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return iso ? `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}` : '';
  };

  const parseTimeValue = (value: any) => {
    if (!value) return '';
    if (value instanceof Date) return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    if (typeof value === 'number') {
      let totalMinutes = Math.round((value % 1) * 24 * 60);
      if (totalMinutes < 0) totalMinutes += 24 * 60;
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    }
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
  };

  const parseNumberValue = (value: any) => {
    if (typeof value === 'number') return value;
    const parsed = Number(String(value || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeMaterialValue = (value: any): TipoMaterialJazida => {
    const text = String(value || '').trim();
    return TIPOS_MATERIAL.find(item => item.toLowerCase() === text.toLowerCase()) || 'Outros';
  };

  const normalizeEmpresaValue = (value: any): EmpresaTicketJazida => {
    const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (text.includes('terce')) return 'Terceiro';
    if (text.includes('outro')) return 'Outros';
    return 'RENEA';
  };

  const normalizeStatusValue = (value: any): TicketJazida['status'] => {
    const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (text.includes('duplic')) return 'Duplicado';
    if (text.includes('quant')) return 'Verificar quantidade';
    if (text.includes('bomba')) return 'Verificar bomba';
    if (text.includes('pend')) return 'Pendente';
    if (text.includes('erro')) return 'Erro de importação';
    return 'OK';
  };

  const normalizeDestinoValue = (value: any): DestinoObraJazida => {
    const text = String(value || '').trim();
    if (!text) return 'Outros';
    const normalized = normalizeImportHeader(text);
    if (normalized === 'renea' || /^\d+$/.test(normalized)) return 'Outros';
    return DESTINOS_OBRA.find(item => normalizeImportHeader(item) === normalized) || text;
  };

  const buildTicketColumnMap = (row: ExcelJS.Row) => {
    const colMap: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = normalizeImportHeader(String(readCellValue(cell) || ''));
      Object.entries(TICKET_COLUMN_SYNONYMS).forEach(([key, aliases]) => {
        if (!colMap[key] && aliases.some(alias => normalizeImportHeader(alias) === header)) colMap[key] = colNumber;
      });
    });
    return colMap;
  };

  const findTicketHeaderRow = (ws: ExcelJS.Worksheet) => {
    let bestRow = 1;
    let bestScore = 0;
    for (let rowNumber = 1; rowNumber <= Math.min(ws.rowCount, 20); rowNumber += 1) {
      const map = buildTicketColumnMap(ws.getRow(rowNumber));
      const score = ['data', 'ticketNumero', 'prefixo', 'placa', 'tipoMaterial', 'quantidadeM3'].filter(key => map[key]).length;
      if (score > bestScore) {
        bestScore = score;
        bestRow = rowNumber;
      }
    }
    return bestScore >= 4 ? bestRow : 0;
  };

  const handleImportTicketsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setValidationError('');
    setImportMessage('');
    try {
      const wb = await loadValidatedWorkbook(file);
      const worksheets = wb.worksheets.filter(ws => {
        const name = normalizeImportHeader(ws.name);
        return name.includes('liberacao') || name.includes('recebimento');
      });
      const targetSheets = worksheets.length ? worksheets : wb.worksheets;
      const imported: TicketJazida[] = [];
      let ignored = 0;
      const seen = new Set(tickets.map(item => `${item.tipoTicket || 'Liberação'}|${item.data}|${item.ticketNumero}|${item.prefixo}`.toLowerCase()));

      targetSheets.forEach(ws => {
        const sheetName = normalizeImportHeader(ws.name);
        const tipo: TipoTicketJazida = sheetName.includes('recebimento') ? 'Recebimento' : 'Liberação';
        const headerRowNumber = findTicketHeaderRow(ws);
        if (!headerRowNumber) return;
        const colMap = buildTicketColumnMap(ws.getRow(headerRowNumber));
        const getValue = (row: ExcelJS.Row, key: string) => colMap[key] ? readCellValue(row.getCell(colMap[key])) : undefined;

        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber <= headerRowNumber) return;
          const dataImportada = parseDateValue(getValue(row, 'data'));
          const ticketImportado = String(getValue(row, 'ticketNumero') || '').trim();
          const prefixoImportado = String(getValue(row, 'prefixo') || '').trim().toUpperCase();
          const placaImportada = String(getValue(row, 'placa') || '').trim().toUpperCase();
          const quantidadeImportada = parseNumberValue(getValue(row, 'quantidadeM3'));
          if (!dataImportada || !ticketImportado || !prefixoImportado || !quantidadeImportada) {
            ignored += 1;
            return;
          }
          const key = `${tipo}|${dataImportada}|${ticketImportado}|${prefixoImportado}`.toLowerCase();
          if (seen.has(key)) {
            ignored += 1;
            return;
          }
          seen.add(key);
          const hora = parseTimeValue(getValue(row, tipo === 'Recebimento' ? 'horaChegada' : 'horaSaida')) || '00:00';
          imported.push({
            id: `ticket-import-${Date.now()}-${rowNumber}-${imported.length}`,
            data: dataImportada,
            tipoTicket: tipo,
            ticketNumero: ticketImportado,
            prefixo: prefixoImportado,
            placa: placaImportada,
            familiaEquipamento: String(getValue(row, 'familiaEquipamento') || '').trim(),
            equipamentoNome: String(getValue(row, 'equipamentoNome') || '').trim(),
            horaChegada: tipo === 'Recebimento' ? hora : undefined,
            horaSaida: tipo === 'Liberação' ? hora : '',
            tipoMaterial: normalizeMaterialValue(getValue(row, 'tipoMaterial')),
            quantidadeM3: quantidadeImportada,
            destinoObra: normalizeDestinoValue(getValue(row, tipo === 'Recebimento' ? 'ramoDescarga' : 'destinoObra')),
            estaca: tipo === 'Recebimento' ? String(getValue(row, 'estaca') || '').trim() : '',
            responsavelLiberacao: '',
            nomeLegivel: '',
            empresa: normalizeEmpresaValue(getValue(row, 'empresa')),
            observacao: `Importado de ${file.name} / ${ws.name}`,
            status: normalizeStatusValue(getValue(row, 'status')),
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          });
        });
      });

      if (imported.length === 0) {
        setValidationError(`Nenhum ticket novo foi encontrado. ${ignored ? `${ignored} linha(s) foram ignoradas por erro ou duplicidade.` : 'Confira se a planilha tem as abas LIBERAÇÃO e RECEBIMENTO.'}`);
        return;
      }
      setPendingImport({ fileName: file.name, items: imported, ignored });
    } catch (err: any) {
      console.error('Erro ao importar tickets:', err);
      setValidationError(err?.message || 'Não foi possível importar a planilha de tickets. Use um arquivo .xlsx ou .xlsm no modelo de liberação/recebimento.');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const confirmTicketsImport = () => {
    if (!pendingImport || isConfirmingImport) return;
    setIsConfirmingImport(true);
    onImportTickets(pendingImport.items);
    setImportMessage(`${pendingImport.items.length} ticket(s) importado(s) de ${pendingImport.fileName}.${pendingImport.ignored ? ` ${pendingImport.ignored} linha(s) ignorada(s).` : ''}`);
    setPendingImport(null);
    setIsConfirmingImport(false);
  };

  // ---- Exportação Excel ----
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      configureCorporateWorkbook(wb, 'Tickets de Liberação e Recebimento');

      const matchesExportFilters = (t: TicketJazida, tipo: TipoTicketJazida) => {
        if ((t.tipoTicket || 'Liberação') !== tipo) return false;
        const flowStatus = t.statusFluxo || 'Enviado';
        const qualityStatus = t.status || 'OK';
        if (fDataInicial && t.data < fDataInicial) return false;
        if (fDataFinal && t.data > fDataFinal) return false;
        if (fTicketNumero && !t.ticketNumero.toLowerCase().includes(fTicketNumero.toLowerCase())) return false;
        if (fPrefixo && !t.prefixo.toLowerCase().includes(fPrefixo.toLowerCase())) return false;
        if (fPlaca && !t.placa.toLowerCase().includes(fPlaca.toLowerCase())) return false;
        if (fTipoMaterial && t.tipoMaterial !== fTipoMaterial) return false;
        if (fDestinoObra && t.destinoObra !== fDestinoObra) return false;
        if (fEmpresa && t.empresa !== fEmpresa) return false;
        if (fStatus && !([flowStatus, qualityStatus].includes(fStatus))) return false;
        if (q) {
          const haystack = [
            t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
            t.tipoMaterial, t.destinoObra, t.destinoOutro, t.estaca, t.empresa, t.responsavelLiberacao,
            t.nomeLegivel, t.observacao, t.data
          ].filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      };

      const addTicketWorksheet = (tipo: TipoTicketJazida) => {
        const isRecebimento = tipo === 'Recebimento';
        const ws = wb.addWorksheet(isRecebimento ? 'RECEBIMENTO' : 'LIBERAÇÃO');
        const headers = isRecebimento
          ? ['Data', 'Ticket Nº', 'Prefixo', 'Família do Equipamento', 'Equipamento', 'Placa', 'Hora de chegada', 'Tipo de material', 'Quantidade', 'Unidade', 'Ramo de Descarga', 'Empresa', 'Estaca', 'Carga conforme', 'Responsável', 'Observações', 'Situação', 'Assinado digitalmente']
          : ['Data', 'Ticket Nº', 'Prefixo', 'Família do Equipamento', 'Equipamento', 'Placa', 'Hora de saída', 'Tipo de material', 'Quantidade', 'Unidade', 'Destino / Obra', 'Empresa', 'Responsável', 'Situação', 'Assinado digitalmente'];

        ws.columns = headers.map((header, index) => ({
          key: `col${index + 1}`,
          width: [12, 12, 12, 24, 24, 13, 16, 18, 16, 22, 16, 18, 22][index] || 16,
        }));
        ws.mergeCells(1, 1, 1, headers.length);
        ws.getCell(1, 1).value = isRecebimento ? 'TICKET DE RECEBIMENTO - OBRA SABESP' : 'TICKET DE LIBERAÇÃO - JAZIDA SABESP';
        ws.getRow(1).height = 24;
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
        ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        const headerRow = ws.getRow(4);
        headerRow.values = [, ...headers];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        tickets
          .filter(item => matchesExportFilters(item, tipo))
          .sort((a, b) => a.data.localeCompare(b.data) || Number(a.ticketNumero) - Number(b.ticketNumero))
          .forEach(item => {
            const values = isRecebimento
              ? [
                  item.data ? item.data.split('-').reverse().join('/') : '',
                  item.ticketNumero,
                  item.prefixo,
                  item.familiaEquipamento || '',
                  item.equipamentoNome || '',
                  item.placa,
                  item.horaChegada || item.horaSaida || '',
                  item.tipoMaterial,
                  item.quantidadeM3,
                  item.unidadeQuantidade || 'm³',
                  item.destinoObra === 'Outros' ? item.destinoOutro || 'Outros' : item.destinoObra,
                  item.empresa,
                  item.estaca || '',
                  typeof item.cargaConforme === 'boolean' ? (item.cargaConforme ? 'Sim' : 'Não') : '',
                  item.nomeLegivel || item.responsavelLiberacao,
                  item.observacao || '',
                  item.statusFluxo || item.status || 'Enviado',
                  item.assinaturaDigital ? 'Sim' : 'Não',
                ]
              : [
                  item.data ? item.data.split('-').reverse().join('/') : '',
                  item.ticketNumero,
                  item.prefixo,
                  item.familiaEquipamento || '',
                  item.equipamentoNome || '',
                  item.placa,
                  item.horaSaida || '',
                  item.tipoMaterial,
                  item.quantidadeM3,
                  item.unidadeQuantidade || 'm³',
                  item.destinoObra === 'Outros' ? item.destinoOutro || 'Outros' : item.destinoObra,
                  item.empresa,
                  item.nomeLegivel || item.responsavelLiberacao,
                  item.statusFluxo || item.status || 'Enviado',
                  item.assinaturaDigital ? 'Sim' : 'Não',
                ];
            ws.addRow(values);
          });

        styleCorporateWorksheet(ws, {
          title: isRecebimento ? 'Tickets de Recebimento' : 'Tickets de Liberação',
          headerRow: 4,
          lastColumn: headers.length,
          recordCount: Math.max(0, ws.rowCount - 4),
          filters: [fDataInicial ? `Início: ${fDataInicial}` : '', fDataFinal ? `Fim: ${fDataFinal}` : '', fStatus ? `Situação: ${fStatus}` : ''],
        });
      };

      addTicketWorksheet('Liberação');
      addTicketWorksheet('Recebimento');
      const exportados = tickets.filter(item => matchesExportFilters(item, item.tipoTicket || 'Liberação'));
      addCorporateSummarySheet(wb, 'Tickets de Jazida', [
        ['Total exportado', exportados.length],
        ['Liberações', exportados.filter(item => (item.tipoTicket || 'Liberação') === 'Liberação').length],
        ['Recebimentos', exportados.filter(item => item.tipoTicket === 'Recebimento').length],
        ['Pendentes', exportados.filter(item => (item.statusFluxo || item.status) === 'Pendente').length],
      ]);
      const sufixo = hasFiltrosAtivos ? '_filtrado' : '';
      await downloadCorporateWorkbook(wb, `RENEA_tickets_jazida${sufixo}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Excel de tickets jazida:', err);
      setValidationError('Não foi possível exportar o Excel. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // ---- Impressão / PDF individual do ticket ----
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

  const getTicketPair = (baseTicket: TicketJazida) => {
    const sameNumber = tickets.filter(item => item.ticketNumero === baseTicket.ticketNumero);
    const existingRelease = sameNumber.find(item => (item.tipoTicket || 'Liberação') === 'Liberação');
    const existingReceipt = sameNumber.find(item => item.tipoTicket === 'Recebimento');
    const shared = existingRelease || existingReceipt || baseTicket;
    const releaseTicket: TicketJazida = existingRelease || {
      ...shared,
      id: `${shared.id}-release-preview`,
      tipoTicket: 'Liberação',
      horaSaida: shared.horaSaida || '',
      horaChegada: undefined,
      cargaConforme: undefined,
      estaca: '',
      assinaturaDigital: undefined,
      nomeLegivel: '',
    };
    const receiptTicket: TicketJazida = existingReceipt || {
      ...shared,
      id: `${shared.id}-receipt-preview`,
      tipoTicket: 'Recebimento',
      horaChegada: '',
      horaSaida: '',
      cargaConforme: undefined,
      estaca: '',
      observacao: '',
      assinaturaDigital: undefined,
      nomeLegivel: '',
    };
    return { releaseTicket, receiptTicket };
  };

  const handlePrintTicket = async (t: TicketJazida) => {
    try {
      const pair = getTicketPair(t);
      await generatePairedTicketPdf(pair.releaseTicket, pair.receiptTicket);
      return;
      const doc = new jsPDF('p', 'mm', 'a5');
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 14;

      try {
        const logoBase64 = await getBase64ImageFromUrl(reneaLogoFull);
        doc.addImage(logoBase64, 'PNG', 10, y - 6, 26, 14);
      } catch {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('RENEA', 10, y);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Ticket de ${t.tipoTicket || 'Liberação'} - Jazida`, pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setDrawColor(20, 83, 45);
      doc.line(10, y, pageWidth - 10, y);
      y += 8;

      const rows: [string, string][] = [
        ['Ticket Nº', t.ticketNumero],
        ['Tipo', t.tipoTicket || 'Liberação'],
        ['Data', t.data.split('-').reverse().join('/')],
        ['Prefixo', t.prefixo],
        ['Placa', t.placa],
        ['Família do Equipamento', t.familiaEquipamento || '—'],
        ['Equipamento', t.equipamentoNome || '—'],
        ['Hora de Chegada', t.horaChegada || '—'],
        ['Hora de Saída', t.horaSaida || '—'],
        ['Tipo de Material', t.tipoMaterial === 'Outros' ? t.materialOutro || 'Outros' : t.tipoMaterial],
        ['Quantidade', `${t.quantidadeM3} ${t.unidadeQuantidade || 'm³'}`],
        [(t.tipoTicket || 'Liberação') === 'Recebimento' ? 'Ramo de Descarga' : 'Destino / Obra', t.destinoObra === 'Outros' ? t.destinoOutro || 'Outros' : t.destinoObra],
        ['Estaca', t.estaca || '—'],
        ['Carga Conforme', typeof t.cargaConforme === 'boolean' ? (t.cargaConforme ? 'Sim' : 'Não') : '—'],
        [(t.tipoTicket || 'Liberação') === 'Recebimento' ? 'Responsável pelo Recebimento' : 'Responsável pela Liberação', t.responsavelLiberacao || '—'],
        ['Nome Legível', t.nomeLegivel || '—'],
        ['Empresa', t.empresa],
        ['Situação', t.statusFluxo || t.status || 'Enviado'],
      ];

      doc.setFontSize(10);
      rows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 12, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 70, y);
        y += 7;
      });

      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Observação:', 12, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(t.observacao || '—', pageWidth - 24);
      doc.text(obsLines, 12, y);
      y += obsLines.length * 5 + 12;

      doc.setFont('helvetica', 'bold');
      doc.text('Assinatura:', 12, y);
      if (t.assinaturaDigital) {
        try {
          doc.addImage(t.assinaturaDigital, 'PNG', 12, y + 3, 86, 28);
          y += 34;
          doc.setFont('helvetica', 'normal');
          doc.text(t.assinaturaResponsavel || t.nomeLegivel || t.responsavelLiberacao || '', 12, y);
        } catch {
          y += 14;
          doc.line(12, y, pageWidth - 12, y);
        }
      } else {
        y += 14;
        doc.line(12, y, pageWidth - 12, y);
      }

      doc.save(`ticket_jazida_${t.ticketNumero}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF do ticket:', err);
      setValidationError('Não foi possível gerar o PDF do ticket.');
    }
  };

  const handlePrintBlankForm = async () => {
    setValidationError('');
    setIsBatchPrinting(true);
    try {
      const now = new Date().toISOString();
      const reservedNumber = await onReserveTicketNumber();
      const releaseTicket: TicketJazida = {
        id: `ticket-em-branco-lib-${Date.now()}`,
        data: '',
        tipoTicket: 'Liberação',
        ticketNumero: reservedNumber,
        prefixo: '',
        placa: '',
        horaSaida: '',
        tipoMaterial: 'Solo',
        quantidadeM3: 0,
        destinoObra: 'Marginal',
        responsavelLiberacao: '',
        nomeLegivel: '',
        empresa: 'RENEA',
        observacao: '',
        unidadeQuantidade: 'm³',
        criadoEm: now,
        atualizadoEm: now,
        impressaoEmBranco: true,
        ocultarNumeroImpressao: false,
      };
      const receiptTicket: TicketJazida = {
        ...releaseTicket,
        id: `ticket-em-branco-rec-${Date.now()}`,
        tipoTicket: 'Recebimento',
        horaChegada: '',
      };
      await generateTicketBookPdf([{ releaseTicket, receiptTicket }], `ticket_em_branco_${reservedNumber}.pdf`);
      setImportMessage(`Ticket Nº ${reservedNumber} gerado com apenas a numeração preenchida.`);
    } catch (err) {
      console.error('Erro ao gerar formulário de ticket em branco:', err);
      setValidationError('Não foi possível gerar o formulário em branco.');
    } finally {
      setIsBatchPrinting(false);
    }
  };

  const viewingPair = viewingTicket ? getTicketPair(viewingTicket) : null;

  return (
    <div className="space-y-6" id="tickets-jazida-tab">
      <SpreadsheetImportReview
        open={Boolean(pendingImport)}
        title="Importar tickets de liberação e recebimento"
        fileName={pendingImport?.fileName || ''}
        validCount={pendingImport?.items.length || 0}
        ignoredCount={pendingImport?.ignored || 0}
        columns={['Via', 'Ticket', 'Data', 'Prefixo', 'Placa', 'Material', 'Quantidade']}
        rows={(pendingImport?.items || []).map(item => ({
          Via: item.tipoTicket || 'Liberação',
          Ticket: item.ticketNumero,
          Data: item.data.split('-').reverse().join('/'),
          Prefixo: item.prefixo,
          Placa: item.placa,
          Material: item.tipoMaterial,
          Quantidade: item.quantidadeM3
        }))}
        note="As abas LIBERAÇÃO e RECEBIMENTO são lidas juntas. Tickets repetidos ou incompletos ficam fora da importação."
        confirming={isConfirmingImport}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmTicketsImport}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            Controle de Tickets
          </h1>
          <p className="text-xs text-slate-400 mt-1">Tickets de liberação e recebimento com hora de saída ou chegada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrintBlankForm}
            disabled={isBatchPrinting}
            title="Gerar uma folha apenas com o próximo número sequencial preenchido"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 text-xs font-black text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir em branco
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            title="Importar tickets de uma planilha XLSX ou XLSM"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-200 transition-colors hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            {isImporting ? 'Validando planilha...' : 'Importar tickets'}
          </button>
          <button
            type="button"
            onClick={openBatchModal}
            title="Criar e imprimir tickets em ordem crescente"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-200 transition-colors hover:border-emerald-500 hover:text-white"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Imprimir sequência
          </button>
          <button
            onClick={copyPublicLink}
            title="Copiar o link único para liberação e recebimento"
            className="px-4 py-2.5 bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Link2 className="w-4 h-4" /> Copiar link público
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            Novo Ticket de {ticketTab}
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx,.xlsm" onChange={handleImportTicketsFile} className="hidden" />
        </div>
      </div>

      {linkMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <span className="break-all">{linkMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-amber-500/20 bg-slate-900 p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-400">Rascunhos</span><FilePenLine className="h-4 w-4 text-amber-400" /></div>
          <strong className="mt-2 block text-2xl text-white">{flowDashboard.drafts}</strong>
          <span className="text-[10px] text-slate-500">Ainda podem ser editados e enviados</span>
        </div>
        <div className="rounded-lg border border-sky-500/20 bg-slate-900 p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-400">Aguardando recebimento</span><Clock3 className="h-4 w-4 text-sky-400" /></div>
          <strong className="mt-2 block text-2xl text-white">{flowDashboard.pending}</strong>
          <span className="text-[10px] text-slate-500">Liberação enviada, chegada pendente</span>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-slate-900 p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-400">Pares concluídos</span><CheckCircle2 className="h-4 w-4 text-emerald-400" /></div>
          <strong className="mt-2 block text-2xl text-white">{flowDashboard.completed}</strong>
          <span className="text-[10px] text-slate-500">Liberação e recebimento enviados</span>
        </div>
      </div>

      {flowDashboard.pairs.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-black text-white">Acompanhamento das duas vias</h2><p className="text-[10px] text-slate-500">Últimos caminhões registrados</p></div>
            <span className="text-[10px] font-bold text-slate-500">{flowDashboard.pairs.length} números</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {flowDashboard.pairs.slice(0, 9).map(pair => {
              const releaseSent = pair.liberacao && pair.liberacao.statusFluxo !== 'Rascunho';
              const receiptSent = pair.recebimento && pair.recebimento.statusFluxo !== 'Rascunho';
              return (
                <div key={pair.numero} className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between"><b className="text-xs text-white">Ticket {pair.numero}</b><span className="text-[10px] text-slate-500">{pair.liberacao?.placa || pair.recebimento?.placa || 'Sem placa'}</span></div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <span className={`rounded px-2 py-1.5 text-center text-[10px] font-black ${releaseSent ? 'bg-emerald-500/10 text-emerald-300' : pair.liberacao ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>Liberação {releaseSent ? 'enviada' : pair.liberacao ? 'rascunho' : 'pendente'}</span>
                    <span className={`rounded px-2 py-1.5 text-center text-[10px] font-black ${receiptSent ? 'bg-emerald-500/10 text-emerald-300' : pair.recebimento ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>Recebimento {receiptSent ? 'enviado' : pair.recebimento ? 'rascunho' : 'pendente'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800">
        {(['Liberação', 'Recebimento'] as TipoTicketJazida[]).map(tipo => (
          <button
            key={tipo}
            onClick={() => { setTicketTab(tipo); setIsFormOpen(false); resetFormFields(); }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${ticketTab === tipo ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-100'}`}
          >
            Tickets de {tipo}
          </button>
        ))}
      </div>

      {/* Busca, atalhos e filtros */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-600" />
          <input
            id="ticket-search"
            name="ticketSearch"
            type="text"
            placeholder="Buscar ticket, placa, prefixo, material, destino ou responsável"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-slate-950 border border-slate-700 rounded-md pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          </div>
          <button type="button" onClick={() => setFiltrosAbertos(v => !v)} aria-expanded={filtrosAbertos} className={`h-10 flex items-center justify-center gap-2 px-4 rounded-md text-xs font-bold border transition-colors ${filtrosAbertos ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-500'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            Mais filtros
            {activeFilterCount > 0 && <span className="min-w-5 h-5 px-1 rounded bg-white/15 grid place-items-center text-[10px]">{activeFilterCount}</span>}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" onClick={handleExportExcel} disabled={isExporting} className="h-10 flex items-center justify-center gap-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-md">
            <FileSpreadsheet className="w-4 h-4" />
            {isExporting ? 'Exportando...' : hasFiltrosAtivos ? 'Exportar resultado' : 'Exportar Excel'}
          </button>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center gap-3 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase shrink-0"><CalendarDays className="w-4 h-4" /> Período</div>
          <div className="flex flex-wrap gap-1.5">
            {[{ label: 'Hoje', days: 1 }, { label: '7 dias', days: 7 }, { label: '30 dias', days: 30 }].map(period => (
              <button key={period.days} type="button" onClick={() => applyPeriod(period.days)} className={`h-8 px-3 rounded-md border text-[11px] font-bold ${isPeriodActive(period.days) ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}>{period.label}</button>
            ))}
            <button type="button" onClick={() => applyPeriod()} className={`h-8 px-3 rounded-md border text-[11px] font-bold ${!fDataInicial && !fDataFinal ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}>Todo período</button>
          </div>
          <div className="xl:ml-auto flex items-center gap-2">
            <label htmlFor="ticket-quick-status" className="text-[10px] font-bold text-slate-500 uppercase">Situação</label>
            <select id="ticket-quick-status" value={fStatus} onChange={e => setFStatus(e.target.value)} className="h-8 min-w-40 bg-slate-950 border border-slate-700 rounded-md px-3 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500">
              <option value="">Todas</option><option value="Enviado">Enviados</option><option value="Rascunho">Rascunhos</option><option value="Pendente">Pendentes</option><option value="Duplicado">Duplicados</option><option value="OK">Conferidos</option>
            </select>
            {hasFiltrosAtivos && <button type="button" onClick={limparFiltros} title="Limpar todos os filtros" className="h-8 w-8 grid place-items-center rounded-md border border-slate-700 text-slate-400 hover:border-rose-500 hover:text-rose-400"><FilterX className="w-4 h-4" /></button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Exibindo <strong className="text-slate-200">{filteredTickets.length}</strong> de {tickets.filter(item => (item.tipoTicket || 'Liberação') === ticketTab).length} tickets de {ticketTab.toLowerCase()}.</span>
        {hasFiltrosAtivos && (
          <div className="flex flex-wrap items-center gap-1.5">
            {fDataInicial && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">De {fDataInicial.split('-').reverse().join('/')}</span>}
            {fDataFinal && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">Até {fDataFinal.split('-').reverse().join('/')}</span>}
            {fTipoMaterial && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">Material: {fTipoMaterial}</span>}
            {fDestinoObra && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">Destino: {fDestinoObra}</span>}
            {fEmpresa && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">Empresa: {fEmpresa}</span>}
            {fStatus && <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1">Situação: {fStatus}</span>}
          </div>
        )}
      </div>

      {importMessage && (
        <div className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
          {importMessage}
        </div>
      )}
      {validationError && !isFormOpen && (
        <div className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
          {validationError}
        </div>
      )}

      {/* Filter panel + summary cards */}
      {filtrosAbertos && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label htmlFor="filter-start-date" className="text-xxs font-bold uppercase text-slate-400">Data inicial</label>
              <input id="filter-start-date" name="filterStartDate" type="date" value={fDataInicial} onChange={e => setFDataInicial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-end-date" className="text-xxs font-bold uppercase text-slate-400">Data final</label>
              <input id="filter-end-date" name="filterEndDate" type="date" value={fDataFinal} onChange={e => setFDataFinal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-ticket-number" className="text-xxs font-bold uppercase text-slate-400">Ticket Nº</label>
              <input id="filter-ticket-number" name="filterTicketNumber" type="text" value={fTicketNumero} onChange={e => setFTicketNumero(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-prefix" className="text-xxs font-bold uppercase text-slate-400">Prefixo</label>
              <input id="filter-prefix" name="filterPrefix" type="text" value={fPrefixo} onChange={e => setFPrefixo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-plate" className="text-xxs font-bold uppercase text-slate-400">Placa</label>
              <input id="filter-plate" name="filterPlate" type="text" value={fPlaca} onChange={e => setFPlaca(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Tipo de Material</label>
              <select value={fTipoMaterial} onChange={e => setFTipoMaterial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                {TIPOS_MATERIAL.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Destino / Obra</label>
              <select value={fDestinoObra} onChange={e => setFDestinoObra(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                {DESTINOS_OBRA.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa</label>
              <select value={fEmpresa} onChange={e => setFEmpresa(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todas</option>
                {EMPRESAS_TICKET.map(em => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                <option value="Rascunho">Rascunho</option>
                <option value="Enviado">Enviado</option>
                <option value="OK">OK</option>
                <option value="Pendente">Pendente</option>
                <option value="Duplicado">Duplicado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button type="button" onClick={limparFiltros} className="flex items-center gap-1.5 px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer">
              <FilterX className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
            <button type="button" onClick={handleExportExcel} disabled={isExporting} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {isExporting ? 'Exportando...' : hasFiltrosAtivos ? 'Exportar Excel filtrado' : 'Exportar Excel'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Tickets</p>
              <p className="text-lg font-black text-white font-mono mt-1">{resumo.totalTickets}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total m³</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-1">{resumo.totalM3.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tickets OK</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-1">{resumo.okCount}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pendentes</p>
              <p className="text-lg font-black text-amber-400 font-mono mt-1">{resumo.pendCount}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Duplicados</p>
              <p className="text-lg font-black text-rose-400 font-mono mt-1">{resumo.dupCount}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Caçambas</p>
              <p className="text-lg font-black text-white font-mono mt-1">{resumo.totalCacambas.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {isFormOpen && (
        <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl shadow-xl relative">
          <button onClick={() => { setIsFormOpen(false); resetFormFields(); }} className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-xs uppercase tracking-widest font-black text-emerald-400 font-mono mb-5 flex items-center gap-2">
            {editingId ? 'Editando Ticket' : 'Novo Ticket'} • {tipoTicket} - Jazida
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Tipo do Ticket</label>
                <select value={tipoTicket} onChange={e => {
                  const nextTipo = e.target.value as TipoTicketJazida;
                  setTipoTicket(nextTipo);
                  if (nextTipo === 'Recebimento' && ticketNumero.trim()) {
                    applyLiberacaoCloneToForm(ticketNumero);
                  }
                }} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                  <option value="Liberação">Liberação</option>
                  <option value="Recebimento">Recebimento</option>
                </select>
              </div>
              {tipoTicket === 'Recebimento' ? (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Hora de Chegada</label>
                  <input type="time" value={horaChegada} onChange={e => setHoraChegada(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Hora de Saída</label>
                  <input type="time" value={horaSaida} onChange={e => setHoraSaida(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Ticket Nº *</label>
                <input
                  type="text"
                  value={ticketNumero}
                  onChange={e => setTicketNumero(e.target.value)}
                  onBlur={() => {
                    if (tipoTicket === 'Recebimento' && ticketNumero.trim()) {
                      applyLiberacaoCloneToForm(ticketNumero);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data *</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Prefixo *</label>
                <input type="text" value={prefixo} onChange={e => setPrefixo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Placa *</label>
                <input type="text" value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Família do Equipamento</label>
                <input type="text" value={familiaEquipamento} onChange={e => setFamiliaEquipamento(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Equipamento / Descrição</label>
                <input type="text" value={equipamentoNome} onChange={e => setEquipamentoNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Tipo de Material *</label>
                <select value={tipoMaterial} onChange={e => setTipoMaterial(e.target.value as TipoMaterialJazida)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                  {TIPOS_MATERIAL.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Quantidade (m³) *</label>
                <input type="number" min="0.01" step="0.01" value={quantidadeM3} onChange={e => setQuantidadeM3(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">{tipoTicket === 'Recebimento' ? 'Ramo de Descarga *' : 'Destino / Obra *'}</label>
                <select value={destinoObra} onChange={e => setDestinoObra(e.target.value as DestinoObraJazida)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                  {DESTINOS_OBRA.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {destinoObra === 'Outros' && (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">{tipoTicket === 'Recebimento' ? 'Qual ramo de descarga? *' : 'Qual destino? *'}</label>
                  <input type="text" value={destinoOutro} onChange={e => setDestinoOutro(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              )}
              {tipoTicket === 'Recebimento' && (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Estaca</label>
                  <input type="text" value={estaca} onChange={e => setEstaca(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa *</label>
                <select value={empresa} onChange={e => setEmpresa(e.target.value as EmpresaTicketJazida)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                  {EMPRESAS_TICKET.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Responsável pela Liberação</label>
                <input type="text" value={responsavelLiberacao} onChange={e => setResponsavelLiberacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Nome Legível</label>
                <input type="text" value={nomeLegivel} onChange={e => setNomeLegivel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Observação</label>
              <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
            </div>

            {validationError && (
              <div className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                ⚠️ {validationError}
              </div>
            )}

            <div className="flex gap-2.5">
              <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
                {editingId ? 'Salvar Ticket' : 'Registrar Ticket'}
              </button>
              <button type="button" onClick={() => { setIsFormOpen(false); resetFormFields(); }} className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                <th className="py-3.5 px-5">Data / Hora</th>
                <th className="py-3.5 px-5">Ticket Nº</th>
                <th className="py-3.5 px-5">Prefixo / Placa</th>
                <th className="py-3.5 px-5">Material</th>
                <th className="py-3.5 px-5">Qtd (m³)</th>
                <th className="py-3.5 px-5">Destino</th>
                <th className="py-3.5 px-5">Empresa</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 italic">
                    {hasFiltrosAtivos ? 'Nenhum ticket encontrado para os filtros selecionados.' : 'Nenhum ticket registrado.'}
                  </td>
                </tr>
              ) : (
                filteredTickets.map(t => {
                  const status = t.statusFluxo || t.status || 'Enviado';
                  const hasRecebimentoClone = tickets.some(item =>
                    (item.tipoTicket || 'Liberação') === 'Recebimento' &&
                    item.ticketNumero.trim().toLowerCase() === t.ticketNumero.trim().toLowerCase()
                  );
                  return (
                    <tr key={t.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-5">
                        <span className="font-bold text-slate-100 block">{t.data.split('-').reverse().join('/')}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">{t.tipoTicket || 'Liberação'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{(t.tipoTicket || 'Liberação') === 'Recebimento' ? (t.horaChegada || t.horaSaida) : t.horaSaida}</span>
                      </td>
                      <td className="py-4 px-5 font-mono text-emerald-400 font-bold">{t.ticketNumero}</td>
                      <td className="py-4 px-5">
                        <span className="font-mono text-slate-200 font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xxs">{t.prefixo}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{t.placa}</span>
                        {(t.equipamentoNome || t.familiaEquipamento) && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">{t.equipamentoNome || t.familiaEquipamento}</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-slate-300">{t.tipoMaterial}</td>
                      <td className="py-4 px-5 font-mono text-emerald-400 font-black text-sm">{t.quantidadeM3.toLocaleString('pt-BR')} <span className="text-[9px] text-slate-500">{t.unidadeQuantidade || 'm³'}</span></td>
                      <td className="py-4 px-5 text-slate-400">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-600" />{t.destinoObra === 'Outros' ? t.destinoOutro || 'Outros' : t.destinoObra}</span>
                        {t.estaca && <span className="block text-[10px] text-slate-500 mt-0.5">{t.estaca}</span>}
                      </td>
                      <td className="py-4 px-5 text-slate-400">{t.empresa}</td>
                      <td className="py-4 px-5">
                        <span className={`inline-block px-2 py-1 rounded-lg border text-[10px] font-bold ${statusStyles[status] || statusStyles['OK']}`}>{status}</span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setViewingTicket(t)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handlePrintTicket(t)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg cursor-pointer"><Printer className="w-3.5 h-3.5" /></button>
                          {(t.tipoTicket || 'Liberação') === 'Liberação' && (
                            <button
                              onClick={() => handleCloneRecebimentoFromLiberacao(t)}
                              title={hasRecebimentoClone ? 'Recebimento já gerado' : 'Gerar recebimento clonando CB e placa'}
                              className={`p-1.5 bg-slate-800 rounded-lg cursor-pointer ${hasRecebimentoClone ? 'text-slate-600' : 'text-slate-300 hover:text-emerald-400'}`}
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleOpenEdit(t)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-black text-white">Controle de tickets enviados</h3><p className="text-[10px] text-slate-500">Faixas impressas, preenchimento e viagens completas (liberação + recebimento).</p></div>
          <div className="flex gap-2"><button onClick={exportTicketControlPdf} className="px-3 py-2 rounded-lg bg-slate-800 text-xs font-bold text-white">Exportar PDF</button><button onClick={exportTicketControlExcel} className="px-3 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white">Exportar Excel</button></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-950 rounded-lg p-3"><p className="text-[9px] uppercase text-slate-500">Tickets enviados</p><p className="text-xl font-black text-white">{ticketControlTotals.total}</p></div>
          <div className="bg-slate-950 rounded-lg p-3"><p className="text-[9px] uppercase text-slate-500">Viagens completas</p><p className="text-xl font-black text-emerald-400">{ticketControlTotals.completas}</p></div>
          <div className="bg-slate-950 rounded-lg p-3"><p className="text-[9px] uppercase text-slate-500">Liberações preenchidas</p><p className="text-xl font-black text-white">{ticketControlTotals.liberacoes}</p></div>
          <div className="bg-slate-950 rounded-lg p-3"><p className="text-[9px] uppercase text-slate-500">Recebimentos preenchidos</p><p className="text-xl font-black text-white">{ticketControlTotals.recebimentos}</p></div>
        </div>
        <div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="p-2">Impressão</th><th>Faixa</th><th>Enviados</th><th>Lib.</th><th>Rec.</th><th>Viagens completas</th><th>Pendentes</th></tr></thead><tbody>{ticketControlRows.map(r=><tr key={r.id} className="border-t border-slate-800 text-slate-300"><td className="p-2">{new Date(r.criadoEm).toLocaleString('pt-BR')}</td><td>{normalizeTicketNumber(r.inicio)} a {normalizeTicketNumber(r.fim)}</td><td>{r.total}</td><td>{r.liberacoes}</td><td>{r.recebimentos}</td><td className="text-emerald-400 font-bold">{r.completas}</td><td>{r.pendentes}</td></tr>)}</tbody></table></div>
      </div>

      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => !isBatchPrinting && setIsBatchModalOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-3xl w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Imprimir tickets em sequência
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">Configure a numeração, escolha o que já deve sair preenchido e salve as duas vias para editar depois.</p>
              </div>
              <button type="button" disabled={isBatchPrinting} onClick={() => setIsBatchModalOpen(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${batchFillMode === 'em-branco' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}>
                <input type="radio" name="batch-fill-mode" checked={batchFillMode === 'em-branco'} onChange={() => setBatchFillMode('em-branco')} className="mt-0.5 accent-emerald-500" />
                <span><strong className="block text-[11px] text-slate-100">Somente a numeração</strong><small className="block text-[9px] text-slate-500">Todos os demais campos ficam vazios para preencher à caneta.</small></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${batchFillMode === 'pre-preenchido' ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-800 bg-slate-950'}`}>
                <input type="radio" name="batch-fill-mode" checked={batchFillMode === 'pre-preenchido'} onChange={() => setBatchFillMode('pre-preenchido')} className="mt-0.5 accent-cyan-500" />
                <span><strong className="block text-[11px] text-slate-100">Pré-preencher o lote</strong><small className="block text-[9px] text-slate-500">Você escolhe abaixo quais dados comuns já saem no PDF.</small></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${batchSaveDrafts ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-950'}`}>
                <input type="checkbox" checked={batchSaveDrafts} onChange={e => setBatchSaveDrafts(e.target.checked)} className="mt-0.5 accent-amber-500" />
                <span><strong className="block text-[11px] text-slate-100">Salvar para editar depois</strong><small className="block text-[9px] text-slate-500">Cria as duas vias como rascunhos editáveis no sistema.</small></span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Numeração</label>
                <select value={batchNumberMode} onChange={e => setBatchNumberMode(e.target.value as 'automatico' | 'manual')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
                  <option value="manual">Informar primeiro número</option>
                  <option value="automatico">Próxima sequência automática</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Quantidade</label>
                <input type="number" min="1" max="200" value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className={`space-y-1 ${batchNumberMode === 'automatico' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Primeiro ticket</label>
                <input value={batchNumberMode === 'automatico' ? 'Automático' : batchStartNumber} onChange={e => setBatchStartNumber(e.target.value)} disabled={batchNumberMode === 'automatico'} placeholder="Ex.: 100310" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchNumberMode === 'automatico' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Ordem</label>
                <select value={batchDirection} onChange={e => setBatchDirection(e.target.value as 'crescente' | 'decrescente')} disabled={batchNumberMode === 'automatico'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  <option value="crescente">Crescente</option>
                  <option value="decrescente">Decrescente</option>
                </select>
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data</label>
                <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Prefixo</label>
                <input value={batchPrefixo} onChange={e => setBatchPrefixo(e.target.value.toUpperCase())} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Placa</label>
                <input value={batchPlaca} onChange={e => setBatchPlaca(e.target.value.toUpperCase())} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Quantidade (m³)</label>
                <input type="number" min="0" step="0.01" value={batchQuantidadeM3} onChange={e => setBatchQuantidadeM3(Number(e.target.value))} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Material</label>
                <select value={batchTipoMaterial} onChange={e => setBatchTipoMaterial(e.target.value as TipoMaterialJazida)} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  {TIPOS_MATERIAL.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Destino / obra</label>
                <select value={batchDestinoObra} onChange={e => setBatchDestinoObra(e.target.value as DestinoObraJazida)} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  {DESTINOS_OBRA.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa</label>
                <select value={batchEmpresa} onChange={e => setBatchEmpresa(e.target.value as EmpresaTicketJazida)} disabled={batchFillMode === 'em-branco'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  {EMPRESAS_TICKET.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">
              <strong className="text-slate-200">Prévia:</strong>{' '}
              {Math.max(1, Math.min(200, Number(batchQuantity) || 1))} ticket(s) em duas vias,{' '}
              {batchFillMode === 'em-branco' ? 'apenas com a numeração' : 'com os campos escolhidos pré-preenchidos'}.
              {batchNumberMode === 'automatico'
                ? ' A próxima faixa será reservada automaticamente.'
                : ` Faixa ${batchStartNumber ? formatSequentialNumber(batchStartNumber, 0) : '-'} até ${batchStartNumber ? formatSequentialNumber(batchStartNumber, (batchDirection === 'crescente' ? 1 : -1) * (Math.max(1, Math.min(200, Number(batchQuantity) || 1)) - 1)) : '-'}.`}
            </div>

            {validationError && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300">
                {validationError}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setIsBatchModalOpen(false)} disabled={isBatchPrinting} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-750 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={handleGenerateBatchTickets} disabled={isBatchPrinting} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                {isBatchPrinting ? 'Gerando PDF...' : batchSaveDrafts ? 'Gerar PDF e salvar para editar' : 'Gerar somente o PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewingTicket && viewingPair && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-3 md:p-6" onClick={() => setViewingTicket(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-6xl w-full max-h-[96vh] flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div><h3 className="text-sm font-black text-white">Visualização para impressão</h3><p className="text-[10px] text-slate-500">Ticket {viewingTicket.ticketNumero} no padrão operacional RENEA</p></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handlePrintTicket(viewingTicket)} className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"><Printer className="w-4 h-4" /> Imprimir / PDF</button>
                <button type="button" onClick={() => setViewingTicket(null)} title="Fechar visualização" className="h-9 w-9 grid place-items-center rounded-md border border-slate-700 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="overflow-auto bg-slate-800 p-3">
              <TicketDocumentPreview releaseTicket={viewingPair.releaseTicket} receiptTicket={viewingPair.receiptTicket} />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-slate-300">Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2.5">
              <button onClick={() => { onDeleteTicket(deleteConfirmId); setDeleteConfirmId(null); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl cursor-pointer">Excluir</button>
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl cursor-pointer">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

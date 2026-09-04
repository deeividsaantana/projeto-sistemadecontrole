/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
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
  FilePenLine,
  SlidersHorizontal,
  ChevronDown,
  CalendarDays,
  ListChecks,
  RotateCcw,
  FileText,
  Download,
  Layers3
} from 'lucide-react';
import type ExcelJS from 'exceljs';
import { createCorporateWorkbook, downloadCorporateWorkbook, loadValidatedWorkbook } from '../utils/excelCorporate';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import { baseTicketNumber, buildTicketNumberSequence, normalizeTicketNumber } from '../utils/ticketNumberSequence';
import { buildDuplicateTicketKeys, isDuplicateTicket, ticketDuplicateKey } from '../utils/ticketDuplicateDetection';
import { buildTicketSpreadsheetWorkbook } from '../utils/ticketSpreadsheetExport';
import { buildJazidaDailyControl, getTicketControlDate, isTicketReturned } from '../utils/jazidaDailyControl';
import { buildTravelOperationControl, formatTravelDuration } from '../utils/travelOperations';
import { isReneaStoredValueValid, parseReneaStoredJson } from '../utils/resilientStorage';
import { writeStorageValue } from '../data/localStore';
import { stageTravelDataset } from '../services/masterDataApi';
import { getSecurePublicTicketLink } from '../publicApi';
import type { jsPDF } from 'jspdf';
import { loadJsPdf } from '../utils/pdfLoader';
import {
  Equipamento,
  ObraLocal,
  TicketJazida,
  TipoMaterialJazida,
  DestinoObraJazida,
  EmpresaTicketJazida,
  TipoTicketJazida,
} from '../types';
import reneaLogoFull from '../assets/images/renea_logo_new.png';
import spmarLogo from '../assets/images/spmar_logo.png';

interface TicketsJazidaTabProps {
  tickets: TicketJazida[];
  equipamentos: Equipamento[];
  obras: ObraLocal[];
  onSaveTicket: (item: TicketJazida, isNew: boolean) => void;
  onDeleteTicket: (id: string) => void;
  onDeleteTickets: (ids: string[]) => void;
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
const normalizeMasterLabel = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const normalizeEquipmentKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const equipmentPlate = (equipment: Equipamento) => (equipment.placa || equipment.seriePlaca || '').trim().toUpperCase();

type PrintedTicketBatch = {
  id: string;
  inicio: number;
  fim: number;
  criadoEm: string;
  numeros?: string[];
  modo?: 'Em branco' | 'Pré-preenchido';
};

const TicketSingleDocument = ({ ticket }: { ticket: TicketJazida }) => {
  const isReceipt = (ticket.tipoTicket || 'Liberação') === 'Recebimento';
  const blankPrint = ticket.impressaoEmBranco === true;
  const material = blankPrint ? '' : ticket.tipoMaterial === 'Outros' ? ticket.materialOutro || 'Outros' : ticket.tipoMaterial;
  const destination = blankPrint ? '' : ticket.destinoObra === 'Outros' ? ticket.destinoOutro || 'Outros' : ticket.destinoObra;
  const materials = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Outros'];
  const field = (label: string, value: React.ReactNode, className = '') => (
    <div className={`min-h-14 border-r border-b border-[#cfd7d1] p-2 ${className}`}>
      <div className="text-[9px] font-bold uppercase text-[#53605a]">{label}</div>
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
          <div><h2 className="text-base font-bold uppercase">Ticket de {isReceipt ? 'Recebimento - Obra' : 'Liberação - Jazida'}</h2><p className="mt-1 text-[10px] text-[#53605a]">Rodoanel Mário Covas · Alça Trecho Leste</p></div>
        </div>
        <div className="h-24 border-r border-b border-[#cfd7d1] p-2">
          <div className="text-[9px] font-bold uppercase text-[#53605a]">Ticket Nº</div>
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
        <div className="text-[9px] font-bold uppercase text-[#53605a]">Tipo de material</div>
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
        <div className="text-[9px] font-bold uppercase text-[#53605a]">Carga conforme?</div>
        <div className="mt-3 flex gap-12 text-xs"><span className="flex items-center gap-2"><i className={`not-italic h-4 w-4 border border-[#d7ded9] grid place-items-center font-bold ${!blankPrint && ticket.cargaConforme === true ? 'bg-white text-[#14231e]' : ''}`}>{!blankPrint && ticket.cargaConforme === true ? 'X' : ''}</i>Sim</span><span className="flex items-center gap-2"><i className={`not-italic h-4 w-4 border border-[#d7ded9] grid place-items-center font-bold ${!blankPrint && ticket.cargaConforme === false ? 'bg-white text-[#14231e]' : ''}`}>{!blankPrint && ticket.cargaConforme === false ? 'X' : ''}</i>Não</span></div>
      </div>

      <div className="border-l border-r border-b border-[#cfd7d1] p-3 min-h-24">
        <div className="text-[9px] font-bold uppercase text-[#53605a]">Divergências / observações</div>
        <p className="mt-3 text-xs leading-relaxed">{blankPrint ? '' : ticket.observacao || 'Sem observações.'}</p>
      </div>

      <div className="grid grid-cols-2 border-l border-[#cfd7d1]">
        <div className="min-h-28 border-r border-b border-[#cfd7d1] p-3">
          <div className="text-[9px] font-bold uppercase text-[#53605a]">Assinatura - {isReceipt ? 'Recebedor' : 'Responsável pela liberação'}</div>
          {!blankPrint && ticket.assinaturaDigital && <img src={ticket.assinaturaDigital} alt="Assinatura digital" className="mx-auto h-14 max-w-[80%] object-contain" />}
          <div className="mt-1 border-t border-[#cfd7d1] pt-1 text-center text-[10px]">{blankPrint ? '' : ticket.nomeLegivel || ticket.responsavelLiberacao || 'Nome legível'}</div>
        </div>
        <div className="min-h-28 border-r border-b border-[#cfd7d1] p-3 flex flex-col justify-end">
          <div className="border-t border-[#cfd7d1] pt-1 text-center text-[10px]">Assinatura - Conferente da obra / Nome legível</div>
        </div>
      </div>
      <div className="border-x border-b border-[#cfd7d1] py-1 text-center text-[7px] uppercase text-[#65716b]">Via de {ticket.tipoTicket || 'Liberação'} | Documento digital RENEA</div>
    </div>
  );
};

const TicketDocumentPreview = ({ releaseTicket, receiptTicket }: { releaseTicket: TicketJazida; receiptTicket: TicketJazida }) => (
  <div className="aspect-[210/297] min-w-[760px] w-full overflow-hidden bg-white p-3 shadow-lg" id="ticket-print-preview">
    <div className="flex h-full flex-col justify-between">
      <TicketSingleDocument ticket={releaseTicket} />
      <div className="relative border-t border-dashed border-[#cfd7d1]"><span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[7px] uppercase text-[#65716b]">Linha de corte</span></div>
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
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.text('Rodoanel Mário Covas · Alça Trecho Leste', left + 60, top + 13);
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
  const doc = new (await loadJsPdf())('p', 'mm', 'a4');
  const logo = await loadTicketLogo();
  drawTicketPairOnPdf(doc, releaseTicket, receiptTicket, logo);
  doc.save(`ticket_liberacao_recebimento_${releaseTicket.ticketNumero}.pdf`);
};

const generateTicketBookPdf = async (
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

export default function TicketsJazidaTab({
  tickets,
  equipamentos,
  obras,
  onSaveTicket,
  onDeleteTicket,
  onDeleteTickets,
  onImportTickets,
  onReserveTicketNumber,
  onReserveTicketNumbers,
}: TicketsJazidaTabProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
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
  const [batchStep, setBatchStep] = useState(10);
  const [batchNumberMode, setBatchNumberMode] = useState<'automatico' | 'manual'>('manual');
  const [batchDirection, setBatchDirection] = useState<'crescente' | 'decrescente'>('crescente');
  const [batchFillMode, setBatchFillMode] = useState<'em-branco' | 'pre-preenchido'>('em-branco');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchPrefixo, setBatchPrefixo] = useState('');
  const [batchPlaca, setBatchPlaca] = useState('');
  const [batchTipoMaterial, setBatchTipoMaterial] = useState<TipoMaterialJazida>('Solo');
  const [batchQuantidadeM3, setBatchQuantidadeM3] = useState<number>(1);
  const [batchDestinoObra, setBatchDestinoObra] = useState<DestinoObraJazida>('Marginal');
  const [batchEmpresa, setBatchEmpresa] = useState<EmpresaTicketJazida>('RENEA');
  const [printedBatches, setPrintedBatches] = useState<PrintedTicketBatch[]>(() => {
    const key = 'renea_jazida_printed_batches';
    const saved = localStorage.getItem(key) || localStorage.getItem('jazidaPrintedTicketBatches');
    return isReneaStoredValueValid(key, saved)
      ? parseReneaStoredJson<PrintedTicketBatch[]>(saved, [])
      : [];
  });
  const [controlDate, setControlDate] = useState(new Date().toISOString().split('T')[0]);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [noteModalNumber, setNoteModalNumber] = useState<string | null>(null);
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
  const [notaFiscalNumero, setNotaFiscalNumero] = useState('');
  const [notaFiscalData, setNotaFiscalData] = useState('');
  const [notaFiscalObservacao, setNotaFiscalObservacao] = useState('');
  const [advancedFormOpen, setAdvancedFormOpen] = useState(false);

  const equipmentByPrefix = useMemo(() => {
    const priority = (item: Equipamento) => item.status === 'Ativo' || item.status === 'Mobilizado' ? 0 : 1;
    const sorted = [...equipamentos].sort((a, b) => priority(a) - priority(b));
    const index = new Map<string, Equipamento>();
    sorted.forEach(item => {
      const key = normalizeEquipmentKey(item.prefixo);
      if (key && !index.has(key)) index.set(key, item);
    });
    return index;
  }, [equipamentos]);

  const equipmentOptions = useMemo(() => [...equipmentByPrefix.values()]
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR')), [equipmentByPrefix]);

  const findEquipmentByPrefix = (value: string) => equipmentByPrefix.get(normalizeEquipmentKey(value));
  const locationByName = useMemo(() => new Map(
    obras.map(item => [normalizeMasterLabel(item.nome), item]),
  ), [obras]);
  const materialOptions = useMemo(() => [...new Set(TIPOS_MATERIAL)], []);
  const destinationOptions = useMemo(() => [...new Set([
    ...DESTINOS_OBRA,
    ...obras.map(item => item.nome),
  ])], [obras]);
  const originLocationId = useMemo(() => obras.find(item =>
    normalizeMasterLabel(item.nome).includes('JAZIDA')
    && normalizeMasterLabel(item.nome).includes('SABESP')
  )?.id, [obras]);
  const resolveDestinationIds = (value: string) => ({
    localDestinoId: locationByName.get(normalizeMasterLabel(value))?.id,
  });

  const fillEquipmentFields = (equipment?: Equipamento) => {
    if (!equipment) return false;
    setPrefixo(equipment.prefixo.toUpperCase());
    setPlaca(equipmentPlate(equipment));
    setFamiliaEquipamento(equipment.tipo || '');
    setEquipamentoNome(equipment.nome || '');
    return true;
  };

  const handlePrefixChange = (value: string) => {
    const normalizedValue = value.toUpperCase();
    setPrefixo(normalizedValue);
    const equipment = findEquipmentByPrefix(normalizedValue);
    if (equipment) fillEquipmentFields(equipment);
    else {
      setPlaca('');
      setFamiliaEquipamento('');
      setEquipamentoNome('');
    }
  };

  const handleBatchPrefixChange = (value: string) => {
    const normalizedValue = value.toUpperCase();
    setBatchPrefixo(normalizedValue);
    const equipment = findEquipmentByPrefix(normalizedValue);
    if (equipment) {
      setBatchPrefixo(equipment.prefixo.toUpperCase());
      setBatchPlaca(equipmentPlate(equipment));
    } else {
      setBatchPlaca('');
    }
  };

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
    setNotaFiscalNumero('');
    setNotaFiscalData('');
    setNotaFiscalObservacao('');
    setAdvancedFormOpen(false);
  };

  const handleOpenCreate = () => {
    resetFormFields();
    setOperationsOpen(true);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (t: TicketJazida) => {
    const registeredEquipment = findEquipmentByPrefix(t.prefixo);
    setEditingId(t.id);
    setValidationError('');
    setTipoTicket(t.tipoTicket || 'Liberação');
    setData(t.data);
    setTicketNumero(t.ticketNumero);
    setPrefixo(t.prefixo);
    setPlaca(t.placa || (registeredEquipment ? equipmentPlate(registeredEquipment) : ''));
    setFamiliaEquipamento(t.familiaEquipamento || registeredEquipment?.tipo || '');
    setEquipamentoNome(t.equipamentoNome || registeredEquipment?.nome || '');
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
    setNotaFiscalNumero(t.notaFiscalNumero || '');
    setNotaFiscalData(t.notaFiscalData || '');
    setNotaFiscalObservacao(t.notaFiscalObservacao || '');
    setAdvancedFormOpen(Boolean(t.observacao || t.notaFiscalNumero || t.notaFiscalData || t.notaFiscalObservacao));
    setOperationsOpen(true);
    setIsFormOpen(true);
  };

  const findLiberacaoByTicketNumero = (numero: string) => tickets.find(t =>
    (t.tipoTicket || 'Liberação') === 'Liberação' &&
    normalizeTicketNumber(t.ticketNumero) === normalizeTicketNumber(numero)
  );

  const applyLiberacaoCloneToForm = (numero: string, force = false) => {
    const liberacao = findLiberacaoByTicketNumero(numero);
    if (!liberacao) return false;
    const registeredEquipment = findEquipmentByPrefix(liberacao.prefixo);

    if (force || !prefixo.trim()) setPrefixo(liberacao.prefixo);
    if (force || !placa.trim()) setPlaca(liberacao.placa || (registeredEquipment ? equipmentPlate(registeredEquipment) : ''));
    if (force || !familiaEquipamento.trim()) setFamiliaEquipamento(liberacao.familiaEquipamento || registeredEquipment?.tipo || '');
    if (force || !equipamentoNome.trim()) setEquipamentoNome(liberacao.equipamentoNome || registeredEquipment?.nome || '');
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

    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const saveMode = submitter?.value === 'draft' ? 'draft' : 'complete';

    if (!ticketNumero.trim()) { setValidationError('Informe o Nº do Ticket.'); return; }
    if (!data) { setValidationError('Informe a Data.'); return; }
    if (saveMode === 'complete') {
      if (!prefixo.trim()) { setValidationError('Para concluir, informe o Prefixo. Se ainda não souber, use “Salvar rascunho”.'); return; }
      if (!placa.trim()) { setValidationError('Para concluir, informe a Placa. Se ainda não souber, use “Salvar rascunho”.'); return; }
      if (tipoTicket === 'Recebimento' && !horaChegada) { setValidationError('Para concluir, informe a Hora de Chegada.'); return; }
      if (tipoTicket === 'Liberação' && !horaSaida) { setValidationError('Para concluir, informe a Hora de Saída.'); return; }
      if (!tipoMaterial) { setValidationError('Para concluir, selecione o Tipo de Material.'); return; }
      if (!quantidadeM3 || quantidadeM3 <= 0) { setValidationError('Para concluir, a quantidade deve ser maior que zero.'); return; }
      if (destinoObra === 'Outros' && !destinoOutro.trim()) { setValidationError('Para concluir, informe o destino ou ramo de descarga.'); return; }
    }

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
    const selectedEquipment = findEquipmentByPrefix(prefixo);
    const destinationLabel = destinoObra === 'Outros' ? destinoOutro.trim() : destinoObra;
    const destinationIds = resolveDestinationIds(destinationLabel);

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
      status: saveMode === 'draft' ? 'Pendente' : 'OK',
      statusFluxo: saveMode === 'draft' ? 'Rascunho' : 'Enviado',
      unidadeQuantidade: existing?.unidadeQuantidade || 'm³',
      origemRegistro: existing?.origemRegistro || 'Admin',
      enviadoEm: saveMode === 'draft' ? undefined : existing?.enviadoEm || now,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
      devolvidoEm: saveMode === 'draft' ? undefined : existing?.devolvidoEm || now,
      conferidoPor: saveMode === 'draft' ? undefined : existing?.conferidoPor || 'Admin',
      notaFiscalNumero: notaFiscalNumero.trim(),
      notaFiscalData,
      notaFiscalObservacao: notaFiscalObservacao.trim(),
      impressaoEmBranco: false,
      ocultarNumeroImpressao: false,
      equipamentoId: selectedEquipment?.id || existing?.equipamentoId,
      localOrigemId: originLocationId || existing?.localOrigemId,
      localDestinoId: destinationIds.localDestinoId || existing?.localDestinoId,
    }, isNew);

    setImportMessage(saveMode === 'draft'
      ? `Ticket Nº ${normalizedTicketNumber} salvo como rascunho. Você pode continuar depois sem perder os dados.`
      : `Ticket Nº ${normalizedTicketNumber} concluído e marcado como devolvido.`);
    setIsFormOpen(false);
    resetFormFields();
  };

  const handleMoveTicketToDraft = (ticket: TicketJazida) => {
    const now = new Date().toISOString();
    onSaveTicket({
      ...ticket,
      status: 'Pendente',
      statusFluxo: 'Rascunho',
      enviadoEm: undefined,
      devolvidoEm: undefined,
      conferidoPor: undefined,
      atualizadoEm: now,
    }, false);
    setImportMessage(`Ticket Nº ${ticket.ticketNumero} voltou para rascunho e saiu da contagem de vias devolvidas.`);
  };

  const q = searchQuery.toLowerCase().trim();
  const duplicateTicketKeys = useMemo(() => buildDuplicateTicketKeys(tickets), [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const tipo = t.tipoTicket || 'Liberação';
      if (tipo !== ticketTab) return false;
      const flowStatus = t.statusFluxo || 'Enviado';
      const qualityStatus = isDuplicateTicket(t, duplicateTicketKeys) ? 'Duplicado' : t.status || 'OK';
      if (fDataInicial && t.data < fDataInicial) return false;
      if (fDataFinal && t.data > fDataFinal) return false;
      if (fTicketNumero && !t.ticketNumero.toLowerCase().includes(fTicketNumero.toLowerCase())) return false;
      if (fPrefixo && !t.prefixo.toLowerCase().includes(fPrefixo.toLowerCase())) return false;
      if (fPlaca && !t.placa.toLowerCase().includes(fPlaca.toLowerCase())) return false;
      if (fTipoMaterial && t.tipoMaterial !== fTipoMaterial) return false;
      if (fDestinoObra && t.destinoObra !== fDestinoObra) return false;
      if (fEmpresa && t.empresa !== fEmpresa) return false;
      if (fStatus && !([String(flowStatus), String(qualityStatus)].includes(fStatus))) return false;

      if (q) {
        const haystack = [
          t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
          t.tipoMaterial, t.destinoObra, t.destinoOutro, t.estaca, t.empresa, t.responsavelLiberacao,
          t.nomeLegivel, t.observacao, t.notaFiscalNumero, t.notaFiscalData, t.notaFiscalObservacao, t.data
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data) || (b.horaChegada || b.horaSaida || '').localeCompare(a.horaChegada || a.horaSaida || ''));
  }, [tickets, ticketTab, fDataInicial, fDataFinal, fTicketNumero, fPrefixo, fPlaca, fTipoMaterial, fDestinoObra, fEmpresa, fStatus, q, duplicateTicketKeys]);

  const resumo = useMemo(() => {
    const totalTickets = filteredTickets.length;
    const totalM3 = filteredTickets
      .filter(ticket => (ticket.unidadeQuantidade || 'm³') === 'm³')
      .reduce((sum, ticket) => sum + (Number(ticket.quantidadeM3) || 0), 0);
    const totalCacambas = filteredTickets
      .filter(ticket => ticket.unidadeQuantidade === 'caçamba')
      .reduce((sum, ticket) => sum + (Number(ticket.quantidadeM3) || 0), 0);
    const okCount = filteredTickets.filter(t => !isDuplicateTicket(t, duplicateTicketKeys) && (t.status || 'OK') === 'OK').length;
    const pendCount = filteredTickets.filter(t => !isDuplicateTicket(t, duplicateTicketKeys) && (t.status || 'OK') === 'Pendente').length;
    const dupCount = filteredTickets.filter(t => isDuplicateTicket(t, duplicateTicketKeys)).length;
    return { totalTickets, totalM3, totalCacambas, okCount, pendCount, dupCount };
  }, [filteredTickets, duplicateTicketKeys]);

  const formatSequentialNumber = (start: string, offset: number) => {
    const base = baseTicketNumber(start);
    if (!Number.isFinite(base)) return '';
    return normalizeTicketNumber(base + offset);
  };

  const buildBatchTicket = (number: string, type: TipoTicketJazida, batchId: string, createdAt: string): TicketJazida => {
    const blank = batchFillMode === 'em-branco';
    const selectedEquipment = findEquipmentByPrefix(batchPrefixo);
    const destinationIds = resolveDestinationIds(batchDestinoObra);
    return {
      id: `ticket-lote-${type === 'Liberação' ? 'lib' : 'rec'}-${number}-${Date.now()}`,
      data: batchDate,
      tipoTicket: type,
      ticketNumero: number,
      prefixo: blank ? '' : batchPrefixo.trim().toUpperCase(),
      placa: blank ? '' : batchPlaca.trim().toUpperCase(),
      familiaEquipamento: blank ? '' : selectedEquipment?.tipo || '',
      equipamentoNome: blank ? '' : selectedEquipment?.nome || '',
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
      criadoEm: createdAt,
      atualizadoEm: createdAt,
      impressaoEmBranco: blank,
      ocultarNumeroImpressao: false,
      loteImpressaoId: batchId,
      loteImpressaoCriadoEm: createdAt,
      equipamentoId: blank ? undefined : selectedEquipment?.id,
      localOrigemId: blank ? undefined : originLocationId,
      localDestinoId: blank ? undefined : destinationIds.localDestinoId,
    };
  };

  const openBatchModal = () => {
    setBatchStartNumber('');
    setBatchQuantity(10);
    setBatchStep(10);
    setBatchNumberMode('manual');
    setBatchDirection('crescente');
    setBatchFillMode('em-branco');
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
    const step = Math.max(1, Math.floor(Number(batchStep) || 1));
    if (batchNumberMode === 'manual' && !batchStartNumber.trim()) {
      setValidationError('Informe o primeiro número da sequência.');
      return;
    }
    if (!batchDate) {
      setValidationError('Informe a data de controle do lote.');
      return;
    }

    setIsBatchPrinting(true);
    try {
      const reserved = batchNumberMode === 'automatico'
        ? await onReserveTicketNumbers(quantity)
        : buildTicketNumberSequence(batchStartNumber, quantity, step, batchDirection);
      const numbers = reserved.filter(Boolean);
      if (numbers.length !== quantity) throw new Error('Faixa de numeração inválida.');
      const batchId = `lote-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const pairs = numbers.map(number => ({
        releaseTicket: buildBatchTicket(number, 'Liberação', batchId, createdAt),
        receiptTicket: buildBatchTicket(number, 'Recebimento', batchId, createdAt),
      }));
      const fileMode = batchFillMode === 'em-branco' ? 'em_branco' : 'pre_preenchidos';
      await generateTicketBookPdf(pairs, `tickets_${fileMode}_${numbers[0]}_${numbers[numbers.length - 1]}.pdf`);

      const existingKeys = new Set(tickets.map(ticket =>
        `${normalizeTicketNumber(ticket.ticketNumero)}|${ticket.tipoTicket || 'Liberação'}`
      ));
      const drafts = pairs
        .flatMap(pair => [pair.releaseTicket, pair.receiptTicket]);
      const collisionCount = drafts.filter(ticket => existingKeys.has(`${ticket.ticketNumero}|${ticket.tipoTicket || 'Liberação'}`)).length;
      onImportTickets(drafts);

      const bases = numbers.map(baseTicketNumber).filter(Number.isFinite);
      const novoLote: PrintedTicketBatch = {
        id: batchId,
        inicio: Math.min(...bases),
        fim: Math.max(...bases),
        numeros: numbers,
        modo: batchFillMode === 'em-branco' ? 'Em branco' : 'Pré-preenchido',
        criadoEm: createdAt,
      };
      setPrintedBatches(prev => {
        const next = [novoLote, ...prev];
        writeStorageValue(localStorage, 'renea_jazida_printed_batches', JSON.stringify(next));
        return next;
      });
      setControlDate(batchDate);
      setImportMessage(`${numbers.length} número(s) impressos em duas vias e registrados automaticamente na conferência diária.${collisionCount ? ` ${collisionCount} via(s) repetida(s) foram preservadas e sinalizadas para conferência.` : ''}`);
      setIsBatchModalOpen(false);
    } catch (err) {
      console.error('Erro ao gerar tickets sequenciais:', err);
      setValidationError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF da sequência.');
    } finally {
      setIsBatchPrinting(false);
    }
  };

  const synchronizedBatches = useMemo(() => {
    const grouped = new Map<string, { criadoEm: string; numeros: Set<string>; modo: PrintedTicketBatch['modo'] }>();
    tickets.forEach(ticket => {
      if (!ticket.loteImpressaoId) return;
      const current = grouped.get(ticket.loteImpressaoId) || {
        criadoEm: ticket.loteImpressaoCriadoEm || ticket.criadoEm || new Date().toISOString(),
        numeros: new Set<string>(),
        modo: ticket.impressaoEmBranco ? 'Em branco' as const : 'Pré-preenchido' as const,
      };
      const numero = normalizeTicketNumber(ticket.ticketNumero);
      if (numero) current.numeros.add(numero);
      grouped.set(ticket.loteImpressaoId, current);
    });
    return Array.from(grouped.entries()).map(([id, batch]): PrintedTicketBatch => {
      const numeros = Array.from(batch.numeros).sort((a, b) => Number(a) - Number(b));
      const bases = numeros.map(baseTicketNumber).filter(Number.isFinite);
      return {
        id,
        criadoEm: batch.criadoEm,
        numeros,
        inicio: bases.length ? Math.min(...bases) : 0,
        fim: bases.length ? Math.max(...bases) : 0,
        modo: batch.modo,
      };
    });
  }, [tickets]);

  const allPrintedBatches = useMemo(() => {
    const grouped = new Map<string, PrintedTicketBatch>();
    printedBatches.forEach(batch => grouped.set(batch.id, batch));
    synchronizedBatches.forEach(batch => grouped.set(batch.id, batch));
    return Array.from(grouped.values()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [printedBatches, synchronizedBatches]);

  // O rascunho representa uma via impressa aguardando retorno. Só uma devolução
  // conferida conta no painel, evitando o falso positivo da versão anterior.
  const ticketCompletionIndex = useMemo(() => {
    const index = new Map<string, { liberacao: boolean; recebimento: boolean }>();
    tickets.forEach(ticket => {
      const numero = baseTicketNumber(ticket.ticketNumero);
      if (!Number.isFinite(numero)) return;
      const keys = [`*|${numero}`, `${ticket.loteImpressaoId || '*'}|${numero}`];
      keys.forEach(key => {
        const status = index.get(key) || { liberacao: false, recebimento: false };
        if ((ticket.tipoTicket || 'Liberação') === 'Liberação') status.liberacao ||= isTicketReturned(ticket);
        else status.recebimento ||= isTicketReturned(ticket);
        index.set(key, status);
      });
    });
    return index;
  }, [tickets]);

  const ticketControlRows = useMemo(() => allPrintedBatches.map(batch => {
    const numbers = batch.numeros?.length
      ? batch.numeros.map(baseTicketNumber).filter(Number.isFinite)
      : Array.from({ length: Math.max(0, batch.fim - batch.inicio + 1) }, (_, index) => batch.inicio + index);
    const total = numbers.length;
    let liberacoes = 0;
    let recebimentos = 0;
    let completas = 0;

    for (const numero of numbers) {
      const status = ticketCompletionIndex.get(`${batch.id}|${numero}`) || ticketCompletionIndex.get(`*|${numero}`);
      if (!status) continue;
      if (status.liberacao) liberacoes += 1;
      if (status.recebimento) recebimentos += 1;
      if (status.liberacao && status.recebimento) completas += 1;
    }

    return {
      ...batch,
      displayStart: numbers[0] ?? batch.inicio,
      displayEnd: numbers.at(-1) ?? batch.fim,
      total,
      liberacoes,
      recebimentos,
      completas,
      pendentes: total - completas,
    };
  }), [allPrintedBatches, ticketCompletionIndex]);

  const ticketControlTotals = useMemo(() => ticketControlRows.reduce((totals, row) => ({
    total: totals.total + row.total,
    liberacoes: totals.liberacoes + row.liberacoes,
    recebimentos: totals.recebimentos + row.recebimentos,
    completas: totals.completas + row.completas,
    pendentes: totals.pendentes + row.pendentes,
  }), { total: 0, liberacoes: 0, recebimentos: 0, completas: 0, pendentes: 0 }), [ticketControlRows]);

  const dailyControl = useMemo(() => buildJazidaDailyControl(tickets, controlDate), [tickets, controlDate]);
  const dailyDuplicateCount = useMemo(() => tickets.filter(ticket =>
    getTicketControlDate(ticket) === controlDate && isDuplicateTicket(ticket, duplicateTicketKeys)
  ).length, [tickets, controlDate, duplicateTicketKeys]);
  const travelControl = useMemo(() => buildTravelOperationControl(tickets), [tickets]);
  const travelReviewRows = useMemo(() => travelControl.operations
    .filter(operation => operation.status !== 'Conferido')
    .sort((left, right) => {
      const priority = ['Ticket duplicado', 'Divergência', 'Sem recebimento', 'Sem liberação'];
      return priority.indexOf(left.status) - priority.indexOf(right.status)
        || right.ticketNumber.localeCompare(left.ticketNumber, 'pt-BR', { numeric: true });
    })
    .slice(0, 12), [travelControl]);

  const formatEventDateTime = (value: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
  };

  const buildMissingControlTicket = (numero: string, type: TipoTicketJazida): TicketJazida => {
    const row = dailyControl.rows.find(item => item.numero === numero);
    const shared = row?.liberacao || row?.recebimento;
    const now = new Date().toISOString();
    return {
      ...(shared || {}),
      id: `ticket-checklist-${type === 'Liberação' ? 'lib' : 'rec'}-${numero}-${Date.now()}`,
      data: shared?.data || controlDate,
      tipoTicket: type,
      ticketNumero: numero,
      prefixo: shared?.prefixo || '',
      placa: shared?.placa || '',
      horaSaida: shared?.horaSaida || '',
      horaChegada: type === 'Recebimento' ? shared?.horaChegada || '' : undefined,
      tipoMaterial: shared?.tipoMaterial || 'Solo',
      quantidadeM3: shared?.quantidadeM3 || 0,
      destinoObra: shared?.destinoObra || 'Jazida',
      responsavelLiberacao: shared?.responsavelLiberacao || '',
      nomeLegivel: shared?.nomeLegivel || '',
      empresa: shared?.empresa || 'RENEA',
      observacao: shared?.observacao || '',
      status: 'Pendente',
      statusFluxo: 'Rascunho',
      origemRegistro: 'Admin',
      criadoEm: row?.criadoEm || now,
      atualizadoEm: now,
      loteImpressaoId: row?.loteId,
      loteImpressaoCriadoEm: row?.criadoEm,
    };
  };

  const handleToggleTicketReturn = (numero: string, type: TipoTicketJazida) => {
    const row = dailyControl.rows.find(item => item.numero === numero);
    const current = type === 'Liberação' ? row?.liberacao : row?.recebimento;
    const base = current || buildMissingControlTicket(numero, type);
    const returned = isTicketReturned(current);
    const now = new Date().toISOString();
    onImportTickets([{
      ...base,
      status: returned ? 'Pendente' : 'OK',
      statusFluxo: returned ? 'Rascunho' : 'Enviado',
      devolvidoEm: returned ? undefined : now,
      enviadoEm: returned ? base.enviadoEm : base.enviadoEm || now,
      atualizadoEm: now,
      conferidoPor: returned ? undefined : base.conferidoPor || 'Admin',
    }]);
  };

  const handleSetAllReturns = (type: TipoTicketJazida, returned: boolean) => {
    const now = new Date().toISOString();
    const updates = dailyControl.rows.flatMap(row => {
      const current = type === 'Liberação' ? row.liberacao : row.recebimento;
      if (isTicketReturned(current) === returned) return [];
      const base = current || buildMissingControlTicket(row.numero, type);
      return [{
        ...base,
        status: returned ? 'OK' as const : 'Pendente' as const,
        statusFluxo: returned ? 'Enviado' as const : 'Rascunho' as const,
        devolvidoEm: returned ? now : undefined,
        enviadoEm: returned ? base.enviadoEm || now : base.enviadoEm,
        atualizadoEm: now,
        conferidoPor: returned ? base.conferidoPor || 'Admin' : undefined,
      }];
    });
    if (updates.length) onImportTickets(updates);
  };

  const handleClearAllReturns = () => {
    const now = new Date().toISOString();
    const updates = dailyControl.rows.flatMap(row => [row.liberacao, row.recebimento]
      .filter((ticket): ticket is TicketJazida => Boolean(ticket && isTicketReturned(ticket)))
      .map(ticket => ({
        ...ticket,
        status: 'Pendente' as const,
        statusFluxo: 'Rascunho' as const,
        devolvidoEm: undefined,
        conferidoPor: undefined,
        atualizadoEm: now,
      })));
    if (updates.length) onImportTickets(updates);
  };

  const handleOpenNoteModal = (numero: string) => {
    const row = dailyControl.rows.find(item => item.numero === numero);
    const source = row?.recebimento || row?.liberacao;
    setNotaFiscalNumero(source?.notaFiscalNumero || '');
    setNotaFiscalData(source?.notaFiscalData || '');
    setNotaFiscalObservacao(source?.notaFiscalObservacao || '');
    setNoteModalNumber(numero);
  };

  const handleSaveNoteModal = () => {
    if (!noteModalNumber) return;
    const row = dailyControl.rows.find(item => item.numero === noteModalNumber);
    const now = new Date().toISOString();
    const updates = [row?.liberacao, row?.recebimento]
      .filter((ticket): ticket is TicketJazida => Boolean(ticket))
      .map(ticket => ({
        ...ticket,
        notaFiscalNumero: notaFiscalNumero.trim(),
        notaFiscalData,
        notaFiscalObservacao: notaFiscalObservacao.trim(),
        atualizadoEm: now,
      }));
    if (updates.length) onImportTickets(updates);
    setNoteModalNumber(null);
    setImportMessage(`Nota do Ticket Nº ${noteModalNumber} atualizada nas duas vias.`);
  };

  const exportTicketControlExcel = async () => {
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

  const exportTicketControlPdf = async () => {
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

  const exportTicketControlCsv = () => {
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

  const copyPublicLink = async () => {
    try {
      const link = await getSecurePublicTicketLink();
      await navigator.clipboard.writeText(link);
      setLinkMessage('Link protegido copiado.');
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : 'Não foi possível gerar o link protegido.');
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
      const seen = new Set(tickets.filter(item => normalizeTicketNumber(item.ticketNumero)).map(ticketDuplicateKey));

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
          const equipamentoEncontrado = findEquipmentByPrefix(prefixoImportado);
          const quantidadeImportada = parseNumberValue(getValue(row, 'quantidadeM3'));
          const materialImportado = getValue(row, 'tipoMaterial');
          const destinoImportado = getValue(row, tipo === 'Recebimento' ? 'ramoDescarga' : 'destinoObra');
          const hasRecognizedValue = Boolean(
            dataImportada || ticketImportado || prefixoImportado || placaImportada || quantidadeImportada || materialImportado || destinoImportado
          );
          if (!hasRecognizedValue) {
            ignored += 1;
            return;
          }
          const key = ticketImportado ? `${tipo}|${normalizeTicketNumber(ticketImportado)}` : '';
          const duplicate = Boolean(key && seen.has(key));
          if (key) seen.add(key);
          const hora = parseTimeValue(getValue(row, tipo === 'Recebimento' ? 'horaChegada' : 'horaSaida')) || '00:00';
          const materialNormalizado = normalizeMaterialValue(materialImportado);
          const destinoNormalizado = normalizeDestinoValue(destinoImportado);
          const destinationIds = resolveDestinationIds(destinoNormalizado);
          const missingFields = [
            !dataImportada && 'data',
            !ticketImportado && 'número',
            !prefixoImportado && 'prefixo',
            !quantidadeImportada && 'quantidade',
          ].filter(Boolean) as string[];
          const reviewNotes = [
            `Importado de ${file.name} / ${ws.name} / linha ${rowNumber}`,
            duplicate ? 'Possível duplicidade preservada para conferência.' : '',
            missingFields.length ? `Campos pendentes: ${missingFields.join(', ')}.` : '',
          ].filter(Boolean);
          imported.push({
            id: `ticket-import-${Date.now()}-${rowNumber}-${imported.length}`,
            data: dataImportada || '',
            tipoTicket: tipo,
            ticketNumero: ticketImportado ? normalizeTicketNumber(ticketImportado) : '',
            prefixo: prefixoImportado,
            placa: placaImportada || (equipamentoEncontrado ? equipmentPlate(equipamentoEncontrado) : ''),
            familiaEquipamento: String(getValue(row, 'familiaEquipamento') || equipamentoEncontrado?.tipo || '').trim(),
            equipamentoNome: String(getValue(row, 'equipamentoNome') || equipamentoEncontrado?.nome || '').trim(),
            horaChegada: tipo === 'Recebimento' ? hora : undefined,
            horaSaida: tipo === 'Liberação' ? hora : '',
            tipoMaterial: materialNormalizado,
            quantidadeM3: quantidadeImportada,
            destinoObra: destinoNormalizado,
            estaca: tipo === 'Recebimento' ? String(getValue(row, 'estaca') || '').trim() : '',
            responsavelLiberacao: '',
            nomeLegivel: '',
            empresa: normalizeEmpresaValue(getValue(row, 'empresa')),
            observacao: reviewNotes.join(' | '),
            status: duplicate ? 'Duplicado' : missingFields.length ? 'Erro de importação' : normalizeStatusValue(getValue(row, 'status')),
            statusFluxo: missingFields.length ? 'Rascunho' : 'Enviado',
            origemRegistro: 'Importação',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            equipamentoId: equipamentoEncontrado?.id,
            localOrigemId: originLocationId,
            localDestinoId: destinationIds.localDestinoId,
          });
        });
      });

      if (imported.length === 0) {
        setValidationError(`Nenhum dado de ticket foi reconhecido. ${ignored ? `${ignored} linha(s) estavam vazias ou sem qualquer coluna reconhecível.` : 'Confira se a planilha tem as abas LIBERAÇÃO e RECEBIMENTO.'}`);
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

  const confirmTicketsImport = async () => {
    if (!pendingImport || isConfirmingImport) return;
    setIsConfirmingImport(true);
    onImportTickets(pendingImport.items);
    const localMessage = `${pendingImport.items.length} ticket(s) importado(s) de ${pendingImport.fileName}.${pendingImport.ignored ? ` ${pendingImport.ignored} linha(s) sem dados reconhecíveis não foram importadas.` : ''}`;
    try {
      const batches = await stageTravelDataset(
        pendingImport.fileName,
        pendingImport.items,
        { module: 'travel-v2.5', localStoragePreserved: true },
      );
      const stagedRows = batches.reduce((sum, batch) => sum + batch.preservedRows, 0);
        setImportMessage(`${localMessage} ${stagedRows} linha(s) também foram preservadas na fila gradual protegida.`);
    } catch (error) {
        console.warn('A importação local foi concluída, mas a fila protegida de viagens está indisponível:', error);
        setImportMessage(`${localMessage} A cópia local foi mantida; a fila protegida poderá ser sincronizada depois.`);
    } finally {
      setPendingImport(null);
      setIsConfirmingImport(false);
    }
  };

  // ---- Exportação Excel ----
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const matchesExportFilters = (t: TicketJazida, tipo: TipoTicketJazida) => {
        if ((t.tipoTicket || 'Liberação') !== tipo) return false;
        const flowStatus = t.statusFluxo || 'Enviado';
        const qualityStatus = isDuplicateTicket(t, duplicateTicketKeys) ? 'Duplicado' : t.status || 'OK';
        if (fDataInicial && t.data < fDataInicial) return false;
        if (fDataFinal && t.data > fDataFinal) return false;
        if (fTicketNumero && !t.ticketNumero.toLowerCase().includes(fTicketNumero.toLowerCase())) return false;
        if (fPrefixo && !t.prefixo.toLowerCase().includes(fPrefixo.toLowerCase())) return false;
        if (fPlaca && !t.placa.toLowerCase().includes(fPlaca.toLowerCase())) return false;
        if (fTipoMaterial && t.tipoMaterial !== fTipoMaterial) return false;
        if (fDestinoObra && t.destinoObra !== fDestinoObra) return false;
        if (fEmpresa && t.empresa !== fEmpresa) return false;
        if (fStatus && !([String(flowStatus), String(qualityStatus)].includes(fStatus))) return false;
        if (q) {
          const haystack = [
            t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
            t.tipoMaterial, t.destinoObra, t.destinoOutro, t.estaca, t.empresa, t.responsavelLiberacao,
            t.nomeLegivel, t.observacao, t.notaFiscalNumero, t.notaFiscalData, t.notaFiscalObservacao, t.data
          ].filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      };
      const [reneaLogoBase64, spmarLogoBase64] = await Promise.all([
        getBase64ImageFromUrl(reneaLogoFull),
        getBase64ImageFromUrl(spmarLogo),
      ]);
      const wb = await buildTicketSpreadsheetWorkbook({
        liberacoes: tickets.filter(item => matchesExportFilters(item, 'Liberação')),
        recebimentos: tickets.filter(item => matchesExportFilters(item, 'Recebimento')),
        duplicateKeys: duplicateTicketKeys,
        reneaLogoBase64,
        spmarLogoBase64,
      });
      const sufixo = hasFiltrosAtivos ? '_filtrado' : '';
      await downloadCorporateWorkbook(wb, `CONTROLE DE VIAGEMS JAZIDA SABESP${sufixo}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      const doc = new (await loadJsPdf())('p', 'mm', 'a5');
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
      const batchId = `lote-unitario-${Date.now()}`;
      const releaseTicket: TicketJazida = {
        id: `ticket-em-branco-lib-${Date.now()}`,
        data: controlDate,
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
        status: 'Pendente',
        statusFluxo: 'Rascunho',
        origemRegistro: 'Admin',
        criadoEm: now,
        atualizadoEm: now,
        impressaoEmBranco: true,
        ocultarNumeroImpressao: false,
        loteImpressaoId: batchId,
        loteImpressaoCriadoEm: now,
      };
      const receiptTicket: TicketJazida = {
        ...releaseTicket,
        id: `ticket-em-branco-rec-${Date.now()}`,
        tipoTicket: 'Recebimento',
        horaChegada: '',
      };
      await generateTicketBookPdf([{ releaseTicket, receiptTicket }], `ticket_em_branco_${reservedNumber}.pdf`);
      onImportTickets([releaseTicket, receiptTicket]);
      setImportMessage(`Ticket Nº ${reservedNumber} gerado e incluído no checklist das duas vias.`);
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
      <datalist id="ticket-equipment-prefixes">
        {equipmentOptions.map(item => (
          <option key={item.id} value={item.prefixo}>{item.nome}{equipmentPlate(item) ? ` · ${equipmentPlate(item)}` : ''}</option>
        ))}
      </datalist>
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
        note="As abas LIBERAÇÃO e RECEBIMENTO são lidas juntas. Linhas incompletas e possíveis duplicidades são preservadas como rascunho/conferência para você corrigir, sem sumirem silenciosamente."
        confirming={isConfirmingImport}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmTicketsImport}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8e4] pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#14231e] flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            Jazida • Controle diário
          </h1>
          <p className="text-xs text-[#65716b] mt-1">Impressão, devolução das duas vias e fechamento do dia em um único fluxo.</p>
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
            title="Escolher uma planilha XLSX ou XLSM, revisar as linhas e só depois confirmar"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#e2e8e4] bg-white px-4 text-xs font-black text-[#26362f] transition-colors hover:border-emerald-500 hover:text-[#14231e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            {isImporting ? 'Lendo planilha...' : 'Importar planilha'}
          </button>
          <button
            type="button"
            onClick={openBatchModal}
            title="Criar e imprimir tickets em ordem crescente"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#e2e8e4] bg-white px-4 text-xs font-black text-[#26362f] transition-colors hover:border-emerald-500 hover:text-[#14231e]"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Imprimir sequência
          </button>
          {operationsOpen && <button
            onClick={copyPublicLink}
            title="Copiar o link único para liberação e recebimento"
            className="px-4 py-2.5 bg-white border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Link2 className="w-4 h-4" /> Copiar link público
          </button>}
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-[#14231e] font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            Novo lançamento
          </button>
          <button
            type="button"
            onClick={() => { setOperationsOpen(value => !value); setIsFormOpen(false); }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-4 text-xs font-black transition-colors ${operationsOpen ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-[#e2e8e4] bg-white text-[#26362f] hover:border-emerald-500'}`}
          >
            <FilePenLine className="h-4 w-4" />
            {operationsOpen ? 'Ocultar lista e notas' : 'Ver lista e notas'}
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

      <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-cyan-50/60 p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 font-sans text-base font-black text-slate-900"><Layers3 className="h-5 w-5 text-cyan-600" /> Conferência automática das viagens</h2>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-300">ERP v2.5</span>
              </div>
              <p className="mt-1 text-[11px] text-[#65716b]">Pareamento integral pelo Ticket Nº, sem limites fixos de linha. Prefixo, placa, material e quantidade seguem a mesma conferência da planilha.</p>
            </div>
            <div className="text-[10px] text-[#65716b]">
              IDs vinculados: <b className="text-[#3d4a44]">{travelControl.linkedEquipment}</b> equipamentos · <b className="text-[#3d4a44]">{travelControl.linkedMaterials}</b> materiais · <b className="text-[#3d4a44]">{travelControl.linkedDestinations}</b> locais · <b className="text-[#3d4a44]">{travelControl.linkedBranches}</b> ramos
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            {[
              { label: 'Tickets únicos', value: travelControl.totalTickets, detail: 'numeração consolidada', color: 'text-[#14231e]' },
              { label: 'Viagens conferidas', value: travelControl.completeTrips, detail: 'pares sem divergência', color: 'text-emerald-300' },
              { label: 'Divergências', value: travelControl.divergentTrips, detail: 'dados diferentes', color: 'text-rose-300' },
              { label: 'Sem recebimento', value: travelControl.releasesWithoutReceipt, detail: 'liberação pendente', color: 'text-amber-300' },
              { label: 'Sem liberação', value: travelControl.receiptsWithoutRelease, detail: 'recebimento avulso', color: 'text-sky-300' },
              { label: 'Duração média', value: formatTravelDuration(travelControl.averageDurationMinutes), detail: `${travelControl.duplicateTickets} ticket(s) duplicado(s)`, color: 'text-cyan-300' },
            ].map(card => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-wider text-[#65716b]">{card.label}</p>
                <strong className={`mt-2 block text-xl font-black ${card.color}`}>{card.value}</strong>
                <span className="mt-1 block text-[9px] text-[#53605a]">{card.detail}</span>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8e4]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div><h3 className="text-[11px] font-black uppercase tracking-wider text-[#26362f]">Fila de revisão</h3><p className="mt-1 text-[9px] text-[#65716b]">Linhas incompletas, divergentes ou duplicadas permanecem visíveis para correção.</p></div>
              <span className="rounded-md bg-[#f7f9f8] px-2 py-1 text-[9px] font-black text-[#3d4a44]">{travelControl.totalTickets - travelControl.completeTrips} pendência(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[10px]">
                <thead className="bg-[#f7f9f8] uppercase tracking-wider text-[#65716b]"><tr><th className="px-4 py-2.5">Ticket</th><th className="px-4 py-2.5">Situação</th><th className="px-4 py-2.5">Liberação</th><th className="px-4 py-2.5">Recebimento</th><th className="px-4 py-2.5">Duração</th><th className="px-4 py-2.5">Revisar</th></tr></thead>
                <tbody className="divide-y divide-[#e2e8e4]">
                  {travelReviewRows.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-emerald-300">Todas as viagens estão pareadas e conferidas.</td></tr> : travelReviewRows.map(operation => {
                    const statusClass = operation.status === 'Divergência' || operation.status === 'Ticket duplicado'
                      ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                      : 'border-amber-500/25 bg-amber-500/10 text-amber-200';
                    return <tr key={operation.ticketNumber} className="text-[#3d4a44]">
                      <td className="px-4 py-3 font-mono font-black text-emerald-300">{operation.ticketNumber}</td>
                      <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 font-bold ${statusClass}`}>{operation.status}</span></td>
                      <td className="px-4 py-3"><b className="block">{operation.release?.prefixo || '—'}</b><span className="text-[#53605a]">{operation.releaseEvent?.ocorridoEm.replace('T', ' ').slice(0, 16) || 'Sem evento'}</span></td>
                      <td className="px-4 py-3"><b className="block">{operation.receipt?.prefixo || '—'}</b><span className="text-[#53605a]">{operation.receiptEvent?.ocorridoEm.replace('T', ' ').slice(0, 16) || 'Sem evento'}</span></td>
                      <td className="px-4 py-3 font-bold text-cyan-300">{formatTravelDuration(operation.durationMinutes)}</td>
                      <td className="px-4 py-3 text-[#65716b]">{operation.divergences.map(item => item.label).join(', ') || (operation.status === 'Ticket duplicado' ? `${operation.releases.length} lib. / ${operation.receipts.length} rec.` : 'Pareamento pendente')}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-emerald-50/60 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 font-sans text-base font-black text-slate-900"><ListChecks className="h-5 w-5 text-emerald-600" /> Conferência das duas vias</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Tempo real</span>
              </div>
              <p className="mt-1 text-[11px] text-[#65716b]">Cada número impresso gera uma pendência de Liberação e outra de Recebimento. Marque somente quando a via física voltar.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-wider text-[#65716b]">Dia da conferência</span>
                <input type="date" value={controlDate} onChange={event => setControlDate(event.target.value)} className="h-10 rounded-lg border border-[#e2e8e4] bg-white px-3 text-xs font-bold text-[#14231e] outline-none focus:border-emerald-500" />
              </label>
              <button type="button" onClick={exportTicketControlPdf} className="h-10 rounded-lg border border-[#e2e8e4] bg-white px-3 text-[10px] font-black text-[#26362f] hover:border-emerald-500">PDF</button>
              <button type="button" onClick={exportTicketControlCsv} className="h-10 rounded-lg border border-[#e2e8e4] bg-white px-3 text-[10px] font-black text-[#26362f] hover:border-emerald-500">CSV</button>
              <button type="button" onClick={exportTicketControlExcel} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-[10px] font-black text-[#14231e] hover:bg-emerald-500"><Download className="h-4 w-4" /> Excel detalhado</button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            {[
              { label: 'Tickets criados', value: dailyControl.totalCriados, detail: 'números no dia', color: 'text-[#14231e]' },
              { label: 'Vias devolvidas', value: dailyControl.liberacoesRecebidas + dailyControl.recebimentosRecebidos, detail: `de ${dailyControl.totalCriados * 2} vias`, color: 'text-cyan-300' },
              { label: 'Liberações', value: dailyControl.liberacoesRecebidas, detail: `${dailyControl.pendentesLiberacao.length} faltando`, color: 'text-emerald-300' },
              { label: 'Recebimentos', value: dailyControl.recebimentosRecebidos, detail: `${dailyControl.pendentesRecebimento.length} faltando`, color: 'text-sky-300' },
              { label: 'Completos', value: dailyControl.paresCompletos, detail: 'duas vias devolvidas', color: 'text-emerald-300' },
              { label: 'Com pendência', value: dailyControl.pendentesQualquerVia, detail: `${dailyControl.percentualConferencia}% conferido`, color: dailyControl.pendentesQualquerVia ? 'text-amber-300' : 'text-emerald-300' },
            ].map(card => (
              <div key={card.label} className="rounded-xl border border-[#e2e8e4] bg-[#f7f9f8] p-4">
                <p className="text-[9px] font-black uppercase tracking-wider text-[#65716b]">{card.label}</p>
                <strong className={`mt-2 block text-2xl font-black ${card.color}`}>{card.value}</strong>
                <span className="text-[9px] text-[#65716b]">{card.detail}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#e2e8e4] bg-[#f7f9f8] p-4">
            <div className="mb-2 flex items-center justify-between text-[10px]"><span className="font-black uppercase tracking-wider text-[#65716b]">Fechamento do dia</span><b className="text-emerald-300">{dailyControl.percentualConferencia}%</b></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f7f9f8]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-400 transition-all duration-500" style={{ width: `${dailyControl.percentualConferencia}%` }} /></div>
          </div>

          {dailyDuplicateCount > 0 && <button type="button" onClick={() => { setOperationsOpen(true); setFStatus('Duplicado'); }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-left"><span><b className="block text-xs text-rose-200">{dailyDuplicateCount} via(s) com numeração duplicada neste dia</b><small className="text-[9px] text-rose-300/70">Os dados foram preservados. Abra a área administrativa para revisar sem perder registros.</small></span><CopyPlus className="h-4 w-4 shrink-0 text-rose-300" /></button>}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={`rounded-xl border p-4 ${dailyControl.pendentesLiberacao.length ? 'border-amber-500/25 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
              <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-black text-[#14231e]">Faltam vias de Liberação</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-amber-300">{dailyControl.pendentesLiberacao.length}</span></div>
              <div className="mt-3 flex min-h-8 flex-wrap gap-1.5">{dailyControl.pendentesLiberacao.length ? dailyControl.pendentesLiberacao.map(numero => <span key={numero} className="rounded-md border border-amber-500/25 bg-white px-2 py-1 font-mono text-[10px] font-bold text-amber-200">{numero}</span>) : <span className="text-[10px] font-bold text-emerald-300">Todas as liberações retornaram.</span>}</div>
            </div>
            <div className={`rounded-xl border p-4 ${dailyControl.pendentesRecebimento.length ? 'border-sky-500/25 bg-sky-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
              <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-black text-[#14231e]">Faltam vias de Recebimento</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-sky-300">{dailyControl.pendentesRecebimento.length}</span></div>
              <div className="mt-3 flex min-h-8 flex-wrap gap-1.5">{dailyControl.pendentesRecebimento.length ? dailyControl.pendentesRecebimento.map(numero => <span key={numero} className="rounded-md border border-sky-500/25 bg-white px-2 py-1 font-mono text-[10px] font-bold text-sky-200">{numero}</span>) : <span className="text-[10px] font-bold text-emerald-300">Todos os recebimentos retornaram.</span>}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8e4]">
            <div className="flex flex-col gap-3 border-b border-[#e2e8e4] bg-[#f7f9f8] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h3 className="text-xs font-black text-[#14231e]">Checklist do dia</h3><p className="mt-1 text-[9px] text-[#65716b]">O horário de devolução é registrado automaticamente ao marcar cada via.</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!dailyControl.rows.length} onClick={() => handleSetAllReturns('Liberação', true)} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[9px] font-black text-emerald-300 disabled:opacity-40">Marcar todas as liberações</button>
                <button type="button" disabled={!dailyControl.rows.length} onClick={() => handleSetAllReturns('Recebimento', true)} className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[9px] font-black text-sky-300 disabled:opacity-40">Marcar todos os recebimentos</button>
                <button type="button" disabled={!dailyControl.rows.length} onClick={handleClearAllReturns} className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8e4] bg-white px-3 py-2 text-[9px] font-black text-[#65716b] disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Limpar checklist</button>
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-white text-[9px] font-black uppercase tracking-wider text-[#65716b]"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Criado / impresso</th><th className="px-4 py-3">Via de liberação</th><th className="px-4 py-3">Via de recebimento</th><th className="px-4 py-3">Identificação</th><th className="px-4 py-3">Notas</th></tr></thead>
                <tbody className="divide-y divide-[#e2e8e4]">
                  {!dailyControl.rows.length ? <tr><td colSpan={6} className="px-4 py-12 text-center text-[#65716b]"><Layers3 className="mx-auto mb-3 h-7 w-7 text-slate-700" />Nenhum ticket criado neste dia. Use “Imprimir sequência” para cadastrar a faixa.</td></tr> : dailyControl.rows.map(row => {
                    const ticket = row.liberacao || row.recebimento;
                    const note = row.recebimento?.notaFiscalNumero || row.liberacao?.notaFiscalNumero;
                    return <tr key={row.numero} className="bg-[#f7f9f8] hover:bg-[#f2f5f3]">
                      <td className="px-4 py-3 font-mono text-sm font-black text-[#14231e]">{row.numero}</td>
                      <td className="px-4 py-3"><b className="block text-[#26362f]">{formatEventDateTime(row.criadoEm)}</b><span className="text-[9px] text-[#53605a]">{row.loteId.startsWith('avulso-') ? 'Cadastro avulso' : 'Lote impresso'}</span></td>
                      <td className="px-4 py-3"><button type="button" onClick={() => handleToggleTicketReturn(row.numero, 'Liberação')} className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${row.liberacaoRecebida ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-400'}`}><b className="flex items-center gap-2 text-[10px]"><span className="grid h-4 w-4 place-items-center rounded border border-current">{row.liberacaoRecebida ? '✓' : ''}</span>{row.liberacaoRecebida ? 'Devolvida' : 'Marcar devolução'}</b><small className="mt-1 block text-[8px] opacity-70">{formatEventDateTime(row.liberacaoRecebidaEm)}</small></button></td>
                      <td className="px-4 py-3"><button type="button" onClick={() => handleToggleTicketReturn(row.numero, 'Recebimento')} className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${row.recebimentoRecebido ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-200 hover:border-sky-400'}`}><b className="flex items-center gap-2 text-[10px]"><span className="grid h-4 w-4 place-items-center rounded border border-current">{row.recebimentoRecebido ? '✓' : ''}</span>{row.recebimentoRecebido ? 'Devolvida' : 'Marcar devolução'}</b><small className="mt-1 block text-[8px] opacity-70">{formatEventDateTime(row.recebimentoRecebidoEm)}</small></button></td>
                      <td className="px-4 py-3"><b className="block text-[#26362f]">{ticket?.prefixo || '—'}</b><span className="text-[9px] text-[#65716b]">{ticket?.placa || 'Sem placa'}</span></td>
                      <td className="px-4 py-3">{operationsOpen ? <button type="button" onClick={() => handleOpenNoteModal(row.numero)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold ${note ? 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20' : 'bg-[#f7f9f8] text-[#65716b] hover:text-[#14231e]'}`}><FileText className="h-3 w-3" />{note || 'Lançar nota'}</button> : <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold ${note ? 'bg-cyan-500/10 text-cyan-300' : 'bg-[#f7f9f8] text-[#65716b]'}`}><FileText className="h-3 w-3" />{note || 'Área oculta'}</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {operationsOpen && <div className="space-y-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.025] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-black text-[#14231e]">Área de lançamentos, edição e notas</h2><p className="text-[10px] text-[#65716b]">Área avançada mantida oculta para deixar a conferência diária mais rápida.</p></div>
        <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase text-amber-200">Modo administrativo</span>
      </div>
      <div className="inline-flex bg-white p-1 rounded-xl border border-[#e2e8e4]">
        {(['Liberação', 'Recebimento'] as TipoTicketJazida[]).map(tipo => (
          <button
            key={tipo}
            onClick={() => { setTicketTab(tipo); setIsFormOpen(false); resetFormFields(); }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${ticketTab === tipo ? 'bg-emerald-600 text-[#14231e]' : 'text-[#65716b] hover:text-[#14231e]'}`}
          >
            Tickets de {tipo}
          </button>
        ))}
      </div>

      {/* Busca, atalhos e filtros */}
      <div className="bg-white border border-[#e2e8e4] p-4 rounded-lg space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-[#53605a]" />
          <input
            id="ticket-search"
            name="ticketSearch"
            type="text"
            placeholder="Buscar ticket, placa, prefixo, material, destino, responsável ou nota fiscal"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-white border border-[#e2e8e4] rounded-md pl-10 pr-4 text-xs text-[#26362f] placeholder:text-[#53605a] focus:outline-none focus:border-emerald-500 transition-colors"
          />
          </div>
          <button type="button" onClick={() => setFiltrosAbertos(v => !v)} aria-expanded={filtrosAbertos} className={`h-10 flex items-center justify-center gap-2 px-4 rounded-md text-xs font-bold border transition-colors ${filtrosAbertos ? 'bg-emerald-600 border-emerald-600 text-[#14231e]' : 'bg-white border-[#e2e8e4] text-[#3d4a44] hover:border-emerald-500'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            Mais filtros
            {activeFilterCount > 0 && <span className="min-w-5 h-5 px-1 rounded bg-white/15 grid place-items-center text-[10px]">{activeFilterCount}</span>}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" onClick={handleExportExcel} disabled={isExporting} className="h-10 flex items-center justify-center gap-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-[#14231e] font-bold text-xs rounded-md">
            <FileSpreadsheet className="w-4 h-4" />
            {isExporting ? 'Exportando...' : hasFiltrosAtivos ? 'Exportar resultado' : 'Exportar Excel'}
          </button>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center gap-3 border-t border-[#e2e8e4] pt-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#65716b] uppercase shrink-0"><CalendarDays className="w-4 h-4" /> Período</div>
          <div className="flex flex-wrap gap-1.5">
            {[{ label: 'Hoje', days: 1 }, { label: '7 dias', days: 7 }, { label: '30 dias', days: 30 }].map(period => (
              <button key={period.days} type="button" onClick={() => applyPeriod(period.days)} className={`h-8 px-3 rounded-md border text-[11px] font-bold ${isPeriodActive(period.days) ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-white border-[#e2e8e4] text-[#65716b] hover:text-[#14231e]'}`}>{period.label}</button>
            ))}
            <button type="button" onClick={() => applyPeriod()} className={`h-8 px-3 rounded-md border text-[11px] font-bold ${!fDataInicial && !fDataFinal ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-white border-[#e2e8e4] text-[#65716b] hover:text-[#14231e]'}`}>Todo período</button>
          </div>
          <div className="xl:ml-auto flex items-center gap-2">
            <label htmlFor="ticket-quick-status" className="text-[10px] font-bold text-[#65716b] uppercase">Situação</label>
            <select id="ticket-quick-status" value={fStatus} onChange={e => setFStatus(e.target.value)} className="h-8 min-w-40 bg-white border border-[#e2e8e4] rounded-md px-3 text-[11px] text-[#26362f] focus:outline-none focus:border-emerald-500">
              <option value="">Todas</option><option value="Enviado">Enviados</option><option value="Rascunho">Rascunhos</option><option value="Pendente">Pendentes</option><option value="Duplicado">Duplicados</option><option value="OK">Conferidos</option>
            </select>
            {hasFiltrosAtivos && <button type="button" onClick={limparFiltros} title="Limpar todos os filtros" className="h-8 w-8 grid place-items-center rounded-md border border-[#e2e8e4] text-[#65716b] hover:border-rose-500 hover:text-rose-400"><FilterX className="w-4 h-4" /></button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#65716b]">
        <span>Exibindo <strong className="text-[#26362f]">{filteredTickets.length}</strong> de {tickets.filter(item => (item.tipoTicket || 'Liberação') === ticketTab).length} tickets de {ticketTab.toLowerCase()}.</span>
        {hasFiltrosAtivos && (
          <div className="flex flex-wrap items-center gap-1.5">
            {fDataInicial && <span className="rounded border border-[#e2e8e4] bg-white px-2 py-1">De {fDataInicial.split('-').reverse().join('/')}</span>}
            {fDataFinal && <span className="rounded border border-[#e2e8e4] bg-white px-2 py-1">Até {fDataFinal.split('-').reverse().join('/')}</span>}
            {fTipoMaterial && <span className="rounded border border-[#e2e8e4] bg-white px-2 py-1">Material: {fTipoMaterial}</span>}
            {fDestinoObra && <span className="rounded border border-[#e2e8e4] bg-white px-2 py-1">Destino: {fDestinoObra}</span>}
            {fEmpresa && <span className="rounded border border-[#e2e8e4] bg-white px-2 py-1">Empresa: {fEmpresa}</span>}
            {fStatus && <span className="rounded border border-[#e2e8e4] bg-white px-2 py-1">Situação: {fStatus}</span>}
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
        <div className="bg-white border border-[#e2e8e4] rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label htmlFor="filter-start-date" className="text-xxs font-bold uppercase text-[#65716b]">Data inicial</label>
              <input id="filter-start-date" name="filterStartDate" type="date" value={fDataInicial} onChange={e => setFDataInicial(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-md px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-end-date" className="text-xxs font-bold uppercase text-[#65716b]">Data final</label>
              <input id="filter-end-date" name="filterEndDate" type="date" value={fDataFinal} onChange={e => setFDataFinal(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-md px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-ticket-number" className="text-xxs font-bold uppercase text-[#65716b]">Ticket Nº</label>
              <input id="filter-ticket-number" name="filterTicketNumber" type="text" value={fTicketNumero} onChange={e => setFTicketNumero(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-md px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-prefix" className="text-xxs font-bold uppercase text-[#65716b]">Prefixo</label>
              <input id="filter-prefix" name="filterPrefix" type="text" value={fPrefixo} onChange={e => setFPrefixo(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-md px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-plate" className="text-xxs font-bold uppercase text-[#65716b]">Placa</label>
              <input id="filter-plate" name="filterPlate" type="text" value={fPlaca} onChange={e => setFPlaca(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-md px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Tipo de Material</label>
              <select value={fTipoMaterial} onChange={e => setFTipoMaterial(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                {materialOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Destino / Obra</label>
              <select value={fDestinoObra} onChange={e => setFDestinoObra(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Empresa</label>
              <select value={fEmpresa} onChange={e => setFEmpresa(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todas</option>
                {EMPRESAS_TICKET.map(em => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#26362f] focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                <option value="Rascunho">Rascunho (ainda editando)</option>
                <option value="Enviado">Concluído / devolvido</option>
                <option value="OK">OK</option>
                <option value="Pendente">Pendente</option>
                <option value="Duplicado">Duplicado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button type="button" onClick={limparFiltros} className="flex items-center gap-1.5 px-4 py-2 bg-[#f7f9f8] hover:bg-[#f2f5f3] text-[#3d4a44] font-bold text-xs rounded-xl transition-all cursor-pointer">
              <FilterX className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
            <button type="button" onClick={handleExportExcel} disabled={isExporting} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-[#14231e] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {isExporting ? 'Exportando...' : hasFiltrosAtivos ? 'Exportar Excel filtrado' : 'Exportar Excel'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
            <div className="bg-white border border-[#e2e8e4] rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-[#65716b] font-bold">Total Tickets</p>
              <p className="text-lg font-black text-[#14231e] font-mono mt-1">{resumo.totalTickets}</p>
            </div>
            <div className="bg-white border border-[#e2e8e4] rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-[#65716b] font-bold">Total m³</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-1">{resumo.totalM3.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white border border-[#e2e8e4] rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-[#65716b] font-bold">Tickets OK</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-1">{resumo.okCount}</p>
            </div>
            <div className="bg-white border border-[#e2e8e4] rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-[#65716b] font-bold">Pendentes</p>
              <p className="text-lg font-black text-amber-400 font-mono mt-1">{resumo.pendCount}</p>
            </div>
            <div className="bg-white border border-[#e2e8e4] rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-[#65716b] font-bold">Duplicados</p>
              <p className="text-lg font-black text-rose-400 font-mono mt-1">{resumo.dupCount}</p>
            </div>
            <div className="bg-white border border-[#e2e8e4] rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-[#65716b] font-bold">Total Caçambas</p>
              <p className="text-lg font-black text-[#14231e] font-mono mt-1">{resumo.totalCacambas.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {isFormOpen && (
        <div className="bg-white border border-emerald-500/30 p-6 rounded-2xl shadow-xl relative">
          <button onClick={() => { setIsFormOpen(false); resetFormFields(); }} className="absolute top-4 right-4 p-1.5 text-[#65716b] hover:text-[#14231e] hover:bg-[#f2f5f3] rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-xs uppercase tracking-widest font-black text-emerald-400 font-mono mb-5 flex items-center gap-2">
            {editingId ? 'Editando Ticket' : 'Novo Ticket'} • {tipoTicket} - Jazida
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <b className="block text-[10px] font-black uppercase tracking-wider text-amber-200">Salvar rascunho</b>
                <p className="mt-1 text-[9px] leading-relaxed text-[#65716b]">Exige apenas número e data. Mantém o ticket editável e não marca a via como devolvida.</p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <b className="block text-[10px] font-black uppercase tracking-wider text-emerald-200">Concluir ticket</b>
                <p className="mt-1 text-[9px] leading-relaxed text-[#65716b]">Valida os campos essenciais e registra a devolução da via na conferência diária.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Tipo do Ticket</label>
                <select value={tipoTicket} onChange={e => {
                  const nextTipo = e.target.value as TipoTicketJazida;
                  setTipoTicket(nextTipo);
                  if (nextTipo === 'Recebimento' && ticketNumero.trim()) {
                    applyLiberacaoCloneToForm(ticketNumero);
                  }
                }} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 cursor-pointer">
                  <option value="Liberação">Liberação</option>
                  <option value="Recebimento">Recebimento</option>
                </select>
              </div>
              {tipoTicket === 'Recebimento' ? (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Hora de Chegada</label>
                  <input type="time" value={horaChegada} onChange={e => setHoraChegada(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Hora de Saída</label>
                  <input type="time" value={horaSaida} onChange={e => setHoraSaida(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Ticket Nº *</label>
                <input
                  type="text"
                  value={ticketNumero}
                  onChange={e => setTicketNumero(e.target.value)}
                  onBlur={() => {
                    if (tipoTicket === 'Recebimento' && ticketNumero.trim()) {
                      applyLiberacaoCloneToForm(ticketNumero);
                    }
                  }}
                  className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Data *</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Prefixo *</label>
                <input type="text" list="ticket-equipment-prefixes" value={prefixo} onChange={e => handlePrefixChange(e.target.value)} onBlur={() => fillEquipmentFields(findEquipmentByPrefix(prefixo))} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" placeholder="Digite ou escolha o prefixo" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Placa *</label>
                <input type="text" value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Família do Equipamento</label>
                <input type="text" value={familiaEquipamento} onChange={e => setFamiliaEquipamento(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" placeholder="Preenchida pelo cadastro; edição livre" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Equipamento / Descrição</label>
                <input type="text" value={equipamentoNome} onChange={e => setEquipamentoNome(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" placeholder="Preenchida pelo cadastro; edição livre" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Tipo de Material *</label>
                <select value={tipoMaterial} onChange={e => setTipoMaterial(e.target.value as TipoMaterialJazida)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 cursor-pointer">
                  {materialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Quantidade (m³) *</label>
                <input type="number" min="0" step="0.01" value={quantidadeM3} onChange={e => setQuantidadeM3(Number(e.target.value))} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">{tipoTicket === 'Recebimento' ? 'Ramo de Descarga *' : 'Destino / Obra *'}</label>
                <select value={destinoObra} onChange={e => setDestinoObra(e.target.value as DestinoObraJazida)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 cursor-pointer">
                  {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {destinoObra === 'Outros' && (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">{tipoTicket === 'Recebimento' ? 'Qual ramo de descarga? *' : 'Qual destino? *'}</label>
                  <input type="text" value={destinoOutro} onChange={e => setDestinoOutro(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
                </div>
              )}
              {tipoTicket === 'Recebimento' && (
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Estaca</label>
                  <input type="text" value={estaca} onChange={e => setEstaca(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Empresa *</label>
                <select value={empresa} onChange={e => setEmpresa(e.target.value as EmpresaTicketJazida)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 cursor-pointer">
                  {EMPRESAS_TICKET.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Responsável pela Liberação</label>
                <input type="text" value={responsavelLiberacao} onChange={e => setResponsavelLiberacao(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Nome Legível</label>
                <input type="text" value={nomeLegivel} onChange={e => setNomeLegivel(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <button type="button" onClick={() => setAdvancedFormOpen(value => !value)} className="flex w-full items-center justify-between rounded-xl border border-[#e2e8e4] bg-white px-4 py-3 text-left">
              <span><b className="block text-[10px] font-black uppercase tracking-wider text-[#3d4a44]">Observações e nota fiscal</b><small className="mt-1 block text-[9px] text-[#53605a]">Opcional. Abra somente quando precisar lançar detalhes administrativos.</small></span>
              <ChevronDown className={`h-4 w-4 text-[#65716b] transition-transform ${advancedFormOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedFormOpen && <div className="space-y-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Observação</label>
                <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-4 py-2.5 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-300"><FileText className="h-4 w-4" /> Nota fiscal</div>
                <div className="grid gap-3 md:grid-cols-[1fr_180px_2fr]">
                  <label className="space-y-1"><span className="block text-[9px] font-bold uppercase text-[#65716b]">Número da nota</span><input type="text" value={notaFiscalNumero} onChange={event => setNotaFiscalNumero(event.target.value)} className="w-full rounded-lg border border-[#e2e8e4] bg-white px-3 py-2 text-xs text-[#14231e] outline-none focus:border-cyan-500" placeholder="Ex.: NF 15482" /></label>
                  <label className="space-y-1"><span className="block text-[9px] font-bold uppercase text-[#65716b]">Data da nota</span><input type="date" value={notaFiscalData} onChange={event => setNotaFiscalData(event.target.value)} className="w-full rounded-lg border border-[#e2e8e4] bg-white px-3 py-2 text-xs text-[#14231e] outline-none focus:border-cyan-500" /></label>
                  <label className="space-y-1"><span className="block text-[9px] font-bold uppercase text-[#65716b]">Observações / referência</span><input type="text" value={notaFiscalObservacao} onChange={event => setNotaFiscalObservacao(event.target.value)} className="w-full rounded-lg border border-[#e2e8e4] bg-white px-3 py-2 text-xs text-[#14231e] outline-none focus:border-cyan-500" placeholder="Fornecedor, divergência ou referência da carga" /></label>
                </div>
              </div>
            </div>}

            {validationError && (
              <div className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                ⚠️ {validationError}
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="submit" name="saveMode" value="draft" className="px-5 py-2.5 border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15 text-amber-200 font-bold text-xs rounded-xl transition-all cursor-pointer">
                Salvar rascunho
              </button>
              <button type="submit" name="saveMode" value="complete" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-[#14231e] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
                {editingId ? 'Concluir e salvar' : 'Concluir lançamento'}
              </button>
              <button type="button" onClick={() => { setIsFormOpen(false); resetFormFields(); }} className="px-5 py-2.5 bg-[#f7f9f8] hover:bg-[#f2f5f3] text-[#3d4a44] font-bold text-xs rounded-xl transition-all cursor-pointer">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#e2e8e4] rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8e4] bg-white px-5 py-3 text-xs">
          <label className="flex items-center gap-2 font-bold text-slate-700"><input type="checkbox" checked={filteredTickets.length > 0 && filteredTickets.every(item => selectedTicketIds.includes(item.id))} onChange={event => setSelectedTicketIds(event.target.checked ? filteredTickets.map(item => item.id) : [])} /> Selecionar visíveis ({selectedTicketIds.length})</label>
          <button type="button" disabled={selectedTicketIds.length === 0} onClick={() => { if (window.confirm(`Excluir permanentemente ${selectedTicketIds.length} ticket(s) selecionado(s)?`)) { onDeleteTickets(selectedTicketIds); setSelectedTicketIds([]); } }} className="rounded-lg bg-rose-600 px-3 py-2 font-black text-[#14231e] disabled:opacity-40"><Trash2 className="mr-1 inline h-4 w-4" /> Excluir selecionados</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e2e8e4] text-[#65716b] uppercase text-[10px] font-bold bg-[#f7f9f8] font-mono">
                <th className="py-3.5 px-5">Sel.</th>
                <th className="py-3.5 px-5">Data / Hora</th>
                <th className="py-3.5 px-5">Ticket Nº</th>
                <th className="py-3.5 px-5">Prefixo / Placa</th>
                <th className="py-3.5 px-5">Material</th>
                <th className="py-3.5 px-5">Qtd (m³)</th>
                <th className="py-3.5 px-5">Destino</th>
                <th className="py-3.5 px-5">Empresa / Nota</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8e4]">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#65716b] italic">
                    {hasFiltrosAtivos ? 'Nenhum ticket encontrado para os filtros selecionados.' : 'Nenhum ticket registrado.'}
                  </td>
                </tr>
              ) : (
                filteredTickets.map(t => {
                  const status = isDuplicateTicket(t, duplicateTicketKeys) ? 'Duplicado' : t.statusFluxo || t.status || 'Enviado';
                  const statusLabel = status === 'Enviado' ? 'Concluído' : status;
                  const hasRecebimentoClone = tickets.some(item =>
                    (item.tipoTicket || 'Liberação') === 'Recebimento' &&
                    item.ticketNumero.trim().toLowerCase() === t.ticketNumero.trim().toLowerCase()
                  );
                  return (
                    <tr key={t.id} className="hover:bg-[#f7f9f8] transition-colors">
                      <td className="py-4 px-5"><input type="checkbox" checked={selectedTicketIds.includes(t.id)} onChange={event => setSelectedTicketIds(current => event.target.checked ? [...current, t.id] : current.filter(id => id !== t.id))} /></td>
                      <td className="py-4 px-5">
                        <span className="font-bold text-[#26362f] block">{t.data.split('-').reverse().join('/')}</span>
                        <span className="text-[10px] text-[#65716b] font-mono block">{t.tipoTicket || 'Liberação'}</span>
                        <span className="text-[10px] text-[#65716b] font-mono">{(t.tipoTicket || 'Liberação') === 'Recebimento' ? (t.horaChegada || t.horaSaida) : t.horaSaida}</span>
                      </td>
                      <td className="py-4 px-5 font-mono text-emerald-400 font-bold">{t.ticketNumero}</td>
                      <td className="py-4 px-5">
                        <span className="font-mono text-[#26362f] font-bold bg-white border border-[#e2e8e4] px-2 py-0.5 rounded text-xxs">{t.prefixo}</span>
                        <span className="block text-[10px] text-[#65716b] mt-0.5">{t.placa}</span>
                        {(t.equipamentoNome || t.familiaEquipamento) && (
                          <span className="block text-[10px] text-[#65716b] mt-0.5">{t.equipamentoNome || t.familiaEquipamento}</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-[#3d4a44]">{t.tipoMaterial}</td>
                      <td className="py-4 px-5 font-mono text-emerald-400 font-black text-sm">{t.quantidadeM3.toLocaleString('pt-BR')} <span className="text-[9px] text-[#65716b]">{t.unidadeQuantidade || 'm³'}</span></td>
                      <td className="py-4 px-5 text-[#65716b]">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#53605a]" />{t.destinoObra === 'Outros' ? t.destinoOutro || 'Outros' : t.destinoObra}</span>
                        {t.estaca && <span className="block text-[10px] text-[#65716b] mt-0.5">{t.estaca}</span>}
                      </td>
                      <td className="py-4 px-5 text-[#65716b]"><span className="block">{t.empresa}</span>{t.notaFiscalNumero && <span className="mt-1 block text-[10px] font-bold text-cyan-300">NF {t.notaFiscalNumero}</span>}</td>
                      <td className="py-4 px-5">
                        <span className={`inline-block px-2 py-1 rounded-lg border text-[10px] font-bold ${statusStyles[status] || statusStyles['OK']}`}>{statusLabel}</span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setViewingTicket(t)} title="Visualizar ticket" className="p-1.5 bg-[#f7f9f8] text-[#3d4a44] hover:text-emerald-400 rounded-lg cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handlePrintTicket(t)} title="Imprimir este ticket" className="p-1.5 bg-[#f7f9f8] text-[#3d4a44] hover:text-emerald-400 rounded-lg cursor-pointer"><Printer className="w-3.5 h-3.5" /></button>
                          {(t.tipoTicket || 'Liberação') === 'Liberação' && (
                            <button
                              onClick={() => handleCloneRecebimentoFromLiberacao(t)}
                              title={hasRecebimentoClone ? 'Recebimento já gerado' : 'Gerar recebimento clonando CB e placa'}
                              className={`p-1.5 bg-[#f7f9f8] rounded-lg cursor-pointer ${hasRecebimentoClone ? 'text-[#53605a]' : 'text-[#3d4a44] hover:text-emerald-400'}`}
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleOpenEdit(t)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"><Edit className="w-3.5 h-3.5" />{(t.statusFluxo || 'Enviado') === 'Rascunho' ? 'Continuar' : 'Editar'}</button>
                          {(t.statusFluxo || 'Enviado') === 'Enviado' && <button onClick={() => handleMoveTicketToDraft(t)} title="Retirar da conferência de devolvidos e continuar editando depois" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Rascunho</button>}
                          <button onClick={() => setDeleteConfirmId(t.id)} title="Excluir ticket" className="p-1.5 bg-[#f7f9f8] text-[#3d4a44] hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
      </div>}


      <div className="bg-white border border-[#e2e8e4] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-black text-[#14231e]">Histórico de lotes impressos</h3><p className="text-[10px] text-[#65716b]">Faixas registradas no controle, inclusive após restauração do backup em nuvem.</p></div>
          <span className="rounded-md border border-[#e2e8e4] bg-white px-3 py-2 text-[9px] font-black uppercase text-[#65716b]">{ticketControlRows.length} lote(s)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3"><p className="text-[9px] uppercase text-[#65716b]">Números impressos</p><p className="text-xl font-black text-[#14231e]">{ticketControlTotals.total}</p></div>
          <div className="bg-white rounded-lg p-3"><p className="text-[9px] uppercase text-[#65716b]">Viagens completas</p><p className="text-xl font-black text-emerald-400">{ticketControlTotals.completas}</p></div>
          <div className="bg-white rounded-lg p-3"><p className="text-[9px] uppercase text-[#65716b]">Liberações preenchidas</p><p className="text-xl font-black text-[#14231e]">{ticketControlTotals.liberacoes}</p></div>
          <div className="bg-white rounded-lg p-3"><p className="text-[9px] uppercase text-[#65716b]">Recebimentos preenchidos</p><p className="text-xl font-black text-[#14231e]">{ticketControlTotals.recebimentos}</p></div>
        </div>
        <div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-[#65716b]"><th className="p-2">Impressão</th><th>Faixa</th><th>Números</th><th>Lib. devolvidas</th><th>Rec. devolvidas</th><th>Completos</th><th>Pendentes</th></tr></thead><tbody>{ticketControlRows.map(r=><tr key={r.id} className="border-t border-[#e2e8e4] text-[#3d4a44]"><td className="p-2">{new Date(r.criadoEm).toLocaleString('pt-BR')}</td><td>{normalizeTicketNumber(r.displayStart)} a {normalizeTicketNumber(r.displayEnd)}</td><td>{r.total}</td><td>{r.liberacoes}</td><td>{r.recebimentos}</td><td className="text-emerald-400 font-bold">{r.completas}</td><td>{r.pendentes}</td></tr>)}</tbody></table></div>
      </div>

      {noteModalNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNoteModalNumber(null)}>
          <div className="max-h-[90dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-cyan-500/30 bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="flex items-center gap-2 text-sm font-black text-[#14231e]"><FileText className="h-4 w-4 text-cyan-300" /> Nota fiscal do Ticket Nº {noteModalNumber}</h3><p className="mt-1 text-[10px] text-[#65716b]">O lançamento é replicado nas duas vias sem alterar a conferência de devolução.</p></div>
              <button type="button" onClick={() => setNoteModalNumber(null)} className="grid h-8 w-8 place-items-center rounded-md border border-[#e2e8e4] text-[#65716b] hover:text-[#14231e]"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1"><span className="block text-[9px] font-black uppercase text-[#65716b]">Número da nota</span><input autoFocus type="text" value={notaFiscalNumero} onChange={event => setNotaFiscalNumero(event.target.value)} className="w-full rounded-lg border border-[#e2e8e4] bg-white px-3 py-2.5 text-xs text-[#14231e] outline-none focus:border-cyan-500" /></label>
              <label className="space-y-1"><span className="block text-[9px] font-black uppercase text-[#65716b]">Data da nota</span><input type="date" value={notaFiscalData} onChange={event => setNotaFiscalData(event.target.value)} className="w-full rounded-lg border border-[#e2e8e4] bg-white px-3 py-2.5 text-xs text-[#14231e] outline-none focus:border-cyan-500" /></label>
            </div>
            <label className="space-y-1"><span className="block text-[9px] font-black uppercase text-[#65716b]">Observações / referência</span><textarea rows={3} value={notaFiscalObservacao} onChange={event => setNotaFiscalObservacao(event.target.value)} className="w-full resize-y rounded-lg border border-[#e2e8e4] bg-white px-3 py-2.5 text-xs text-[#14231e] outline-none focus:border-cyan-500" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setNoteModalNumber(null)} className="rounded-lg bg-[#f7f9f8] px-4 py-2.5 text-xs font-bold text-[#3d4a44]">Cancelar</button><button type="button" onClick={handleSaveNoteModal} className="rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-black text-[#14231e] hover:bg-cyan-500">Salvar nas duas vias</button></div>
          </div>
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border border-[#e2e8e4] bg-white p-4 md:grid-cols-3">
        <button type="button" onClick={handleOpenCreate} className="group flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-left transition hover:border-emerald-400">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-black text-[#14231e]">1</span>
          <span><b className="block text-xs text-[#14231e]">Cadastrar ou continuar</b><small className="mt-1 block text-[9px] leading-relaxed text-[#65716b]">Informe somente o que já sabe. Salve como rascunho e edite depois.</small></span>
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()} className="group flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 text-left transition hover:border-sky-400">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500 text-xs font-black text-[#14231e]">2</span>
          <span><b className="block text-xs text-[#14231e]">Importar sua planilha</b><small className="mt-1 block text-[9px] leading-relaxed text-[#65716b]">Veja uma prévia, confira erros e confirme. Linhas incompletas entram como rascunho.</small></span>
        </button>
        <button type="button" onClick={() => setOperationsOpen(true)} className="group flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-left transition hover:border-amber-400">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-black text-[#14231e]">3</span>
          <span><b className="block text-xs text-[#14231e]">Revisar e concluir</b><small className="mt-1 block text-[9px] leading-relaxed text-[#65716b]">Rascunho não conta como devolvido. Concluído entra na conferência da via.</small></span>
        </button>
      </section>

      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isBatchPrinting && setIsBatchModalOpen(false)}>
          <div className="max-h-[90dvh] overflow-y-auto bg-white border border-[#e2e8e4] rounded-2xl p-5 max-w-3xl w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#14231e] flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Imprimir tickets em sequência
                </h3>
                <p className="text-[10px] text-[#65716b] mt-1">Configure a numeração, escolha o que já deve sair preenchido e salve as duas vias para editar depois.</p>
              </div>
              <button type="button" disabled={isBatchPrinting} onClick={() => setIsBatchModalOpen(false)} className="h-8 w-8 grid place-items-center rounded-md border border-[#e2e8e4] text-[#65716b] hover:text-[#14231e] disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${batchFillMode === 'em-branco' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-[#e2e8e4] bg-white'}`}>
                <input type="radio" name="batch-fill-mode" checked={batchFillMode === 'em-branco'} onChange={() => setBatchFillMode('em-branco')} className="mt-0.5 accent-emerald-500" />
                <span><strong className="block text-[11px] text-[#26362f]">Somente a numeração</strong><small className="block text-[9px] text-[#65716b]">Todos os demais campos ficam vazios para preencher à caneta.</small></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${batchFillMode === 'pre-preenchido' ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-[#e2e8e4] bg-white'}`}>
                <input type="radio" name="batch-fill-mode" checked={batchFillMode === 'pre-preenchido'} onChange={() => setBatchFillMode('pre-preenchido')} className="mt-0.5 accent-cyan-500" />
                <span><strong className="block text-[11px] text-[#26362f]">Pré-preencher o lote</strong><small className="block text-[9px] text-[#65716b]">Você escolhe abaixo quais dados comuns já saem no PDF.</small></span>
              </label>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span><strong className="block text-[11px] text-[#26362f]">Controle automático obrigatório</strong><small className="block text-[9px] text-[#65716b]">As duas vias entram como pendentes no checklist e acompanham o backup em nuvem.</small></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Numeração</label>
                <select value={batchNumberMode} onChange={e => setBatchNumberMode(e.target.value as 'automatico' | 'manual')} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500">
                  <option value="manual">Informar primeiro número</option>
                  <option value="automatico">Próxima sequência automática</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Quantidade</label>
                <input type="number" min="1" max="200" value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value))} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
              <div className={`space-y-1 ${batchNumberMode === 'automatico' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Primeiro ticket</label>
                <input value={batchNumberMode === 'automatico' ? 'Automático' : batchStartNumber} onChange={e => setBatchStartNumber(e.target.value)} disabled={batchNumberMode === 'automatico'} placeholder="Ex.: 100310" className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchNumberMode === 'automatico' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Ordem</label>
                <select value={batchDirection} onChange={e => setBatchDirection(e.target.value as 'crescente' | 'decrescente')} disabled={batchNumberMode === 'automatico'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  <option value="crescente">Crescente</option>
                  <option value="decrescente">Decrescente</option>
                </select>
              </div>
              <div className={`space-y-1 ${batchNumberMode === 'automatico' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Intervalo</label>
                <input type="number" min="1" max="1000" value={batchStep} onChange={e => setBatchStep(Number(e.target.value))} disabled={batchNumberMode === 'automatico'} title="Ex.: 10 gera 100320, 100310, 100300" className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Data do controle</label>
                <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Prefixo</label>
                <input list="ticket-equipment-prefixes" value={batchPrefixo} onChange={e => handleBatchPrefixChange(e.target.value)} disabled={batchFillMode === 'em-branco'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" placeholder="Digite ou escolha o prefixo" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Placa</label>
                <input value={batchPlaca} onChange={e => setBatchPlaca(e.target.value.toUpperCase())} disabled={batchFillMode === 'em-branco'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Quantidade (m³)</label>
                <input type="number" min="0" step="0.01" value={batchQuantidadeM3} onChange={e => setBatchQuantidadeM3(Number(e.target.value))} disabled={batchFillMode === 'em-branco'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed" />
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Material</label>
                <select value={batchTipoMaterial} onChange={e => setBatchTipoMaterial(e.target.value as TipoMaterialJazida)} disabled={batchFillMode === 'em-branco'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  {materialOptions.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Destino / obra</label>
                <select value={batchDestinoObra} onChange={e => setBatchDestinoObra(e.target.value as DestinoObraJazida)} disabled={batchFillMode === 'em-branco'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  {destinationOptions.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className={`space-y-1 ${batchFillMode === 'em-branco' ? 'opacity-45' : ''}`}>
                <label className="text-xxs font-bold uppercase tracking-wider text-[#65716b]">Empresa</label>
                <select value={batchEmpresa} onChange={e => setBatchEmpresa(e.target.value as EmpresaTicketJazida)} disabled={batchFillMode === 'em-branco'} className="w-full bg-white border border-[#e2e8e4] rounded-xl px-3 py-2 text-xs text-[#14231e] focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed">
                  {EMPRESAS_TICKET.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8e4] bg-white p-3 text-[10px] text-[#65716b]">
              <strong className="text-[#26362f]">Prévia:</strong>{' '}
              {Math.max(1, Math.min(200, Number(batchQuantity) || 1))} ticket(s) em duas vias,{' '}
              {batchFillMode === 'em-branco' ? 'apenas com a numeração' : 'com os campos escolhidos pré-preenchidos'}.
              {batchNumberMode === 'automatico'
                ? ' A próxima faixa será reservada automaticamente.'
                : ` Faixa ${batchStartNumber ? formatSequentialNumber(batchStartNumber, 0) : '-'} até ${batchStartNumber ? formatSequentialNumber(batchStartNumber, (batchDirection === 'crescente' ? 1 : -1) * Math.max(1, Number(batchStep) || 1) * (Math.max(1, Math.min(200, Number(batchQuantity) || 1)) - 1)) : '-'}, em intervalos de ${Math.max(1, Number(batchStep) || 1)}.`}
            </div>

            {validationError && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300">
                {validationError}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setIsBatchModalOpen(false)} disabled={isBatchPrinting} className="rounded-xl bg-[#f7f9f8] px-4 py-2.5 text-xs font-bold text-[#3d4a44] hover:bg-[#f2f5f3] disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={handleGenerateBatchTickets} disabled={isBatchPrinting} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-[#14231e] hover:bg-emerald-500 disabled:opacity-60">
                {isBatchPrinting ? 'Gerando PDF...' : 'Gerar PDF e iniciar checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewingTicket && viewingPair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-6" onClick={() => setViewingTicket(null)}>
          <div className="bg-white border border-[#e2e8e4] rounded-lg p-4 max-w-6xl w-full max-h-[96vh] flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div><h3 className="text-sm font-black text-[#14231e]">Visualização para impressão</h3><p className="text-[10px] text-[#65716b]">Ticket {viewingTicket.ticketNumero} no padrão operacional RENEA</p></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handlePrintTicket(viewingTicket)} className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[#14231e] text-xs font-bold flex items-center gap-2"><Printer className="w-4 h-4" /> Imprimir / PDF</button>
                <button type="button" onClick={() => setViewingTicket(null)} title="Fechar visualização" className="h-9 w-9 grid place-items-center rounded-md border border-[#e2e8e4] text-[#65716b] hover:text-[#14231e]"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="overflow-auto bg-[#f7f9f8] p-3">
              <TicketDocumentPreview releaseTicket={viewingPair.releaseTicket} receiptTicket={viewingPair.receiptTicket} />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-[#3d4a44]">Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2.5">
              <button onClick={() => { onDeleteTicket(deleteConfirmId); setDeleteConfirmId(null); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-[#14231e] font-bold text-xs rounded-xl cursor-pointer">Excluir</button>
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 bg-[#f7f9f8] hover:bg-[#f2f5f3] text-[#3d4a44] font-bold text-xs rounded-xl cursor-pointer">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

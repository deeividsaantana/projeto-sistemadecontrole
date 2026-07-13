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
  Clock3,
  CheckCircle2,
  FilePenLine
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { TicketJazida, TipoMaterialJazida, DestinoObraJazida, EmpresaTicketJazida, TipoTicketJazida } from '../types';
import reneaLogoFull from '../assets/images/renea_logo_new.png';

interface TicketsJazidaTabProps {
  tickets: TicketJazida[];
  onSaveTicket: (item: TicketJazida, isNew: boolean) => void;
  onDeleteTicket: (id: string) => void;
  onImportTickets: (items: TicketJazida[]) => void;
  onReserveTicketNumber: () => Promise<string>;
}

const TIPOS_MATERIAL: TipoMaterialJazida[] = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Argila', 'Mataco', 'Solo mole', 'Outros'];
const DESTINOS_OBRA: DestinoObraJazida[] = [
  'Marginal', 'Ramo 200', 'Ramo 300', 'Ramo 500', 'Ramo 600', 'Ramo 800', 'Ramo 900', 'Ramo 1000',
  'Ramo 2000', 'Agulha', 'Ramo 200 Alargamento', 'Ramo 500 Marginal', 'Ramo 600 Ferradura',
  'Rua Padre Eustáquio', 'Padre Eustáquio', 'SP066 Ibar', 'Canteiro da Marginal',
  'Ferradura', 'Coluna de Brita', 'Apoio', 'Jazida', 'Outros'
];
const EMPRESAS_TICKET: EmpresaTicketJazida[] = ['RENEA', 'Terceiro', 'Outros'];

export default function TicketsJazidaTab({ tickets, onSaveTicket, onDeleteTicket, onImportTickets, onReserveTicketNumber }: TicketsJazidaTabProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [viewingTicket, setViewingTicket] = useState<TicketJazida | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ticketTab, setTicketTab] = useState<TipoTicketJazida>('Liberação');
  const [linkMessage, setLinkMessage] = useState('');
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
    setResponsavelLiberacao('');
    setNomeLegivel('');
    setEmpresa('RENEA');
    setEstaca('');
    setObservacao('');
  };

  const handleOpenCreate = async () => {
    resetFormFields();
    setIsFormOpen(true);
    if (ticketTab === 'Liberação') {
      try {
        setTicketNumero(await onReserveTicketNumber());
      } catch {
        setValidationError('Não foi possível gerar o número automático. Confira a conexão com o Firebase.');
      }
    }
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
    setResponsavelLiberacao(t.responsavelLiberacao);
    setNomeLegivel(t.nomeLegivel);
    setEmpresa(t.empresa);
    setEstaca(t.estaca || '');
    setObservacao(t.observacao);
    setIsFormOpen(true);
  };

  const findLiberacaoByTicketNumero = (numero: string) => tickets.find(t =>
    (t.tipoTicket || 'Liberação') === 'Liberação' &&
    t.ticketNumero.trim().toLowerCase() === numero.trim().toLowerCase()
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
      t.ticketNumero.trim().toLowerCase() === liberacao.ticketNumero.trim().toLowerCase()
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

    const duplicado = tickets.some(t =>
      t.ticketNumero.trim().toLowerCase() === ticketNumero.trim().toLowerCase() &&
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
      ticketNumero: ticketNumero.trim(),
      prefixo: prefixo.trim(),
      placa: placa.trim().toUpperCase(),
      familiaEquipamento: familiaEquipamento.trim(),
      equipamentoNome: equipamentoNome.trim(),
      horaChegada: tipoTicket === 'Recebimento' ? horaChegada : existing?.horaChegada,
      horaSaida: tipoTicket === 'Liberação' ? horaSaida : (horaChegada || horaSaida),
      tipoMaterial,
      quantidadeM3: Number(quantidadeM3),
      destinoObra,
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
      const status = t.statusFluxo || t.status || 'Enviado';
      if (fDataInicial && t.data < fDataInicial) return false;
      if (fDataFinal && t.data > fDataFinal) return false;
      if (fTicketNumero && !t.ticketNumero.toLowerCase().includes(fTicketNumero.toLowerCase())) return false;
      if (fPrefixo && !t.prefixo.toLowerCase().includes(fPrefixo.toLowerCase())) return false;
      if (fPlaca && !t.placa.toLowerCase().includes(fPlaca.toLowerCase())) return false;
      if (fTipoMaterial && t.tipoMaterial !== fTipoMaterial) return false;
      if (fDestinoObra && t.destinoObra !== fDestinoObra) return false;
      if (fEmpresa && t.empresa !== fEmpresa) return false;
      if (fStatus && status !== fStatus) return false;

      if (q) {
        const haystack = [
          t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
          t.tipoMaterial, t.destinoObra, t.estaca, t.empresa, t.responsavelLiberacao,
          t.nomeLegivel, t.observacao, t.data
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data) || (b.horaChegada || b.horaSaida).localeCompare(a.horaChegada || a.horaSaida));
  }, [tickets, ticketTab, fDataInicial, fDataFinal, fTicketNumero, fPrefixo, fPlaca, fTipoMaterial, fDestinoObra, fEmpresa, fStatus, q]);

  const resumo = useMemo(() => {
    const totalTickets = filteredTickets.length;
    const totalM3 = filteredTickets.reduce((s, t) => s + (Number(t.quantidadeM3) || 0), 0);
    const okCount = filteredTickets.filter(t => (t.status || 'OK') === 'OK').length;
    const pendCount = filteredTickets.filter(t => (t.status || 'OK') === 'Pendente').length;
    const dupCount = filteredTickets.filter(t => (t.status || 'OK') === 'Duplicado').length;
    const media = totalTickets > 0 ? totalM3 / totalTickets : 0;
    return { totalTickets, totalM3, okCount, pendCount, dupCount, media };
  }, [filteredTickets]);

  const flowDashboard = useMemo(() => {
    const grouped = new Map<string, { numero: string; liberacao?: TicketJazida; recebimento?: TicketJazida }>();
    tickets.forEach(ticket => {
      const pair = grouped.get(ticket.ticketNumero) || { numero: ticket.ticketNumero };
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
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
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
      onImportTickets(imported);
      setImportMessage(`${imported.length} ticket(s) importado(s) de ${file.name}.${ignored ? ` ${ignored} linha(s) ignorada(s).` : ''}`);
    } catch (err) {
      console.error('Erro ao importar tickets:', err);
      setValidationError('Não foi possível importar a planilha de tickets. Use um arquivo .xlsx ou .xlsm no modelo de liberação/recebimento.');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  // ---- Exportação Excel ----
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'RENEA';
      wb.created = new Date();

      const matchesExportFilters = (t: TicketJazida, tipo: TipoTicketJazida) => {
        if ((t.tipoTicket || 'Liberação') !== tipo) return false;
        const status = t.statusFluxo || t.status || 'Enviado';
        if (fDataInicial && t.data < fDataInicial) return false;
        if (fDataFinal && t.data > fDataFinal) return false;
        if (fTicketNumero && !t.ticketNumero.toLowerCase().includes(fTicketNumero.toLowerCase())) return false;
        if (fPrefixo && !t.prefixo.toLowerCase().includes(fPrefixo.toLowerCase())) return false;
        if (fPlaca && !t.placa.toLowerCase().includes(fPlaca.toLowerCase())) return false;
        if (fTipoMaterial && t.tipoMaterial !== fTipoMaterial) return false;
        if (fDestinoObra && t.destinoObra !== fDestinoObra) return false;
        if (fEmpresa && t.empresa !== fEmpresa) return false;
        if (fStatus && status !== fStatus) return false;
        if (q) {
          const haystack = [
            t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
            t.tipoMaterial, t.destinoObra, t.estaca, t.empresa, t.responsavelLiberacao,
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
        ws.getCell(1, 1).value = isRecebimento ? 'TICKET DE RECEBIMENTO - JAZIDA SABESP' : 'TICKET DE LIBERAÇÃO - JAZIDA SABESP';
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
                  item.destinoObra,
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
                  item.destinoObra,
                  item.empresa,
                  item.nomeLegivel || item.responsavelLiberacao,
                  item.statusFluxo || item.status || 'Enviado',
                  item.assinaturaDigital ? 'Sim' : 'Não',
                ];
            ws.addRow(values);
          });

        ws.eachRow((row, rowNumber) => {
          row.eachCell({ includeEmpty: true }, cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
            if (rowNumber > 4) cell.alignment = { vertical: 'middle', horizontal: 'left' };
          });
        });
        ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
        ws.views = [{ state: 'frozen', ySplit: 4 }];
      };

      addTicketWorksheet('Liberação');
      addTicketWorksheet('Recebimento');

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sufixo = hasFiltrosAtivos ? '_filtrado' : '';
      link.setAttribute('download', `RENEA_tickets_jazida${sufixo}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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

  const handlePrintTicket = async (t: TicketJazida) => {
    try {
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
        ['Tipo de Material', t.tipoMaterial],
        ['Quantidade (m³)', String(t.quantidadeM3)],
        ['Destino / Obra', t.destinoObra],
        ['Estaca', t.estaca || '—'],
        ['Responsável pela Liberação', t.responsavelLiberacao || '—'],
        ['Nome Legível', t.nomeLegivel || '—'],
        ['Empresa', t.empresa],
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
        doc.addImage(t.assinaturaDigital, 'PNG', 12, y + 3, 86, 28);
        y += 34;
        doc.setFont('helvetica', 'normal');
        doc.text(t.assinaturaResponsavel || t.nomeLegivel || t.responsavelLiberacao || '', 12, y);
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

  return (
    <div className="space-y-6" id="tickets-jazida-tab">

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
            onClick={copyPublicLink}
            className="px-4 py-2.5 bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Link2 className="w-4 h-4" /> Link dos apontadores
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            Novo Ticket de {ticketTab}
          </button>
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

      {/* Quick search + filter toggle + export */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-900 border border-slate-850 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-600" />
          <input
            type="text"
            placeholder="Buscar por ticket, prefixo, placa, material, destino..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltrosAbertos(v => !v)}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${filtrosAbertos ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500'}`}
        >
          <Search className="w-3.5 h-3.5" />
          Filtros avançados
        </button>
        <button type="button" onClick={handleExportExcel} disabled={isExporting} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {isExporting ? 'Exportando...' : 'Exportar planilha'}
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-950 border border-emerald-600/40 hover:border-emerald-500 disabled:opacity-60 text-emerald-400 font-bold text-xs rounded-xl transition-all cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          {isImporting ? 'Importando...' : 'Importar planilha'}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={handleImportTicketsFile}
          className="hidden"
        />
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
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Inicial</label>
              <input type="date" value={fDataInicial} onChange={e => setFDataInicial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Final</label>
              <input type="date" value={fDataFinal} onChange={e => setFDataFinal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Ticket Nº</label>
              <input type="text" value={fTicketNumero} onChange={e => setFTicketNumero(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Prefixo</label>
              <input type="text" value={fPrefixo} onChange={e => setFPrefixo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Placa</label>
              <input type="text" value={fPlaca} onChange={e => setFPlaca(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
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
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Média m³/Ticket</p>
              <p className="text-lg font-black text-white font-mono mt-1">{resumo.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p>
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
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Ticket Nº {tipoTicket === 'Liberação' ? '(automático)' : '*'}</label>
                <input
                  type="text"
                  value={ticketNumero}
                  onChange={e => setTicketNumero(e.target.value)}
                  readOnly={tipoTicket === 'Liberação' && editingId === null}
                  onBlur={() => {
                    if (tipoTicket === 'Recebimento' && ticketNumero.trim()) {
                      applyLiberacaoCloneToForm(ticketNumero);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 read-only:text-emerald-400 read-only:cursor-not-allowed"
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
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-600" />{t.destinoObra}</span>
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

      {/* View modal */}
      {viewingTicket && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewingTicket(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-emerald-400">Ticket {viewingTicket.ticketNumero}</h3>
              <button onClick={() => setViewingTicket(null)} className="p-1 text-slate-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-slate-300 space-y-1.5">
              <p><b>Tipo:</b> {viewingTicket.tipoTicket || 'Liberação'}</p>
              <p><b>Data:</b> {viewingTicket.data.split('-').reverse().join('/')} às {(viewingTicket.tipoTicket || 'Liberação') === 'Recebimento' ? (viewingTicket.horaChegada || viewingTicket.horaSaida) : viewingTicket.horaSaida}</p>
              <p><b>Prefixo/Placa:</b> {viewingTicket.prefixo} / {viewingTicket.placa}</p>
              <p><b>Equipamento:</b> {viewingTicket.equipamentoNome || '—'} {viewingTicket.familiaEquipamento ? `(${viewingTicket.familiaEquipamento})` : ''}</p>
              <p><b>Material:</b> {viewingTicket.tipoMaterial === 'Outros' ? viewingTicket.materialOutro || 'Outros' : viewingTicket.tipoMaterial} — {viewingTicket.quantidadeM3} {viewingTicket.unidadeQuantidade || 'm³'}</p>
              <p><b>Destino:</b> {viewingTicket.destinoObra}</p>
              {(viewingTicket.tipoTicket || 'Liberação') === 'Recebimento' && <p><b>Estaca:</b> {viewingTicket.estaca || '—'}</p>}
              {(viewingTicket.tipoTicket || 'Liberação') === 'Recebimento' && <p><b>Carga conforme:</b> {typeof viewingTicket.cargaConforme === 'boolean' ? (viewingTicket.cargaConforme ? 'Sim' : 'Não') : '—'}</p>}
              <p><b>Empresa:</b> {viewingTicket.empresa}</p>
              <p><b>Responsável:</b> {viewingTicket.responsavelLiberacao || '—'}</p>
              <p><b>Nome legível:</b> {viewingTicket.nomeLegivel || '—'}</p>
              <p><b>Observação:</b> {viewingTicket.observacao || '—'}</p>
              <p><b>Situação:</b> {viewingTicket.statusFluxo || 'Enviado'}</p>
            </div>
            {viewingTicket.assinaturaDigital && (
              <div className="rounded-lg border border-slate-700 bg-white p-2">
                <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Assinatura digital</p>
                <img src={viewingTicket.assinaturaDigital} alt={`Assinatura de ${viewingTicket.nomeLegivel}`} className="h-28 w-full object-contain" />
              </div>
            )}
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

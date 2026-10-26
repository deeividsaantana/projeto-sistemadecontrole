/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  History,
  Link2,
  ListChecks,
  Plus,
  Printer,
  Ticket,
  Upload,
  X,
} from 'lucide-react';
import { ConfirmDialog, PageHeader, isoDay } from '../shared/ui';
import { AbasDaTela, idDaAba, type AbaDaTela } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { reduzMovimento } from '../shared/motion/reduzMovimento';
import { listarMateriais } from '../utils/materiaisJazida';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import TicketsJazidaImportacoesPanel from './TicketsJazidaImportacoesPanel';
import { baseTicketNumber, normalizeTicketNumber } from '../utils/ticketNumberSequence';
import { buildDuplicateTicketKeys, isDuplicateTicket } from '../utils/ticketDuplicateDetection';
import { buildJazidaDailyControl, getTicketControlDate, isTicketReturned } from '../utils/jazidaDailyControl';
import { buildTravelOperationControl } from '../utils/travelOperations';
import { isReneaStoredValueValid, parseReneaStoredJson } from '../utils/resilientStorage';
import { writeStorageValue } from '../data/localStore';
import { stageTravelDataset } from '../services/masterDataApi';
import { getSecurePublicTicketLink } from '../publicApi';
import type {
  Equipamento,
  ObraLocal,
  TicketJazida,
  ControleEquipamentoDiario,
  TipoTicketJazida,
} from '../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO } from './cadastros/estilos';
import {
  DESTINOS_OBRA,
  TIPOS_MATERIAL,
  dataBr,
  equipmentPlate,
  normalizeEquipmentKey,
  normalizeMasterLabel,
  tipoDoTicket,
  type CadastrosDaJazida,
  type PrintedTicketBatch,
} from './jazida/constantes';
import { generatePairedTicketPdf, generateTicketBookPdf } from './jazida/documentoTicket';
import { lerPlanilhaDeTickets } from './jazida/lerPlanilhaTickets';
import { exportTicketControlCsv, exportTicketControlExcel, exportTicketControlPdf, exportarPlanilhaDeTickets } from './jazida/exportarConferencia';
import { FILTROS_VAZIOS, contarFiltros, passaNosFiltros, type FiltrosTickets } from './jazida/filtrosTickets';
import ConferenciaDoDia from './jazida/ConferenciaDoDia';
import ListaDeTickets from './jazida/ListaDeTickets';
import ViagensAConferir, { viagensParaConferir } from './jazida/ViagensAConferir';
import ImpressoesFeitas, { type LinhaDeImpressao } from './jazida/ImpressoesFeitas';
import JanelaTicket from './jazida/JanelaTicket';
import JanelaSequencia from './jazida/JanelaSequencia';
import JanelaNota from './jazida/JanelaNota';
import JanelaVerTicket from './jazida/JanelaVerTicket';

interface TicketsJazidaTabProps {
  tickets: TicketJazida[];
  equipamentos: Equipamento[];
  obras: ObraLocal[];
  /** Usado só para sugerir o motorista do prefixo no dia da viagem. */
  controlesEquipamentos?: ControleEquipamentoDiario[];
  /** Quem fica registrado na importação com prévia/lote/lineage. */
  responsavel?: string;
  onSaveTicket: (item: TicketJazida, isNew: boolean) => void;
  /** Sem eles, a tela não mostra Excluir: só o administrador exclui (A7). */
  onDeleteTicket?: (id: string) => void;
  onDeleteTickets?: (ids: string[]) => void;
  onImportTickets: (items: TicketJazida[]) => void;
  onReserveTicketNumber: () => Promise<string>;
  onReserveTicketNumbers: (count: number) => Promise<string[]>;
}

type Vista = 'conferencia' | 'tickets' | 'conferir' | 'impressoes';
type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

const CHAVE_LOTES = 'renea_jazida_printed_batches';
const ITEM_MENU = `flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-[#176b4d] disabled:opacity-50 ${FOCO}`;
const GRUPO_MENU = 'px-3 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500';

/**
 * Viagens da jazida (Materiais). Cada viagem tem um ticket com duas vias de
 * papel: a liberação, que sai com o caminhão da jazida, e o recebimento,
 * preenchido na chegada à obra. A tela tem quatro partes, em abas no topo:
 * a conferência do dia (marcar as vias que voltaram), a lista de tickets,
 * as viagens que não batem e os blocos já impressos. "Novo ticket" é a ação
 * principal; imprimir, importar, exportar e o link do celular ficam em
 * "Mais ações".
 */
export default function TicketsJazidaTab({
  tickets,
  equipamentos,
  obras,
  controlesEquipamentos = [],
  responsavel = 'Sistema',
  onSaveTicket,
  onDeleteTicket,
  onDeleteTickets,
  onImportTickets,
  onReserveTicketNumber,
  onReserveTicketNumbers,
}: TicketsJazidaTabProps) {
  const [vista, setVista] = useState<Vista>('conferencia');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ticketTab, setTicketTab] = useState<TipoTicketJazida>('Liberação');
  const [filtros, setFiltros] = useState<FiltrosTickets>(FILTROS_VAZIOS);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [controlDate, setControlDate] = useState(isoDay(new Date()));

  // Janelas: undefined fechada; null no formulário é ticket novo.
  const [emEdicao, setEmEdicao] = useState<TicketJazida | null | undefined>(undefined);
  const [sequenciaAberta, setSequenciaAberta] = useState(false);
  const [notaNumero, setNotaNumero] = useState<string | null>(null);
  const [viewingTicket, setViewingTicket] = useState<TicketJazida | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmandoInativacao, setConfirmandoInativacao] = useState(false);
  const [confirmandoDesmarcar, setConfirmandoDesmarcar] = useState(false);
  const [importacaoComPrevia, setImportacaoComPrevia] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPrintingBlank, setIsPrintingBlank] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; items: TicketJazida[]; ignored: number } | null>(null);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [printedBatches, setPrintedBatches] = useState<PrintedTicketBatch[]>(() => {
    try {
      const saved = localStorage.getItem(CHAVE_LOTES) || localStorage.getItem('jazidaPrintedTicketBatches');
      return isReneaStoredValueValid(CHAVE_LOTES, saved)
        ? parseReneaStoredJson<PrintedTicketBatch[]>(saved, [])
        : [];
    } catch {
      return [];
    }
  });
  const importInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const escopo = useRef<HTMLElement>(null);

  const avisar = (tom: 'ok' | 'erro', texto: string) => setAviso({ tom, texto });

  // ---- Cadastros: caminhão pelo prefixo e local pelo nome ----
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
  const locationByName = useMemo(() => new Map(
    obras.map(item => [normalizeMasterLabel(item.nome), item]),
  ), [obras]);
  const materialOptions = useMemo(() => listarMateriais(TIPOS_MATERIAL, tickets), [tickets]);
  const destinationOptions = useMemo(() => [...new Set([
    ...DESTINOS_OBRA,
    ...obras.map(item => item.nome),
  ])], [obras]);
  const cadastros = useMemo<CadastrosDaJazida>(() => ({
    findEquipmentByPrefix: (value: string) => equipmentByPrefix.get(normalizeEquipmentKey(value)),
    resolveDestinationIds: (value: string) => ({ localDestinoId: locationByName.get(normalizeMasterLabel(value))?.id }),
    originLocationId: obras.find(item =>
      normalizeMasterLabel(item.nome).includes('JAZIDA')
      && normalizeMasterLabel(item.nome).includes('SABESP')
    )?.id,
  }), [equipmentByPrefix, locationByName, obras]);

  // ---- Lista de tickets ----
  const duplicateTicketKeys = useMemo(() => buildDuplicateTicketKeys(tickets), [tickets]);
  const filteredTickets = useMemo(() => tickets
    .filter(t => passaNosFiltros(t, ticketTab, filtros, duplicateTicketKeys))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.horaChegada || b.horaSaida || '').localeCompare(a.horaChegada || a.horaSaida || '')),
  [tickets, ticketTab, filtros, duplicateTicketKeys]);
  const hasFiltrosAtivos = contarFiltros(filtros) > 0;

  const handleCloneRecebimentoFromLiberacao = (liberacao: TicketJazida) => {
    const alreadyExists = tickets.some(t =>
      tipoDoTicket(t) === 'Recebimento' &&
      normalizeTicketNumber(t.ticketNumero) === normalizeTicketNumber(liberacao.ticketNumero)
    );
    if (alreadyExists) {
      setTicketTab('Recebimento');
      avisar('erro', `O recebimento do ticket ${liberacao.ticketNumero} já existe.`);
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
    avisar('ok', `Recebimento do ticket ${liberacao.ticketNumero} criado com o mesmo caminhão (${liberacao.prefixo}, placa ${liberacao.placa}).`);
  };

  // ---- Blocos impressos ----
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
        if (tipoDoTicket(ticket) === 'Liberação') status.liberacao ||= isTicketReturned(ticket);
        else status.recebimento ||= isTicketReturned(ticket);
        index.set(key, status);
      });
    });
    return index;
  }, [tickets]);

  const ticketControlRows = useMemo((): LinhaDeImpressao[] => allPrintedBatches.map(batch => {
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

  const loteGerado = (novoLote: PrintedTicketBatch, dia: string, mensagem: string) => {
    setPrintedBatches(prev => {
      const next = [novoLote, ...prev];
      writeStorageValue(localStorage, CHAVE_LOTES, JSON.stringify(next));
      return next;
    });
    setControlDate(dia);
    setSequenciaAberta(false);
    setVista('conferencia');
    avisar('ok', mensagem);
  };

  // ---- Conferência do dia e viagens ----
  const dailyControl = useMemo(() => buildJazidaDailyControl(tickets, controlDate), [tickets, controlDate]);
  const dailyDuplicateCount = useMemo(() => tickets.filter(ticket =>
    getTicketControlDate(ticket) === controlDate && isDuplicateTicket(ticket, duplicateTicketKeys)
  ).length, [tickets, controlDate, duplicateTicketKeys]);
  const travelControl = useMemo(() => buildTravelOperationControl(tickets), [tickets]);
  const aConferir = useMemo(() => viagensParaConferir(travelControl).length, [travelControl]);

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
    setConfirmandoDesmarcar(false);
  };

  // ---- Mais ações ----
  const fecharMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const doMenu = (acao: () => void | Promise<void>) => () => { fecharMenu(); void acao(); };

  const copyPublicLink = async () => {
    try {
      const link = await getSecurePublicTicketLink();
      await navigator.clipboard.writeText(link);
      avisar('ok', 'Link do celular copiado. Cole no WhatsApp de quem vai lançar na jazida ou na obra.');
    } catch (error) {
      avisar('erro', error instanceof Error ? error.message : 'Não foi possível gerar o link do celular.');
    }
  };

  const handleImportTicketsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setAviso(null);
    try {
      const { imported, ignored } = await lerPlanilhaDeTickets(file, tickets, cadastros);
      if (imported.length === 0) {
        avisar('erro', `Nenhum ticket encontrado na planilha. ${ignored ? `${ignored} linha(s) estavam vazias ou sem colunas conhecidas.` : 'Confira se ela tem as abas LIBERAÇÃO e RECEBIMENTO.'}`);
        return;
      }
      setPendingImport({ fileName: file.name, items: imported, ignored });
    } catch (err: unknown) {
      console.error('Erro ao importar tickets:', err);
      avisar('erro', err instanceof Error && err.message ? err.message : 'Não foi possível ler a planilha de tickets. Use um arquivo .xlsx ou .xlsm no modelo de liberação e recebimento.');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const confirmTicketsImport = async () => {
    if (!pendingImport || isConfirmingImport) return;
    setIsConfirmingImport(true);
    onImportTickets(pendingImport.items);
    const localMessage = `${pendingImport.items.length} ticket(s) importado(s) de ${pendingImport.fileName}.${pendingImport.ignored ? ` ${pendingImport.ignored} linha(s) sem dados conhecidos ficaram de fora.` : ''}`;
    try {
      const batches = await stageTravelDataset(
        pendingImport.fileName,
        pendingImport.items,
        { module: 'travel-v2.5', localStoragePreserved: true },
      );
      const stagedRows = batches.reduce((sum, batch) => sum + batch.preservedRows, 0);
      avisar('ok', `${localMessage} ${stagedRows} linha(s) também foram guardadas na cópia de segurança.`);
    } catch (error) {
      console.warn('A importação local foi concluída, mas a fila protegida de viagens está indisponível:', error);
      avisar('ok', `${localMessage} Ficou guardado neste aparelho; a cópia de segurança sobe depois.`);
    } finally {
      setPendingImport(null);
      setIsConfirmingImport(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportarPlanilhaDeTickets(
        tickets.filter(item => passaNosFiltros(item, 'Liberação', filtros, duplicateTicketKeys)),
        tickets.filter(item => passaNosFiltros(item, 'Recebimento', filtros, duplicateTicketKeys)),
        duplicateTicketKeys,
        hasFiltrosAtivos,
      );
    } catch (err) {
      console.error('Erro ao exportar Excel de tickets jazida:', err);
      avisar('erro', 'Não foi possível gerar a planilha. Tente de novo.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportarConferencia = (formato: 'pdf' | 'csv' | 'excel') => async () => {
    try {
      if (formato === 'pdf') await exportTicketControlPdf(dailyControl, controlDate);
      else if (formato === 'csv') exportTicketControlCsv(dailyControl, controlDate);
      else await exportTicketControlExcel(dailyControl, controlDate);
    } catch (err) {
      console.error('Erro ao exportar a conferência da jazida:', err);
      avisar('erro', 'Não foi possível gerar o arquivo da conferência. Tente de novo.');
    }
  };

  // ---- Impressão das vias ----
  const getTicketPair = (baseTicket: TicketJazida) => {
    const sameNumber = tickets.filter(item => item.ticketNumero === baseTicket.ticketNumero);
    const existingRelease = sameNumber.find(item => tipoDoTicket(item) === 'Liberação');
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
    } catch (err) {
      console.error('Erro ao gerar PDF do ticket:', err);
      avisar('erro', 'Não foi possível gerar o PDF do ticket.');
    }
  };

  const handlePrintBlankForm = async () => {
    setAviso(null);
    setIsPrintingBlank(true);
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
      avisar('ok', `Ticket ${reservedNumber} impresso em branco e incluído na conferência do dia.`);
    } catch (err) {
      console.error('Erro ao gerar formulário de ticket em branco:', err);
      avisar('erro', 'Não foi possível gerar o ticket em branco.');
    } finally {
      setIsPrintingBlank(false);
    }
  };

  const viewingPair = viewingTicket ? getTicketPair(viewingTicket) : null;
  const notaLinha = notaNumero ? dailyControl.rows.find(item => item.numero === notaNumero) : undefined;

  // Entrada dos blocos ao abrir e ao trocar de parte. Guarda local de
  // prefers-reduced-motion (reduzMovimento): sem movimento, nada é animado.
  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || reduzMovimento()) return;
    const blocos = raiz.querySelectorAll('[data-jazida-bloco], [data-linha-lista]');
    if (!blocos.length) return;
    gsap.fromTo(blocos, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.02, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }, { scope: escopo, dependencies: [vista, ticketTab] });

  const vistas: ReadonlyArray<AbaDaTela<Vista>> = [
    { id: 'conferencia', rotulo: 'Vias do dia', curto: 'Dia', icone: ListChecks, contador: dailyControl.pendentesQualquerVia, contadorRotulo: 'números com via faltando' },
    { id: 'tickets', rotulo: 'Tickets', icone: Ticket },
    { id: 'conferir', rotulo: 'Viagens a conferir', curto: 'Conferir', icone: AlertTriangle, contador: aConferir, contadorRotulo: 'viagens que não batem' },
    { id: 'impressoes', rotulo: 'Blocos impressos', curto: 'Impressos', icone: History },
  ];

  const avisoNaTela = aviso && (
    <p role={aviso.tom === 'erro' ? 'alert' : 'status'} data-testid="jazida-aviso"
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-inset ${aviso.tom === 'erro' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200'}`}>
      {aviso.tom === 'erro' ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 break-words">{aviso.texto}</span>
      <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className={`ml-auto grid size-9 shrink-0 place-items-center rounded-lg hover:bg-white/60 ${FOCO}`}><X className="size-4" aria-hidden="true" /></button>
    </p>
  );

  return (
    <TelaCheia
      ref={escopo}
      id="tickets-jazida-tab"
      testId="tickets-jazida-tab"
      rotulo="Viagens da jazida"
      idAbaAtiva={idDaAba('jazida', vista)}
      idDados="jazida-dados"
      chaveRolagem={vista}
      longa={vista !== 'tickets'}
      className="text-slate-800"
      cabecalho={<div data-jazida-bloco>
        <datalist id="ticket-equipment-prefixes">
          {equipmentOptions.map(item => (
            <option key={item.id} value={item.prefixo}>{item.nome}{equipmentPlate(item) ? ` · ${equipmentPlate(item)}` : ''}</option>
          ))}
        </datalist>
        <PageHeader
          eyebrow="Materiais"
          title="Viagens da jazida"
          abas={<AbasDaTela<Vista> id="jazida" rotulo="Partes de viagens da jazida" abas={vistas} ativa={vista} onTrocar={setVista} idPainel="jazida-dados" testId="jazida-aba" />}
          actions={<>
            <input ref={importInputRef} type="file" accept=".xlsx,.xlsm" onChange={handleImportTicketsFile} className="hidden" aria-hidden="true" tabIndex={-1} />
            <details ref={menuRef} className="erp-fleet-menu group relative" data-testid="jazida-mais-acoes">
              <summary className={`${BOTAO_SECUNDARIO} cursor-pointer list-none px-3 [&::-webkit-details-marker]:hidden`}>
                Mais ações
                <ChevronDown className="size-4 transition duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_-16px_rgba(15,40,31,0.35)]">
                <p className={GRUPO_MENU}>Imprimir</p>
                <button type="button" onClick={doMenu(() => setSequenciaAberta(true))} className={ITEM_MENU} data-testid="jazida-imprimir-sequencia"><Printer className="size-4" aria-hidden="true" />Tickets em sequência</button>
                <button type="button" disabled={isPrintingBlank} onClick={doMenu(handlePrintBlankForm)} className={ITEM_MENU}><Printer className="size-4" aria-hidden="true" />{isPrintingBlank ? 'Gerando PDF…' : '1 ticket em branco (próximo número)'}</button>
                <hr className="my-1 border-slate-100" />
                <p className={GRUPO_MENU}>Importar planilha</p>
                <button type="button" disabled={isImporting} onClick={doMenu(() => importInputRef.current?.click())} className={ITEM_MENU}><Upload className="size-4" aria-hidden="true" />{isImporting ? 'Lendo planilha…' : 'Planilha de liberação e recebimento'}</button>
                <button type="button" onClick={doMenu(() => setImportacaoComPrevia(true))} className={ITEM_MENU}><ClipboardList className="size-4" aria-hidden="true" />Conferir a planilha antes de gravar</button>
                <hr className="my-1 border-slate-100" />
                <p className={GRUPO_MENU}>Baixar</p>
                <button type="button" disabled={isExporting} onClick={doMenu(handleExportExcel)} className={ITEM_MENU}><FileSpreadsheet className="size-4" aria-hidden="true" />{isExporting ? 'Gerando planilha…' : hasFiltrosAtivos ? 'Planilha dos tickets filtrados' : 'Planilha de todos os tickets'}</button>
                <button type="button" onClick={doMenu(exportarConferencia('pdf'))} className={ITEM_MENU}><FileSpreadsheet className="size-4" aria-hidden="true" />Vias do dia em PDF</button>
                <button type="button" onClick={doMenu(exportarConferencia('excel'))} className={ITEM_MENU}><FileSpreadsheet className="size-4" aria-hidden="true" />Vias do dia em Excel</button>
                <button type="button" onClick={doMenu(exportarConferencia('csv'))} className={ITEM_MENU}><FileSpreadsheet className="size-4" aria-hidden="true" />Vias do dia em CSV</button>
                <hr className="my-1 border-slate-100" />
                <p className={GRUPO_MENU}>Celular</p>
                <button type="button" onClick={doMenu(copyPublicLink)} className={ITEM_MENU} data-testid="jazida-copiar-link"><Link2 className="size-4" aria-hidden="true" />Copiar o link para lançar pelo celular</button>
              </div>
            </details>
            <button type="button" onClick={() => setEmEdicao(null)} className={`${BOTAO_PRIMARIO} shrink-0 whitespace-nowrap px-5`} data-testid="jazida-novo-ticket">
              <Plus className="size-5" aria-hidden="true" />
              Novo ticket
            </button>
          </>}
        />
      </div>}
      faixa={avisoNaTela || undefined}
    >
      {importacaoComPrevia && (
        <section data-jazida-bloco aria-labelledby="jazida-previa-titulo" className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="jazida-previa-titulo" className="text-base font-bold text-slate-900">Conferir a planilha antes de gravar</h2>
              <p className="text-sm text-slate-600">O sistema mostra o que é novo, o que já existe e o que está repetido. Nada é gravado até você confirmar, e a mesma planilha não entra duas vezes.</p>
            </div>
            <button type="button" onClick={() => setImportacaoComPrevia(false)} aria-label="Fechar a conferência da planilha" className={`grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 ${FOCO}`}><X className="size-5" aria-hidden="true" /></button>
          </div>
          <TicketsJazidaImportacoesPanel tickets={tickets} responsavel={responsavel} onApply={onImportTickets} onError={texto => avisar('erro', texto)} />
        </section>
      )}

      {vista === 'conferencia' && (
        <ConferenciaDoDia
          dailyControl={dailyControl}
          controlDate={controlDate}
          onTrocarDia={setControlDate}
          dailyDuplicateCount={dailyDuplicateCount}
          onVerDuplicados={() => { setFiltros({ ...FILTROS_VAZIOS, situacao: 'Duplicado' }); setVista('tickets'); }}
          onAlternarVia={handleToggleTicketReturn}
          onMarcarTodas={tipo => handleSetAllReturns(tipo, true)}
          onDesmarcarTodas={() => setConfirmandoDesmarcar(true)}
          onAbrirNota={setNotaNumero}
        />
      )}

      {vista === 'tickets' && (
        <ListaDeTickets
          tickets={tickets}
          filtrados={filteredTickets}
          via={ticketTab}
          onTrocarVia={tipo => { setTicketTab(tipo); setMarcados(new Set()); }}
          filtros={filtros}
          onFiltros={mudanca => setFiltros(atual => ({ ...atual, ...mudanca }))}
          onLimparFiltros={() => setFiltros(FILTROS_VAZIOS)}
          duplicateKeys={duplicateTicketKeys}
          materialOptions={materialOptions}
          destinationOptions={destinationOptions}
          marcados={marcados}
          onMarcados={setMarcados}
          onVer={setViewingTicket}
          onGerarRecebimento={handleCloneRecebimentoFromLiberacao}
          onEditar={setEmEdicao}
          onExcluir={onDeleteTicket ? ticket => setDeleteConfirmId(ticket.id) : undefined}
          onInativarMarcados={onDeleteTickets ? () => setConfirmandoInativacao(true) : undefined}
        />
      )}

      {vista === 'conferir' && <ViagensAConferir travelControl={travelControl} />}

      {vista === 'impressoes' && <ImpressoesFeitas linhas={ticketControlRows} totais={ticketControlTotals} />}

      <SpreadsheetImportReview
        open={Boolean(pendingImport)}
        title="Importar tickets de liberação e recebimento"
        fileName={pendingImport?.fileName || ''}
        validCount={pendingImport?.items.length || 0}
        ignoredCount={pendingImport?.ignored || 0}
        columns={['Via', 'Ticket', 'Data', 'Prefixo', 'Placa', 'Material', 'Quantidade']}
        rows={(pendingImport?.items || []).map(item => ({
          Via: tipoDoTicket(item),
          Ticket: item.ticketNumero,
          Data: dataBr(item.data),
          Prefixo: item.prefixo,
          Placa: item.placa,
          Material: item.tipoMaterial,
          Quantidade: item.quantidadeM3
        }))}
        note="As abas LIBERAÇÃO e RECEBIMENTO são lidas juntas. Linha incompleta ou com número repetido entra como rascunho para você corrigir depois. Nenhuma linha some."
        confirming={isConfirmingImport}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmTicketsImport}
      />

      {emEdicao !== undefined && (
        <JanelaTicket
          key={emEdicao?.id ?? 'novo'}
          ticket={emEdicao}
          tipoInicial={ticketTab}
          tickets={tickets}
          cadastros={cadastros}
          materialOptions={materialOptions}
          destinationOptions={destinationOptions}
          controlesEquipamentos={controlesEquipamentos}
          onSalvar={(ticket, isNew, mensagem) => { onSaveTicket(ticket, isNew); setEmEdicao(undefined); avisar('ok', mensagem); }}
          onFechar={() => setEmEdicao(undefined)}
        />
      )}

      {sequenciaAberta && (
        <JanelaSequencia
          tickets={tickets}
          cadastros={cadastros}
          materialOptions={materialOptions}
          destinationOptions={destinationOptions}
          onReserveTicketNumbers={onReserveTicketNumbers}
          onImportTickets={onImportTickets}
          onGerado={loteGerado}
          onFechar={() => setSequenciaAberta(false)}
        />
      )}

      {notaLinha && (
        <JanelaNota
          linha={notaLinha}
          onImportTickets={onImportTickets}
          onSalvo={mensagem => { setNotaNumero(null); avisar('ok', mensagem); }}
          onFechar={() => setNotaNumero(null)}
        />
      )}

      {viewingTicket && viewingPair && (
        <JanelaVerTicket
          numero={viewingTicket.ticketNumero}
          releaseTicket={viewingPair.releaseTicket}
          receiptTicket={viewingPair.receiptTicket}
          onImprimir={() => void handlePrintTicket(viewingTicket)}
          onFechar={() => setViewingTicket(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteConfirmId)}
        title="Excluir este ticket?"
        description="O ticket vai para a Lixeira e sai das contas. Dá para restaurar de lá."
        confirmLabel="Excluir"
        onConfirm={() => { if (deleteConfirmId) onDeleteTicket?.(deleteConfirmId); setDeleteConfirmId(null); }}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmDialog
        open={confirmandoInativacao}
        tone="warning"
        title={`Inativar ${marcados.size} ticket(s)?`}
        description="Os tickets saem das telas e dos totais, mas continuam guardados e podem voltar."
        confirmLabel="Inativar"
        onConfirm={() => { onDeleteTickets?.([...marcados]); setMarcados(new Set()); setConfirmandoInativacao(false); }}
        onCancel={() => setConfirmandoInativacao(false)}
      />
      <ConfirmDialog
        open={confirmandoDesmarcar}
        tone="warning"
        title="Desmarcar todas as vias do dia?"
        description={`Todas as vias de ${dataBr(controlDate)} voltam a aparecer como faltando. Use só se marcou por engano.`}
        confirmLabel="Desmarcar tudo"
        onConfirm={handleClearAllReturns}
        onCancel={() => setConfirmandoDesmarcar(false)}
      />
    </TelaCheia>
  );
}

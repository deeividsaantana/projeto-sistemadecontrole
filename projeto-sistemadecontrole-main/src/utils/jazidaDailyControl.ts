import { TicketJazida, TipoTicketJazida } from '../types';
import { normalizeTicketNumber } from './ticketNumberSequence';

export type JazidaDailyControlRow = {
  numero: string;
  criadoEm: string;
  loteId: string;
  liberacao?: TicketJazida;
  recebimento?: TicketJazida;
  liberacaoRecebida: boolean;
  recebimentoRecebido: boolean;
  liberacaoRecebidaEm: string;
  recebimentoRecebidoEm: string;
};

export type JazidaDailyControl = {
  date: string;
  rows: JazidaDailyControlRow[];
  totalCriados: number;
  liberacoesRecebidas: number;
  recebimentosRecebidos: number;
  paresCompletos: number;
  pendentesLiberacao: string[];
  pendentesRecebimento: string[];
  pendentesQualquerVia: number;
  percentualConferencia: number;
};

const validIsoDate = (value?: string) => /^\d{4}-\d{2}-\d{2}/.test(String(value || ''));

export const getTicketControlDate = (ticket: TicketJazida) => {
  if (validIsoDate(ticket.loteImpressaoCriadoEm)) return String(ticket.loteImpressaoCriadoEm).slice(0, 10);
  if (ticket.origemRegistro === 'Importação' && validIsoDate(ticket.data)) return ticket.data.slice(0, 10);
  if (validIsoDate(ticket.criadoEm)) return String(ticket.criadoEm).slice(0, 10);
  if (validIsoDate(ticket.data)) return ticket.data.slice(0, 10);
  return '';
};

export const isTicketReturned = (ticket?: TicketJazida) => {
  if (!ticket) return false;
  if (ticket.devolvidoEm) return true;
  if (ticket.statusFluxo) return ticket.statusFluxo !== 'Rascunho';
  return ticket.status !== 'Pendente' && ticket.status !== 'Erro de importação';
};

const ticketEventTime = (ticket?: TicketJazida) => {
  if (!ticket || !isTicketReturned(ticket)) return '';
  return ticket.devolvidoEm || ticket.enviadoEm || ticket.atualizadoEm || ticket.criadoEm || '';
};

const newerTicket = (current: TicketJazida | undefined, candidate: TicketJazida) => {
  if (!current) return candidate;
  if (isTicketReturned(candidate) !== isTicketReturned(current)) return isTicketReturned(candidate) ? candidate : current;
  const currentTime = current.atualizadoEm || current.devolvidoEm || current.criadoEm || '';
  const candidateTime = candidate.atualizadoEm || candidate.devolvidoEm || candidate.criadoEm || '';
  return candidateTime >= currentTime ? candidate : current;
};

const sortTicketNumbers = (a: string, b: string) => {
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return bNumber - aNumber;
  return b.localeCompare(a, 'pt-BR', { numeric: true });
};

export const buildJazidaDailyControl = (tickets: TicketJazida[], date: string): JazidaDailyControl => {
  const grouped = new Map<string, { numero: string; criadoEm: string; loteId: string; liberacao?: TicketJazida; recebimento?: TicketJazida }>();

  tickets.forEach(ticket => {
    if (getTicketControlDate(ticket) !== date) return;
    const numero = normalizeTicketNumber(ticket.ticketNumero);
    if (!numero) return;
    const current = grouped.get(numero) || {
      numero,
      criadoEm: ticket.loteImpressaoCriadoEm || ticket.criadoEm || ticket.data || '',
      loteId: ticket.loteImpressaoId || `avulso-${numero}`,
    };
    const type: TipoTicketJazida = ticket.tipoTicket || 'Liberação';
    if (type === 'Liberação') current.liberacao = newerTicket(current.liberacao, ticket);
    else current.recebimento = newerTicket(current.recebimento, ticket);
    const created = ticket.loteImpressaoCriadoEm || ticket.criadoEm || ticket.data || '';
    if (!current.criadoEm || (created && created < current.criadoEm)) current.criadoEm = created;
    grouped.set(numero, current);
  });

  const rows: JazidaDailyControlRow[] = Array.from(grouped.values())
    .map(item => ({
      ...item,
      liberacaoRecebida: isTicketReturned(item.liberacao),
      recebimentoRecebido: isTicketReturned(item.recebimento),
      liberacaoRecebidaEm: ticketEventTime(item.liberacao),
      recebimentoRecebidoEm: ticketEventTime(item.recebimento),
    }))
    .sort((a, b) => sortTicketNumbers(a.numero, b.numero));

  const liberacoesRecebidas = rows.filter(row => row.liberacaoRecebida).length;
  const recebimentosRecebidos = rows.filter(row => row.recebimentoRecebido).length;
  const paresCompletos = rows.filter(row => row.liberacaoRecebida && row.recebimentoRecebido).length;
  const pendentesLiberacao = rows.filter(row => !row.liberacaoRecebida).map(row => row.numero);
  const pendentesRecebimento = rows.filter(row => !row.recebimentoRecebido).map(row => row.numero);
  const totalVias = rows.length * 2;
  const conferidas = liberacoesRecebidas + recebimentosRecebidos;

  return {
    date,
    rows,
    totalCriados: rows.length,
    liberacoesRecebidas,
    recebimentosRecebidos,
    paresCompletos,
    pendentesLiberacao,
    pendentesRecebimento,
    pendentesQualquerVia: rows.length - paresCompletos,
    percentualConferencia: totalVias ? Math.round((conferidas / totalVias) * 100) : 0,
  };
};

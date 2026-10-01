import { TicketJazida, TipoTicketJazida } from '../types';
import { normalizeTicketNumber } from './ticketNumberSequence';

type TicketIdentity = Pick<TicketJazida, 'ticketNumero' | 'tipoTicket'>;

export const ticketDuplicateKey = (ticket: TicketIdentity) => {
  const tipo: TipoTicketJazida = ticket.tipoTicket || 'Liberação';
  return `${tipo}|${normalizeTicketNumber(ticket.ticketNumero)}`;
};

export const buildDuplicateTicketKeys = (tickets: TicketIdentity[]) => {
  const counts = new Map<string, number>();
  tickets.forEach(ticket => {
    const key = ticketDuplicateKey(ticket);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
};

export const isDuplicateTicket = (ticket: TicketIdentity, duplicateKeys: ReadonlySet<string>) =>
  duplicateKeys.has(ticketDuplicateKey(ticket));

/**
 * Ticket com o mesmo número no mesmo tipo é o mesmo papel lançado duas vezes:
 * fica o primeiro registrado e os outros saem (vão para a Lixeira, de onde dá
 * para restaurar). Ticket sem número não entra na conta.
 */
export const ticketsRepetidosParaExcluir = <T extends TicketIdentity & Pick<TicketJazida, 'id' | 'data'> & { criadoEm?: string; enviadoEm?: string }>(tickets: readonly T[]): T[] => {
  const chegada = (ticket: T) => ticket.criadoEm || ticket.enviadoEm || '';
  const ordenados = tickets
    .filter(ticket => normalizeTicketNumber(ticket.ticketNumero))
    .sort((a, b) => chegada(a).localeCompare(chegada(b)) || a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const vistos = new Set<string>();
  return ordenados.filter(ticket => {
    const chave = ticketDuplicateKey(ticket);
    if (vistos.has(chave)) return true;
    vistos.add(chave);
    return false;
  });
};

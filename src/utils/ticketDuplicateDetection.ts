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

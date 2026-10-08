import type { TicketJazida } from '../types';
import { getSupabaseClient } from './client';

const table = 'erp_public_tickets';
const cleanId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
const nextNumber = (tickets: TicketJazida[]) => tickets.reduce((max, ticket) => Math.max(max, Number.parseInt(String(ticket.ticketNumero).replace(/\D/g, ''), 10) || 0), 0) + 1;

const loadTickets = async () => {
  const { data, error } = await getSupabaseClient().from(table).select('value').eq('kind', 'ticket_public');
  if (error) throw error;
  return (data || []).map(row => row.value as TicketJazida).filter(item => item?.id && item.ticketNumero);
};

export const reservePublicTicketNumbers = async (_database: unknown, knownTickets: TicketJazida[], requestedCount = 1) => {
  const count = Math.max(1, Math.min(200, Math.floor(Number(requestedCount) || 1)));
  const tickets = knownTickets.length ? knownTickets : await loadTickets();
  const start = nextNumber(tickets);
  return Array.from({ length: count }, (_, index) => String(start + index));
};
export const reservePublicTicketNumber = async (database: unknown, tickets: TicketJazida[]) => (await reservePublicTicketNumbers(database, tickets, 1))[0];

export const savePublicTicket = async (_database: unknown, ticket: TicketJazida, options: { allowOverwriteSent?: boolean } = {}) => {
  const client = getSupabaseClient();
  if (ticket.tipoTicket === 'Recebimento' && ticket.statusFluxo === 'Enviado' && !options.allowOverwriteSent) {
    const { data: existing } = await client.from(table).select('value').eq('id', `ticket_public_${cleanId(ticket.id)}`).maybeSingle();
    if ((existing?.value as TicketJazida | undefined)?.statusFluxo === 'Enviado') throw new Error(`O recebimento do Ticket ${ticket.ticketNumero} já foi enviado por outra pessoa.`);
  }
  const { error } = await client.from(table).upsert({ id: `ticket_public_${cleanId(ticket.id)}`, kind: 'ticket_public', value: ticket, updated_at: new Date().toISOString() });
  if (error) throw error;
};

export const deletePublicTicket = async (_database: unknown, ticketId: string) => {
  const { error } = await getSupabaseClient().from(table).delete().eq('id', `ticket_public_${cleanId(ticketId)}`);
  if (error) throw error;
};

export const subscribePublicTickets = (_database: unknown, onChange: (tickets: TicketJazida[]) => void, onError?: (error: unknown) => void) => {
  const client = getSupabaseClient();
  let active = true;
  const refresh = async () => { try { if (active) onChange(await loadTickets()); } catch (error) { onError?.(error); } };
  void refresh();
  const channel = client.channel('erp-public-tickets').on('postgres_changes', { event: '*', schema: 'public', table }, () => void refresh()).subscribe();
  return () => { active = false; void client.removeChannel(channel); };
};

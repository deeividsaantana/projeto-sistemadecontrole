import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TicketJazida } from '../types';
import { getSupabaseClient } from './client';
import { resolveSupabaseClientConfig } from './config';

const PUBLIC_TICKETS_TABLE = 'public_tickets';
const PUBLIC_META_TABLE = 'public_ticket_counters';

const sanitizePayload = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const nextNumberFromTickets = (tickets: TicketJazida[]) => {
  const highest = tickets.reduce((max, ticket) => {
    const numeric = Number.parseInt(String(ticket.ticketNumero).replace(/\D/g, ''), 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return highest + 1;
};

export const reservePublicTicketNumbers = async (
  _legacyDatabase: unknown,
  knownTickets: TicketJazida[],
  requestedCount = 1,
): Promise<string[]> => {
  const count = Math.max(1, Math.min(200, Math.floor(Number(requestedCount) || 1)));
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data, error } = await client.rpc('reserve_public_ticket_numbers', {
    p_organization_id: organizationId,
    p_known_next_number: nextNumberFromTickets(knownTickets),
    p_requested_count: count,
  });
  if (error) throw error;
  return Array.isArray(data) ? data.map(String) : [];
};

export const reservePublicTicketNumber = async (
  legacyDatabase: unknown,
  knownTickets: TicketJazida[],
): Promise<string> => (await reservePublicTicketNumbers(legacyDatabase, knownTickets, 1))[0];

export const savePublicTicket = async (
  _legacyDatabase: unknown,
  ticket: TicketJazida,
  options: { allowOverwriteSent?: boolean } = {},
) => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const payload = sanitizePayload(ticket);
  const { error } = await client
    .from(PUBLIC_TICKETS_TABLE)
    .upsert({
      organization_id: organizationId,
      legacy_id: ticket.id,
      status_fluxo: ticket.statusFluxo || 'Rascunho',
      allow_overwrite_sent: options.allowOverwriteSent === true,
      payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,legacy_id' });
  if (error) throw error;
};

export const deletePublicTicket = async (_legacyDatabase: unknown, ticketId: string) => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { error } = await client
    .from(PUBLIC_TICKETS_TABLE)
    .delete()
    .eq('organization_id', organizationId)
    .eq('legacy_id', ticketId);
  if (error) throw error;
};

export const subscribePublicTickets = (
  _legacyDatabase: unknown,
  onChange: (tickets: TicketJazida[]) => void,
  onError?: (error: unknown) => void,
) => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  let channel: RealtimeChannel | undefined;

  const load = async () => {
    const { data, error } = await client
      .from(PUBLIC_TICKETS_TABLE)
      .select('payload')
      .eq('organization_id', organizationId);
    if (error) throw error;
    onChange((data || []).map(row => row.payload as TicketJazida).filter(ticket => ticket?.id));
  };

  load().catch(error => onError?.(error));
  channel = client
    .channel(`public-tickets:${organizationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: PUBLIC_TICKETS_TABLE,
      filter: `organization_id=eq.${organizationId}`,
    }, () => { load().catch(error => onError?.(error)); })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') onError?.(new Error('Canal realtime de tickets indisponivel.'));
    });

  return () => {
    if (channel) void client.removeChannel(channel);
  };
};

export const PUBLIC_TICKET_COUNTERS_TABLE = PUBLIC_META_TABLE;

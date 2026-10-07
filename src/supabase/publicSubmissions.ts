import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresencaApontamento } from '../types';
import { getSupabaseClient } from './client';
import { resolveSupabaseClientConfig } from './config';

export const SUBMISSIONS_TABLE = 'public_submissions';

export type PublicSubmission = {
  id: string;
  kind: 'presence' | 'presence-reset' | 'equipe';
  status: 'pending' | 'processed' | 'cancelled';
  createdAtIso: string;
  payload: {
    grupoId?: string;
    grupoNome?: string;
    data: string;
    records?: PresencaApontamento[];
    funcionarioId?: string;
    funcionarioNome?: string;
    funcao?: string;
    operacao?: 'adicionar' | 'remover';
  };
};

const fromRow = (row: Record<string, unknown>): PublicSubmission => ({
  id: String(row.legacy_id || row.id || ''),
  kind: row.kind as PublicSubmission['kind'],
  status: row.status as PublicSubmission['status'],
  createdAtIso: String(row.created_at || row.createdAtIso || ''),
  payload: row.payload as PublicSubmission['payload'],
});

export const normalizeSubmissionSnapshot = (items: Array<Record<string, unknown>>): PublicSubmission[] => items
  .map(fromRow)
  .filter(item => item.kind === 'presence' || item.kind === 'presence-reset' || item.kind === 'equipe')
  .filter(item => item.payload && typeof item.payload.data === 'string')
  .sort((a, b) => String(a.createdAtIso || '').localeCompare(String(b.createdAtIso || '')));

export const subscribePendingPublicSubmissions = (
  _legacyDatabase: unknown,
  onChange: (submissions: PublicSubmission[]) => void,
  onError: (error: Error) => void,
) => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  let channel: RealtimeChannel | undefined;

  const load = async () => {
    const { data, error } = await client
      .from(SUBMISSIONS_TABLE)
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending');
    if (error) throw error;
    onChange(normalizeSubmissionSnapshot(data || []));
  };

  load().catch(error => onError(error instanceof Error ? error : new Error(String(error))));
  channel = client
    .channel(`public-submissions:${organizationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: SUBMISSIONS_TABLE,
      filter: `organization_id=eq.${organizationId}`,
    }, () => { load().catch(error => onError(error instanceof Error ? error : new Error(String(error)))); })
    .subscribe();

  return () => {
    if (channel) void client.removeChannel(channel);
  };
};

export const markPublicSubmissionsProcessed = async (
  _legacyDatabase: unknown,
  submissionIds: string[],
  processedBy: string,
) => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { error } = await client
    .from(SUBMISSIONS_TABLE)
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      processed_by: processedBy,
    })
    .eq('organization_id', organizationId)
    .in('legacy_id', submissionIds);
  if (error) throw error;
};

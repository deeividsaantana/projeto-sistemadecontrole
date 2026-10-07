import { normalizeSubmissionSnapshot, SUBMISSIONS_TABLE, type PublicSubmission } from './publicSubmissions';
import { getSupabaseClient } from './client';
import { resolveSupabaseClientConfig } from './config';

export const fetchAllPresenceSubmissions = async (_legacyDatabase?: unknown): Promise<PublicSubmission[]> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data, error } = await client
    .from(SUBMISSIONS_TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .in('kind', ['presence', 'presence-reset', 'equipe']);
  if (error) throw error;
  return normalizeSubmissionSnapshot(data || []);
};

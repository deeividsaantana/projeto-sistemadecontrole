import type { PublicSubmission } from './submissions';
import { normalizeSubmissionRows, SUBMISSIONS_COLLECTION } from './submissions';
import { getSupabaseClient } from './client';
export const fetchAllPresenceSubmissions = async (_database: unknown): Promise<PublicSubmission[]> => { const { data, error } = await getSupabaseClient().from(SUBMISSIONS_COLLECTION).select('id,kind,status,created_at,payload').in('kind', ['presence', 'presence-reset', 'equipe']); if (error) throw error; return normalizeSubmissionRows((data || []) as never[]); };

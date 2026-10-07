import type { MaterialUseSubmission } from '../modules/materials/materialFieldUse';
import { getSupabaseClient } from './client';
import {
  markPublicSubmissionsProcessed,
  subscribePendingPublicSubmissions,
  type PublicSubmission,
} from './publicSubmissions';
import {
  deletePublicTicket,
  reservePublicTicketNumber,
  reservePublicTicketNumbers,
  savePublicTicket,
  subscribePublicTickets,
} from './publicTickets';
import { loadSupabaseMemberships } from './memberships';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
}

let cachedUserRole: string | null = null;

const toAppUser = (user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null): AppUser | null => {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const claims = {
    ...metadata,
    role: metadata.role || cachedUserRole || 'viewer',
    staff: metadata.staff !== false,
  };
  return {
    uid: user.id,
    email: user.email || null,
    displayName: typeof metadata.name === 'string' ? metadata.name : null,
    getIdToken: async () => {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      return data.session?.access_token || '';
    },
    getIdTokenResult: async () => ({ claims }),
  };
};

export const loadUserRoleFromMemberships = async (): Promise<string> => {
  try {
    const memberships = await loadSupabaseMemberships();
    // Prioriza a organização 'renea', mas se não existir, usa a primeira
    const reneaMembership = memberships.find(m => m.organizationId === 'renea');
    const membership = reneaMembership || memberships[0];
    if (membership) {
      cachedUserRole = membership.role;
      return membership.role;
    }
  } catch (error) {
    console.warn('Falha ao carregar role do Supabase:', error);
  }
  return cachedUserRole || 'viewer';
};

export const auth = {
  currentUser: null as AppUser | null,
};

export const onAuthStateChanged = (
  _auth: typeof auth,
  callback: (user: AppUser | null) => void | Promise<void>,
) => {
  const client = getSupabaseClient();
  void client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    auth.currentUser = toAppUser(data.session?.user || null);
    return callback(auth.currentUser);
  }).catch(error => console.error('Falha ao restaurar sessão Supabase.', error));
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    auth.currentUser = toAppUser(session?.user || null);
    void callback(auth.currentUser);
  });
  return () => data.subscription.unsubscribe();
};

export const db = undefined;

export {
  deletePublicTicket,
  markPublicSubmissionsProcessed,
  reservePublicTicketNumber,
  reservePublicTicketNumbers,
  savePublicTicket,
  subscribePendingPublicSubmissions,
  subscribePublicTickets,
  type PublicSubmission,
};

export const subscribePendingMaterialUses = (
  _database: unknown,
  _onChange: (submissions: MaterialUseSubmission[]) => void,
  onError: (error: Error) => void,
) => {
  onError(new Error('Submissões de uso de material ainda não foram migradas para o Supabase.'));
  return () => undefined;
};

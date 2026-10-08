import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';

export interface SupabaseAuthUser extends User {
  uid: string;
  displayName: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
}

const adaptUser = (user: User | null): SupabaseAuthUser | null => {
  if (!user) return null;
  return Object.assign(user, {
    uid: user.id,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
    getIdToken: async () => (await getSupabaseClient().auth.getSession()).data.session?.access_token || '',
    getIdTokenResult: async () => ({
      claims: {
        ...((user.app_metadata || {}) as Record<string, unknown>),
        ...((user.user_metadata || {}) as Record<string, unknown>),
      },
    }),
  });
};

let currentUser: SupabaseAuthUser | null = null;

export const supabaseAuth = {
  get currentUser(): SupabaseAuthUser | null {
    return currentUser;
  },
  onAuthStateChanged(callback: (user: SupabaseAuthUser | null) => void): () => void {
    let active = true;
    const client = getSupabaseClient();
    void client.auth.getSession().then(({ data }) => {
      if (active) {
        currentUser = adaptUser(data.session?.user ?? null);
        callback(currentUser);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (active) {
        currentUser = adaptUser(session?.user ?? null);
        callback(currentUser);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  },
};

export type SupabaseAuth = typeof supabaseAuth;

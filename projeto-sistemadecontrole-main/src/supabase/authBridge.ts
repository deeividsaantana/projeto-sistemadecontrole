import { getSupabaseClient } from './client';

export const signInSupabaseBridge = async (email: string, password: string): Promise<void> => {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signOutSupabaseBridge = async (): Promise<void> => {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
};


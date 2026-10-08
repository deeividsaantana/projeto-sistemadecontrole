import { getSupabaseClient } from '../supabase/client';
import type { SupabaseAuth } from './supabaseAuth';

export const normalizeLoginEmail = (email: string): string => email.trim().toLowerCase();

export const signInWithCorporateEmail = async (_auth: SupabaseAuth, email: string, password: string) => {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email: normalizeLoginEmail(email), password });
  if (error) throw error;
  return data.user;
};

export const sendPasswordRecoveryEmail = (_auth: SupabaseAuth, email: string) =>
  getSupabaseClient().auth.resetPasswordForEmail(normalizeLoginEmail(email));

export const signOutCurrentUser = async (_auth: SupabaseAuth): Promise<void> => {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
};

export const getLoginErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  if (code.includes('invalid-credentials') || code.includes('user-not-found')) return 'E-mail ou senha incorretos.';
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('supabase_config_missing')) return 'O ambiente Supabase ainda não foi configurado.';
  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  return 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
};

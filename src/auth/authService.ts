import { getSupabaseClient } from '../supabase/client';

export const normalizeLoginEmail = (email: string): string => email.trim().toLowerCase();

export const signInWithCorporateEmail = async (
  _legacyAuth: unknown,
  email: string,
  password: string,
) => {
  const normalizedEmail = normalizeLoginEmail(email);
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
  return data;
};

export const sendPasswordRecoveryEmail = async (
  _legacyAuth: unknown,
  email: string,
) => {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizeLoginEmail(email));
  if (error) throw error;
};

export const signOutCurrentUser = async (_legacyAuth: unknown): Promise<void> => {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
};

export const getLoginErrorMessage = (error: unknown): string => {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (code.includes('invalid-credential') || code.includes('user-not-found')) {
    return 'E-mail ou senha incorretos.';
  }
  if (code.includes('too-many-requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (message.includes('supabase_config_missing')) {
    return 'O ambiente Supabase ainda não foi configurado pela equipe técnica.';
  }
  return 'Nao foi possivel entrar. Verifique sua conexao e tente novamente.';
};

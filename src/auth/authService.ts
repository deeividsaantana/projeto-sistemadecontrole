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

// Sair encerra só este aparelho. O padrão do Supabase ('global') derruba a
// mesma conta no celular e no computador ao mesmo tempo, inclusive quando a
// sessão expira por inatividade num aparelho esquecido.
export const signOutCurrentUser = async (_auth: SupabaseAuth): Promise<void> => {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
};

// O Supabase devolve `code` com sublinhado (`invalid_credentials`,
// `over_request_rate_limit`) e `status` HTTP. Sem ler esses dois, o limite de
// tentativas caía em "verifique sua conexão" e confundia quem estava com a
// internet boa.
export const getLoginErrorMessage = (error: unknown): string => {
  const fields = typeof error === 'object' && error ? (error as { code?: unknown; status?: unknown }) : {};
  const code = String(fields.code || '').toLowerCase().replace(/-/g, '_');
  const status = typeof fields.status === 'number' ? fields.status : 0;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('supabase_config_missing')) return 'O ambiente Supabase ainda não foi configurado.';
  if (code === 'invalid_credentials' || code === 'user_not_found' || message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (status === 429 || code.startsWith('over_') || code === 'too_many_requests') {
    return 'Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo.';
  }
  if (code === 'email_not_confirmed') return 'Este e-mail ainda não foi confirmado. Fale com a administração.';
  if (code === 'user_banned') return 'Este acesso está bloqueado. Fale com a administração.';
  if (status >= 500) return 'O sistema de login está fora do ar agora. Tente de novo em alguns minutos.';
  return 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
};

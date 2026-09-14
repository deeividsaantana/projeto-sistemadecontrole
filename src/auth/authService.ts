import type { Auth } from 'firebase/auth';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { cloudProvider, isSupabaseCloudEnabled } from '../platform/cloudProvider';

export const normalizeLoginEmail = (email: string): string => email.trim().toLowerCase();

export const signInWithCorporateEmail = async (
  auth: Auth,
  email: string,
  password: string,
) => {
  const normalizedEmail = normalizeLoginEmail(email);
  const firebaseCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);

  if (isSupabaseCloudEnabled) {
    try {
      const { signInSupabaseBridge } = await import('../supabase/authBridge');
      await signInSupabaseBridge(normalizedEmail, password);
    } catch (error) {
      if (cloudProvider === 'supabase') {
        await signOut(auth);
        throw error;
      }
      // No modo de homologação, o Firebase segue autoritativo. A conta pode
      // ainda não ter sido provisionada no Supabase e isso não bloqueia campo.
      console.warn('Login Firebase concluído; sessão do espelho Supabase indisponível.', error);
    }
  }

  return firebaseCredential;
};

export const sendPasswordRecoveryEmail = (
  auth: Auth,
  email: string,
) => sendPasswordResetEmail(auth, normalizeLoginEmail(email));

export const signOutCurrentUser = async (auth: Auth): Promise<void> => {
  const results = await Promise.allSettled([
    signOut(auth),
    ...(isSupabaseCloudEnabled
      ? [import('../supabase/authBridge').then(({ signOutSupabaseBridge }) => signOutSupabaseBridge())]
      : []),
  ]);
  const firebaseResult = results[0];
  if (firebaseResult.status === 'rejected') throw firebaseResult.reason;
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

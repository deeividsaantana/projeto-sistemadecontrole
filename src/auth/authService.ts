import type { Auth } from 'firebase/auth';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

export const normalizeLoginEmail = (email: string): string => email.trim().toLowerCase();

export const signInWithCorporateEmail = (
  auth: Auth,
  email: string,
  password: string,
) => signInWithEmailAndPassword(auth, normalizeLoginEmail(email), password);

export const sendPasswordRecoveryEmail = (
  auth: Auth,
  email: string,
) => sendPasswordResetEmail(auth, normalizeLoginEmail(email));

export const signOutCurrentUser = (auth: Auth) => signOut(auth);

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
  return 'Nao foi possivel entrar. Verifique sua conexao e tente novamente.';
};

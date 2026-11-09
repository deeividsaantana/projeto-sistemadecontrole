import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLoginErrorMessage } from '../src/auth/authService';

// Erros no formato que o Supabase Auth devolve: Error com `code` e `status`.
const supabaseError = (message: string, status: number, code?: string) =>
  Object.assign(new Error(message), { status, code });

const conexao = 'Não foi possível entrar. Verifique sua conexão e tente novamente.';

assert.equal(
  getLoginErrorMessage(supabaseError('Invalid login credentials', 400, 'invalid_credentials')),
  'E-mail ou senha incorretos.',
);
assert.match(
  getLoginErrorMessage(supabaseError('Request rate limit reached', 429, 'over_request_rate_limit')),
  /Muitas tentativas/,
);
assert.match(getLoginErrorMessage(supabaseError('Too many requests', 429)), /Muitas tentativas/);
assert.match(getLoginErrorMessage(supabaseError('Email not confirmed', 400, 'email_not_confirmed')), /não foi confirmado/);
assert.match(getLoginErrorMessage(supabaseError('User is banned', 400, 'user_banned')), /bloqueado/);
assert.match(getLoginErrorMessage(supabaseError('Service unavailable', 503)), /fora do ar/);
assert.equal(getLoginErrorMessage(supabaseError('Failed to fetch', 0)), conexao);
assert.equal(getLoginErrorMessage(new Error('SUPABASE_CONFIG_MISSING: url')), 'O ambiente Supabase ainda não foi configurado.');
assert.equal(getLoginErrorMessage(undefined), conexao);

console.log('ok - mensagens de erro do login');

// Sair num aparelho não pode derrubar a mesma conta nos outros aparelhos.
const authServiceSource = readFileSync(new URL('../src/auth/authService.ts', import.meta.url), 'utf8');
assert.match(authServiceSource, /auth\.signOut\(\{ scope: 'local' \}\)/);
console.log('ok - sair encerra só este aparelho');

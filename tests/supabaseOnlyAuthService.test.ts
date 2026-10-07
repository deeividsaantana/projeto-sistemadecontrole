import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const authService = readFileSync(new URL('../src/auth/authService.ts', import.meta.url), 'utf8');

test('authService usa Supabase Auth sem importar firebase/auth', () => {
  assert.doesNotMatch(authService, /firebase\/auth|signInWithEmailAndPassword|sendPasswordResetEmail/);
  assert.match(authService, /getSupabaseClient/);
  assert.match(authService, /signInWithPassword/);
  assert.match(authService, /resetPasswordForEmail/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('rotas privadas SaaS entram diretamente no shell Supabase', () => {
  assert.doesNotMatch(mainSource, /isSupabaseCloudEnabled/);
  assert.match(mainSource, /const privateRoute = parsePrivatePath\(window\.location\.pathname\)/);
  assert.match(mainSource, /if \(privateRoute\)/);
  assert.match(mainSource, /<PrivateRouteApp route=\{privateRoute\}/);
  assert.match(mainSource, /restoreMissingReneaLocalStorage\(reserva\)/);
  assert.match(mainSource, /startReneaStorageMirror\(reserva\)/);
});

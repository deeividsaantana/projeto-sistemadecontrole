import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('rotas privadas SaaS entram direto no app Supabase final', () => {
  assert.doesNotMatch(mainSource, /isSupabaseCloudEnabled|firebase/i);
  assert.match(mainSource, /const privateRoute = parsePrivatePath\(window\.location\.pathname\)/);
  assert.match(mainSource, /if \(privateRoute\)/);
  assert.match(mainSource, /<PrivateRouteApp route=\{privateRoute\}/);
  assert.match(mainSource, /import\('\.\/App\.tsx'\)/);
  assert.match(mainSource, /restoreMissingReneaLocalStorage\(\)/);
  assert.match(mainSource, /startReneaStorageMirror\(\)/);
});

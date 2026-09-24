import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('rotas privadas SaaS nao desligam o sincronizador Firebase durante a transicao', () => {
  assert.match(mainSource, /import \{ isSupabaseCloudEnabled \} from '\.\/platform\/cloudProvider'/);
  assert.match(mainSource, /const privateRoute = parsePrivatePath\(window\.location\.pathname\)/);
  assert.match(mainSource, /if \(privateRoute && isSupabaseCloudEnabled\)/);
  assert.match(mainSource, /import\('\.\/App\.tsx'\)/);
  assert.match(mainSource, /restoreMissingReneaLocalStorage\(\)/);
  assert.match(mainSource, /startReneaStorageMirror\(\)/);
});

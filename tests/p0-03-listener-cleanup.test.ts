import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('sincronização Supabase não mantém listener Firestore legado', () => {
  assert.doesNotMatch(source, /onSnapshot|unsubscribeManifest|cloudProvider !== ['"]supabase['"]/);
  assert.match(source, /setInterval\(pullRemoteChanges, SYNC_FALLBACK_INTERVAL_MS\)/);
  assert.match(source, /window\.clearInterval\(interval\)/);
});

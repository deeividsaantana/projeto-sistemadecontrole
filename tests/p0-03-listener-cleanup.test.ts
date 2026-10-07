import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('[P0-03-01] App nao instala listener Firestore de manifesto', () => {
  assert.doesNotMatch(appSource, /onSnapshot|doc\(|cloudProvider !== 'supabase'/);
});

test('[P0-03-02] checagem periodica Supabase continua com cleanup seguro', () => {
  assert.match(appSource, /const initialCheck = window\.setTimeout\(pullRemoteChanges, 3_000\)/);
  assert.match(appSource, /const interval = window\.setInterval\(pullRemoteChanges, SYNC_FALLBACK_INTERVAL_MS\)/);
  assert.match(appSource, /window\.clearTimeout\(initialCheck\)/);
  assert.match(appSource, /window\.clearInterval\(interval\)/);
});

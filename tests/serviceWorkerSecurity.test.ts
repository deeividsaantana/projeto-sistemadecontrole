import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const serviceWorkerUrl = new URL('../public/service-worker.js', import.meta.url);
const serviceWorker = readFileSync(serviceWorkerUrl, 'utf8');

test('service worker nao cacheia HTML ou dados operacionais como shell estatico', () => {
  assert.match(serviceWorker, /const SHELL = \['\/manifest\.webmanifest', '\/favicon\.png'\]/);
  assert.doesNotMatch(serviceWorker, /const SHELL = \[[^\]]*'\/index\.html'/);
  assert.doesNotMatch(serviceWorker, /const SHELL = \[[^\]]*'\/'/);
  assert.match(serviceWorker, /if \(!isStaticRequest\(request\)\) return/);
});

test('service worker exclui Functions e respostas no-store do cache runtime', () => {
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/\.netlify\/functions\/'\)/);
  assert.match(serviceWorker, /response\.headers\.get\('Cache-Control'\) !== 'no-store'/);
});

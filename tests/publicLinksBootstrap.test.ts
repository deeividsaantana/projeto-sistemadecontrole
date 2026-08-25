import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const publicApiSource = readFileSync(new URL('../src/publicApi.ts', import.meta.url), 'utf8');
const publicLinksSource = readFileSync(new URL('../src/PublicLinksApp.tsx', import.meta.url), 'utf8');
const publicPresenceFunctionSource = readFileSync(new URL('../netlify/functions/public-presenca.js', import.meta.url), 'utf8');

test('bootstrap publico carrega tela leve sem iniciar ERP administrativo', () => {
  assert.match(mainSource, /isPublicLinkUrl\(\)/);
  assert.match(mainSource, /import\('\.\/PublicLinksApp'\)/);
  assert.match(mainSource, /import\('\.\/App\.tsx'\)/);
  assert.match(mainSource, /restoreMissingReneaLocalStorage\(\)/);
  assert.match(mainSource, /startReneaStorageMirror\(\)/);
});

test('servicos publicos nao importam Firebase no caminho inicial do link', () => {
  assert.doesNotMatch(publicApiSource, /^import \{ auth \} from '\.\/firebase';/m);
  assert.match(publicApiSource, /await import\('\.\/firebase'\)/);
  assert.doesNotMatch(publicLinksSource, /from '\.\/firebase'/);
});

test('presenca publica limita espera e evita reenvio duplicado', () => {
  assert.match(publicApiSource, /PUBLIC_API_TIMEOUT_MS = 8_000/);
  assert.match(publicApiSource, /X-Idempotency-Key/);
  assert.match(publicPresenceFunctionSource, /assertIdempotencyKey\(event, \{ required: true \}\)/);
  assert.match(publicPresenceFunctionSource, /withIdempotency\(event, publicContext, idempotencyKey/);
});

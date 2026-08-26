import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const publicAppSource = readFileSync(new URL('../src/PublicLinksApp.tsx', import.meta.url), 'utf8');
const publicPresenceSource = readFileSync(new URL('../src/components/PresencaTempoRealPublica.tsx', import.meta.url), 'utf8');
const adminPresenceSource = readFileSync(new URL('../src/components/ControlePresencaTab.tsx', import.meta.url), 'utf8');
const subscriptionSource = readFileSync(new URL('../src/firebasePublicSubmissions.ts', import.meta.url), 'utf8');
const functionSource = readFileSync(new URL('../netlify/functions/public-presenca.js', import.meta.url), 'utf8');

test('presenca usa somente os componentes novos e remove camadas antigas', () => {
  assert.match(publicAppSource, /PresencaTempoRealPublica/);
  assert.doesNotMatch(publicAppSource, /PresencaLinkExterno/);
  assert.doesNotMatch(appSource, /components\/PresencaUnificada|components\/PresencaTab'/);
  assert.doesNotMatch(adminPresenceSource, /Integração externa|Presença diária|dark:/);
});

test('link publico exige revisao explicita de todos os colaboradores', () => {
  assert.match(publicPresenceSource, /const pending = Math\.max\(0, groupEmployees\.length - reviewed\)/);
  assert.match(publicPresenceSource, /if \(pending > 0\)/);
  assert.match(publicPresenceSource, /disabled=\{submitting \|\| pending > 0\}/);
  assert.doesNotMatch(publicPresenceSource, /status:\s*'Presente'/);
});

test('envios publicos entram no painel em tempo real e por reconciliacao', () => {
  assert.match(subscriptionSource, /onSnapshot\(/);
  assert.match(subscriptionSource, /getDocs\(/);
  assert.match(appSource, /setInterval\(reconcile, 15_000\)/);
  assert.match(appSource, /subscribePendingPublicSubmissions/);
  assert.match(appSource, /writeStorageValue\(localStorage, 'renea_history_logs', JSON\.stringify\(nextHistory\)\)/);
});

test('servico publico reutiliza leitura curta e devolve comprovante do envio', () => {
  assert.match(functionSource, /SNAPSHOT_CACHE_TTL_MS = 15_000/);
  assert.match(functionSource, /resolveGroupEmployeeIds/);
  assert.match(functionSource, /data: \{ submissionId, createdAtIso \}/);
  assert.match(functionSource, /private, max-age=15, stale-while-revalidate=30/);
});

/**
 * P0-06 Offline Queue Recovery Tests
 *
 * Verifica badge de pendencias + retry manual da fila offline.
 * Padrao P0-03: node:test + inspecao de fonte, sem Firebase.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('[P0-06-01] hook useOfflineQueueCount existe e ouve a fila offline', () => {
  const source = read('../src/hooks/useOfflineQueue.ts');
  assert.match(source, /listOfflineCommands/);
  assert.match(source, /renea-offline-queue-change/);
  assert.match(source, /export function useOfflineQueueCount/);
});

test('[P0-06-02] DesktopTopBar expoe badge de pendencias', () => {
  const source = read('../src/app/shell/DesktopTopBar.tsx');
  assert.match(source, /pendingCount/);
  assert.match(source, /Pendente: \{pendingCount\}|Pendente:/);
});

test('[P0-06-03] DesktopTopBar expoe botao de retry manual', () => {
  const source = read('../src/app/shell/DesktopTopBar.tsx');
  assert.match(source, /onRetryPending/);
  assert.match(source, /Tentar agora/);
});

test('[P0-06-04] App passa contagem e retry ao topbar', () => {
  const source = read('../src/App.tsx');
  assert.match(source, /useOfflineQueueCount/);
  assert.match(source, /handleRetryPending/);
  assert.match(source, /flushOfflineCommands/);
  assert.match(source, /pendingCount=\{[^}]*\}/);
});

test('[P0-06-05] drenagem automatica no online continua existindo', () => {
  const source = read('../src/App.tsx');
  assert.match(source, /window\.addEventListener\('online', flush\)/);
});

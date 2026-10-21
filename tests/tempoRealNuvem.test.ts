import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Pedido de 20/10: o que um aparelho grava tem que aparecer nos outros na hora,
// não 5 minutos depois.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const aviso = readFileSync(new URL('../src/supabase/avisoNuvem.ts', import.meta.url), 'utf8');

test('envio que deu certo avisa os outros aparelhos', () => {
  const sucesso = app.indexOf('uploadPendenteRef.current = false;');
  assert.ok(sucesso > 0, 'não achei o fim do envio com sucesso');
  assert.match(app.slice(sucesso, sucesso + 300), /announceCloudVersion\(uploadResult\.updatedAt\)/);
});

test('aparelho ouve as versões novas e confere a nuvem ao reconectar', () => {
  assert.match(app, /listenCloudVersions\(versao => \{/);
  assert.match(app, /requestAutomaticRemoteSyncRef\.current\(versao\)/);
});

test('checagem de reserva roda a cada 30 s e reenvia o que falhou', () => {
  assert.match(app, /const SYNC_FALLBACK_INTERVAL_MS = 30_000;/);
  assert.match(app, /if \(uploadPendenteRef\.current && navigator\.onLine\)/);
  assert.match(app, /uploadPendenteRef\.current = true;/);
});

test('o aviso leva só a versão, nunca os dados', () => {
  assert.match(aviso, /payload: \{ versao \}/);
  assert.match(aviso, /broadcast: \{ self: false \}/);
});

test('aba escondida não baixa a nuvem a cada aviso', () => {
  assert.match(app, /if \(document\.visibilityState === 'hidden'\) return;/);
});

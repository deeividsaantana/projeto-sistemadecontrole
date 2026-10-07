import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Regras de organização do CONTRIBUTING.md: nada de saída local versionada.
const trackedFiles = (() => {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return null;
  }
})();

test('nenhum zip, log, backup ou saída local versionada', { skip: trackedFiles === null }, () => {
  const forbidden = (trackedFiles ?? []).filter(file =>
    /\.(zip|log)$/i.test(file)
    || /^(tmp|artifacts|\.playwright-mcp|netlify|RENEA)\//.test(file)
    || /(^|\/)\.env(\.local)?$/.test(file)
    || file === 'pnpm-lock.yaml');
  assert.deepEqual(forbidden, []);
});

// Testes que existem mas ainda falham. Cada um precisa de correção própria
// antes de entrar em tests/run.ts; esta lista só pode diminuir.
// - materialsAnalytics: unidade 'TON' não conta como tonelada no resumo.
const PENDING_TESTS = new Set(['materialsAnalytics.test']);

test('todo teste de contrato está registrado em tests/run.ts', { skip: trackedFiles === null }, () => {
  const runner = readFileSync(new URL('./run.ts', import.meta.url), 'utf8');
  const unregistered = (trackedFiles ?? [])
    .filter(file => /^tests\/[^/]+\.test\.tsx?$/.test(file))
    .map(file => file.replace(/^tests\//, '').replace(/\.tsx?$/, ''))
    .filter(name => !runner.includes(`import './${name}';`) && !PENDING_TESTS.has(name));
  assert.deepEqual(unregistered, []);
});

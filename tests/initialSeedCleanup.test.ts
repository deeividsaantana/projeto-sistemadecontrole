import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import {
  INITIAL_ABASTECIMENTOS,
  INITIAL_COMBOIOS,
  INITIAL_EMPRESAS,
  INITIAL_EQUIPAMENTOS,
  INITIAL_FUNCIONARIOS,
  INITIAL_GRUPOS_EQUIPES,
  INITIAL_TICKETS_JAZIDA,
} from '../src/utils/initialData';
import { INITIAL_CONTROLE_ESTACAS } from '../src/utils/initialEstacasData';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('navegador novo não grava empresas, comboios, combustível, jazida nem estacas de exemplo', () => {
  assert.deepEqual(INITIAL_EMPRESAS, []);
  assert.deepEqual(INITIAL_COMBOIOS, []);
  assert.deepEqual(INITIAL_EQUIPAMENTOS, []);
  assert.deepEqual(INITIAL_ABASTECIMENTOS, []);
  assert.deepEqual(INITIAL_TICKETS_JAZIDA, []);
  assert.deepEqual(INITIAL_CONTROLE_ESTACAS, { lotes: [], cravacoes: [] });
});

test('as sementes de agosto e da planilha (1,6 MB) não voltam ao app', () => {
  assert.equal(existsSync(new URL('../src/utils/importedAugust2026Seed.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/utils/importedSpreadsheetSeed.ts', import.meta.url)), false);
  assert.doesNotMatch(appSource, /hydrateInitialOperationalSeedData|importedAugust2026Seed|importedSpreadsheetSeed/);
});

test('navegador sem dados continua esperando a nuvem antes de enviar', () => {
  // A primeira carga marca o aparelho; o envio recusa enquanto a marca existir
  // e só o download bem-sucedido a remove.
  assert.match(appSource, /\{ key: AGUARDANDO_PRIMEIRO_DOWNLOAD, value: 'true' \}/);
  assert.match(appSource, /if \(localStorage\.getItem\(AGUARDANDO_PRIMEIRO_DOWNLOAD\)\) \{\s*return \{ success: false/);
});

test('colaboradores e equipes de exemplo não carregam "[object Object]"', () => {
  const corrupted = [...INITIAL_FUNCIONARIOS, ...INITIAL_GRUPOS_EQUIPES]
    .filter(item => JSON.stringify(item).includes('[object Object]'));
  assert.deepEqual(corrupted.map(item => item.id), []);
});

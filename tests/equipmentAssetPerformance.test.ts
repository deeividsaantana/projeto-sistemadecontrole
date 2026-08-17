import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sourceUrl = new URL('../src/components/ManutencaoEquipamentosTab.tsx', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');
const initialDataUrl = new URL('../src/utils/initialData.ts', import.meta.url);
const initialDataSource = readFileSync(initialDataUrl, 'utf8');

test('manutencao usa fotos de equipamentos otimizadas', () => {
  assert.match(source, /assets\/equipment\/optimized\/fleet-truck\.jpg/);
  assert.match(source, /assets\/equipment\/optimized\/neutral-truck\.jpg/);
  assert.doesNotMatch(source, /assets\/equipment\/fleet-truck\.png/);
  assert.doesNotMatch(source, /assets\/equipment\/neutral-truck\.png/);
});

test('manutencao carrega exportadores pesados sob demanda', () => {
  assert.doesNotMatch(source, /^import ExcelJS from 'exceljs';/m);
  assert.doesNotMatch(source, /^import \{ generateUniversalPdfReport \} from '..\/utils\/universalPdfReport';/m);
  assert.match(source, /import\('exceljs'\)/);
  assert.match(source, /import\('..\/utils\/excelCorporate'\)/);
  assert.match(source, /import\('..\/utils\/universalPdfReport'\)/);
});

test('dados iniciais operacionais pesados carregam sob demanda', () => {
  assert.doesNotMatch(initialDataSource, /^import .*from '\.\/importedSpreadsheetSeed';/m);
  assert.doesNotMatch(initialDataSource, /^import .*from '\.\/importedAugust2026Seed';/m);
  assert.match(initialDataSource, /import\('\.\/importedSpreadsheetSeed'\)/);
  assert.match(initialDataSource, /import\('\.\/importedAugust2026Seed'\)/);
});

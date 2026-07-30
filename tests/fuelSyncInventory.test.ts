import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFuelFileHashMap,
  FUEL_SYNC_PARSER_VERSION,
  selectChangedFuelFiles,
  sortFuelFiles,
} from '../scripts/lib/fuel-sync-inventory.mjs';

const files = [
  { name: 'FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx', hash: 'aug', stat: { mtimeMs: 3 } },
  { name: 'FORNECIMENTO DE COMBUSTIVEL - JUNHO2026.xlsx', hash: 'jun', stat: { mtimeMs: 1 } },
  { name: 'FORNECIMENTO DE COMBUSTIVEL - JULHO2026.xlsx', hash: 'jul', stat: { mtimeMs: 2 } },
];

test('atualização do leitor força releitura segura das planilhas conhecidas', () => {
  assert.equal(selectChangedFuelFiles(files, { parserVersion: 1, fileHashes: buildFuelFileHashMap(files) }).length, 3);
});

test('sincronização acompanha hash por arquivo e detecta alteração retroativa', () => {
  const config = { parserVersion: FUEL_SYNC_PARSER_VERSION, fileHashes: buildFuelFileHashMap(files) };
  assert.deepEqual(selectChangedFuelFiles(files, config), []);
  const editedJune = files.map(file => file.name.includes('JUNHO') ? { ...file, hash: 'jun-editado' } : file);
  assert.deepEqual(selectChangedFuelFiles(editedJune, config).map(file => file.name), ['FORNECIMENTO DE COMBUSTIVEL - JUNHO2026.xlsx']);
});

test('remoção de uma planilha também dispara um novo retrato completo', () => {
  const config = { parserVersion: FUEL_SYNC_PARSER_VERSION, fileHashes: buildFuelFileHashMap(files) };
  const withoutJune = files.filter(file => !file.name.includes('JUNHO'));
  assert.deepEqual(selectChangedFuelFiles(withoutJune, config), withoutJune);
});

test('arquivos mensais são processados em ordem cronológica estável', () => {
  assert.deepEqual([...files].sort(sortFuelFiles).map(file => file.hash), ['jun', 'jul', 'aug']);
});

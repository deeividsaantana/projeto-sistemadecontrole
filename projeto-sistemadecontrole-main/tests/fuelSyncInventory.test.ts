import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFuelFileHashMap,
  DEFAULT_FUEL_SYNC_PERIODS,
  FUEL_SYNC_PARSER_VERSION,
  filterFuelFilesByPeriods,
  selectChangedFuelFiles,
  sortFuelFiles,
} from '../scripts/lib/fuel-sync-inventory.mjs';

const files = [
  { name: 'FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx', hash: 'aug', stat: { mtimeMs: 3 } },
  { name: 'FORNECIMENTO DE COMBUSTIVEL - JUNHO2026.xlsx', hash: 'jun', stat: { mtimeMs: 1 } },
  { name: 'FORNECIMENTO DE COMBUSTIVEL - JULHO2026.xlsx', hash: 'jul', stat: { mtimeMs: 2 } },
];
const augustFiles = filterFuelFilesByPeriods(files);

test('sincronização automática acompanha somente a planilha de agosto de 2026', () => {
  assert.deepEqual(augustFiles.map(file => file.name), ['FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx']);
  assert.deepEqual(DEFAULT_FUEL_SYNC_PERIODS, [202608]);
});

test('atualização do leitor força releitura segura somente de agosto', () => {
  assert.equal(selectChangedFuelFiles(augustFiles, { parserVersion: 2, fileHashes: buildFuelFileHashMap(augustFiles) }).length, 1);
});

test('alterações em junho e julho não entram mais no lote automático', () => {
  const config = { parserVersion: FUEL_SYNC_PARSER_VERSION, fileHashes: buildFuelFileHashMap(augustFiles) };
  const editedOldMonths = files.map(file => file.name.includes('AGOSTO') ? file : { ...file, hash: `${file.hash}-editado` });
  assert.deepEqual(selectChangedFuelFiles(filterFuelFilesByPeriods(editedOldMonths), config), []);
});

test('alteração em agosto continua disparando novo retrato', () => {
  const config = { parserVersion: FUEL_SYNC_PARSER_VERSION, fileHashes: buildFuelFileHashMap(augustFiles) };
  const editedAugust = augustFiles.map(file => ({ ...file, hash: 'aug-editado' }));
  assert.deepEqual(selectChangedFuelFiles(editedAugust, config).map(file => file.name), ['FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx']);
});

test('arquivos mensais são processados em ordem cronológica estável', () => {
  assert.deepEqual([...files].sort(sortFuelFiles).map(file => file.hash), ['jun', 'jul', 'aug']);
});

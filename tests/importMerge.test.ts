import assert from 'node:assert/strict';
import { mergeImportedRecords } from '../src/utils/importMerge';

type Row = { id: string; key: string; value: string; criadoEm?: string; atualizadoEm?: string };
const existing: Row[] = [{ id: 'persisted-id', key: '2026-08-13|CB729', value: 'Disponível', criadoEm: 'old' }];
const imported: Row[] = [
  { id: 'spreadsheet-id', key: '2026-08-13|CB729', value: 'Disponível', criadoEm: 'new' },
  { id: 'duplicate-in-file', key: '2026-08-13|CB729', value: 'Disponível' },
  { id: 'new-id', key: '2026-08-13|CB730', value: 'Em operação' },
];

const first = mergeImportedRecords(existing, imported, row => row.key);
assert.equal(first.created, 1);
assert.equal(first.updated, 0);
assert.equal(first.unchanged, 1);
assert.equal(first.duplicated, 1);
assert.equal(first.next[0].id, 'persisted-id');

const second = mergeImportedRecords(first.next, imported, row => row.key);
assert.equal(second.created, 0);
assert.equal(second.updated, 0);
assert.equal(second.unchanged, 2);
assert.equal(second.duplicated, 1);
assert.equal(second.next.length, first.next.length);

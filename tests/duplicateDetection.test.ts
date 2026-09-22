import assert from 'node:assert/strict';
import { countDuplicates, findDuplicateGroups, isDuplicateOfExisting } from '../src/shared/registry/duplicateDetection';

type Item = { id: string; chave: string | null };
const key = (item: Item) => item.chave || undefined;

const items: Item[] = [
  { id: '1', chave: 'abc' },
  { id: '2', chave: 'abc' },
  { id: '3', chave: 'xyz' },
  { id: '4', chave: null },
  { id: '5', chave: null },
];

const groups = findDuplicateGroups(items, key);
assert.equal(groups.get('abc')?.length, 2);
assert.equal(groups.get('xyz')?.length, 1);
assert.equal(groups.has(''), false, 'chave vazia nunca vira grupo');

assert.equal(countDuplicates(items, key), 2, 'só os 2 itens de "abc" contam — chave ausente nunca conta');

assert.equal(isDuplicateOfExisting({ id: '9', chave: 'abc' }, items, key), true);
assert.equal(isDuplicateOfExisting({ id: '9', chave: 'novo' }, items, key), false);
assert.equal(isDuplicateOfExisting({ id: '9', chave: null }, items, key), false, 'candidato sem chave nunca é duplicata');

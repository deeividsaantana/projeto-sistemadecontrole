import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hydrateInitialOperationalSeedData,
  INITIAL_EQUIPAMENTOS,
  INITIAL_FUNCIONARIOS,
  INITIAL_GRUPOS_EQUIPES,
} from '../src/utils/initialData';

test('equipamentos de exemplo não entram na operação local', async () => {
  await hydrateInitialOperationalSeedData();
  const { INITIAL_EQUIPAMENTOS: hydrated } = await import('../src/utils/initialData');
  assert.equal(INITIAL_EQUIPAMENTOS.length, 0);
  assert.equal(hydrated.length, 0);
});

test('colaboradores e equipes de exemplo não carregam "[object Object]"', () => {
  const corrupted = [...INITIAL_FUNCIONARIOS, ...INITIAL_GRUPOS_EQUIPES]
    .filter(item => JSON.stringify(item).includes('[object Object]'));
  assert.deepEqual(corrupted.map(item => item.id), []);
});

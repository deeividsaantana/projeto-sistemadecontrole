import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePresenceLists,
  normalizeRuntimeCollection,
  normalizeStakeControl,
  normalizeTeamGroups,
} from '../src/utils/runtimeDataSafety';

test('coleções zeradas continuam listas válidas', () => {
  assert.deepEqual(normalizeRuntimeCollection([]), []);
  assert.deepEqual(normalizeRuntimeCollection(null), []);
  assert.deepEqual(normalizeRuntimeCollection({}), []);
});

test('listas antigas de presença sem colaboradores não derrubam a interface', () => {
  const [list] = normalizePresenceLists([{ id: 'presence-1', data: '2026-08-25' }]);
  assert.deepEqual(list.funcionarios, []);
});

test('equipes antigas sem vínculos recebem coleções vazias', () => {
  const [group] = normalizeTeamGroups([{ id: 'group-1', nome: 'Equipe antiga' }]);
  assert.deepEqual(group.funcionarioIds, []);
  assert.deepEqual(group.funcionarioMatriculas, []);
});

test('controle de estacas incompleto é normalizado sem inventar registros', () => {
  assert.deepEqual(normalizeStakeControl({ lotes: null }), { lotes: [], cravacoes: [] });
});

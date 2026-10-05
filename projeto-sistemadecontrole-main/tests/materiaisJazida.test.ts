import assert from 'node:assert/strict';
import test from 'node:test';
import { listarMateriais } from '../src/utils/materiaisJazida';

const PADRAO = ['Solo', 'Brita', 'Outros'];

test('material digitado em Outros entra na lista do próximo lançamento', () => {
  const lista = listarMateriais(PADRAO, [{ tipoMaterial: 'Outros', materialOutro: 'Bica corrida' }]);
  assert.deepEqual(lista, ['Solo', 'Brita', 'Bica corrida', 'Outros']);
});

test('material já usado não duplica na lista', () => {
  const lista = listarMateriais(PADRAO, [
    { tipoMaterial: 'Brita', materialOutro: undefined },
    { tipoMaterial: 'Brita', materialOutro: undefined },
  ]);
  assert.deepEqual(lista, ['Solo', 'Brita', 'Outros']);
});

test('Outros fica sempre no fim, como porta de entrada do material novo', () => {
  const lista = listarMateriais(PADRAO, [{ tipoMaterial: 'Rachão', materialOutro: undefined }]);
  assert.equal(lista[lista.length - 1], 'Outros');
  assert.ok(lista.includes('Rachão'));
});

test('sem lançamentos a lista é a padrão', () => {
  assert.deepEqual(listarMateriais(PADRAO, []), ['Solo', 'Brita', 'Outros']);
});

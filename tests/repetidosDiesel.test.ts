import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirNoDia, idsRepetidos, repetidosAoTrocar, trocarData } from '../src/modules/frota/repetidosDiesel';
import type { Abastecimento } from '../src/types';

const ab = (id: string, data: string, equipamentoId: string, litros: number, prefixoInformado = '') => ({
  id, data, hora: '07:00', equipamentoId, prefixoInformado, quantidadeLitros: litros,
} as Abastecimento);

test('mesma máquina, dia e litros trava; litros diferentes só avisam', () => {
  const lista = [ab('a', '2026-10-21', 'eq-1', 120), ab('b', '2026-10-21', 'eq-1', 80), ab('c', '2026-10-20', 'eq-1', 120)];
  const repetido = conferirNoDia(lista, ab('novo', '2026-10-21', 'eq-1', 120));
  assert.equal(repetido.repetido?.id, 'a');
  assert.equal(repetido.doDia.length, 2);
  const outro = conferirNoDia(lista, ab('novo', '2026-10-21', 'eq-1', 95));
  assert.equal(outro.repetido, undefined);
  assert.equal(outro.doDia.length, 2);
});

test('corrigir o próprio lançamento não acusa repetido', () => {
  const lista = [ab('a', '2026-10-21', 'eq-1', 120)];
  assert.equal(conferirNoDia(lista, ab('a', '2026-10-21', 'eq-1', 120)).repetido, undefined);
});

test('sem cadastro compara pelo prefixo digitado', () => {
  const lista = [ab('a', '2026-10-21', '', 50, 'lo 146')];
  assert.equal(conferirNoDia(lista, ab('n', '2026-10-21', '', 50, 'LO146')).repetido?.id, 'a');
  assert.equal(conferirNoDia(lista, ab('n', '2026-10-21', '', 50, '')).repetido, undefined);
});

test('lista marca os dois lados de cada repetido', () => {
  const lista = [ab('a', '2026-10-21', 'eq-1', 120), ab('b', '2026-10-21', 'eq-1', 120), ab('c', '2026-10-21', 'eq-2', 120)];
  assert.deepEqual([...idsRepetidos(lista)].sort(), ['a', 'b']);
});

test('trocar data move a competência junto e conta quem ficaria repetido', () => {
  const lista = [ab('a', '2026-10-20', 'eq-1', 120), ab('b', '2026-10-21', 'eq-1', 120), ab('c', '2026-10-20', 'eq-2', 60)];
  const [movido] = trocarData([lista[0]], '2026-10-22', '2026-10-21T12:00:00.000Z');
  assert.equal(movido.data, '2026-10-22');
  assert.equal(movido.competencia, '2026-10');
  assert.equal(movido.atualizadoEm, '2026-10-21T12:00:00.000Z');
  assert.equal(repetidosAoTrocar(lista, [lista[0]], '2026-10-21'), 1);
  assert.equal(repetidosAoTrocar(lista, [lista[2]], '2026-10-21'), 0);
});

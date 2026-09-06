import assert from 'node:assert/strict';
import test from 'node:test';
import { matrizDoModulo, pode } from '../src/utils/permissoes';

test('operação registra em campo, mas não decide medição nem orçamento', () => {
  assert.equal(pode('operador', 'ocorrencias', 'editar'), true);
  assert.equal(pode('operador', 'medicoes', 'editar'), false);
  assert.equal(pode('operador', 'orcamento', 'editar'), false);
  assert.equal(pode('gestor', 'medicoes', 'editar'), true);
});

test('aprovar medição e orçamento é exclusivo do admin', () => {
  assert.equal(pode('gestor', 'medicoes', 'aprovar'), false);
  assert.equal(pode('admin', 'medicoes', 'aprovar'), true);
  assert.equal(pode('gestor', 'fvs', 'aprovar'), true);
});

test('leitura só vê e ninguém além do admin exclui', () => {
  assert.equal(pode('leitura', 'producao', 'ver'), true);
  assert.equal(pode('leitura', 'producao', 'editar'), false);
  assert.equal(pode('gestor', 'producao', 'excluir'), false);
  assert.equal(pode('admin', 'producao', 'excluir'), true);
});

test('auditoria é exclusiva do admin em qualquer capacidade', () => {
  assert.equal(pode('gestor', 'auditoria', 'ver'), false);
  assert.equal(pode('admin', 'auditoria', 'ver'), true);
});

test('matriz efetiva descreve o que cada papel pode no módulo', () => {
  const matriz = matrizDoModulo('medicoes', ['admin', 'gestor', 'operador', 'leitura']);
  assert.deepEqual(matriz.map(item => item.capacidades.length), [4, 2, 1, 1]);
});

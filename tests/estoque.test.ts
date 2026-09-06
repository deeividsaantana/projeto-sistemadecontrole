import assert from 'node:assert/strict';
import test from 'node:test';
import type { Material, MovimentoMaterial } from '../src/types';
import { efeitoNoSaldo, posicaoEstoque, saldoDoMaterial, validarMovimento } from '../src/utils/estoque';

const movimento = (extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id: 'm1',
  data: '2026-09-01',
  tipo: 'Entrada',
  materialId: 'mat-1',
  materialDescricao: 'Brita',
  quantidade: 10,
  unidade: 'm³',
  responsavel: 'Almoxarife',
  criadoEm: '',
  ...extra,
});

const material = (extra: Partial<Material>): Material => ({
  id: 'mat-1',
  codigo: 'BR-01',
  descricao: 'Brita',
  categoria: 'Agregado',
  unidade: 'm³',
  ativo: true,
  criadoEm: '',
  atualizadoEm: '',
  ...extra,
});

test('entrada soma, saída subtrai e transferência é neutra', () => {
  assert.equal(efeitoNoSaldo({ tipo: 'Entrada', quantidade: 10 }), 10);
  assert.equal(efeitoNoSaldo({ tipo: 'Saída', quantidade: 10 }), -10);
  assert.equal(efeitoNoSaldo({ tipo: 'Transferência', quantidade: 10 }), 0);
});

test('ajuste respeita o sinal informado', () => {
  assert.equal(efeitoNoSaldo({ tipo: 'Ajuste', quantidade: -3 }), -3);
  assert.equal(efeitoNoSaldo({ tipo: 'Ajuste', quantidade: 3 }), 3);
});

test('saldo é a soma dos movimentos do material', () => {
  const base = [
    movimento({ id: 'a', tipo: 'Entrada', quantidade: 100 }),
    movimento({ id: 'b', tipo: 'Saída', quantidade: 30 }),
    movimento({ id: 'c', tipo: 'Ajuste', quantidade: -5 }),
    movimento({ id: 'd', tipo: 'Entrada', quantidade: 50, materialId: 'outro' }),
  ];
  assert.equal(saldoDoMaterial(base, 'mat-1'), 65);
});

test('saldo até uma data ignora movimento posterior', () => {
  const base = [
    movimento({ id: 'a', data: '2026-09-01', quantidade: 100 }),
    movimento({ id: 'b', data: '2026-09-10', quantidade: 50 }),
  ];
  assert.equal(saldoDoMaterial(base, 'mat-1', '2026-09-05'), 100);
});

test('saída maior que o saldo é recusada', () => {
  const base = [movimento({ id: 'a', tipo: 'Entrada', quantidade: 10 })];
  assert.match(String(validarMovimento(base, { id: 'novo', tipo: 'Saída', materialId: 'mat-1', quantidade: 15 })), /negativo/);
  assert.equal(validarMovimento(base, { id: 'novo', tipo: 'Saída', materialId: 'mat-1', quantidade: 10 }), null);
});

test('entrada e ajuste não são travados pelo saldo', () => {
  assert.equal(validarMovimento([], { id: 'x', tipo: 'Entrada', materialId: 'mat-1', quantidade: 5 }), null);
  assert.equal(validarMovimento([], { id: 'x', tipo: 'Ajuste', materialId: 'mat-1', quantidade: -5 }), null);
});

test('posição marca o material abaixo do mínimo', () => {
  const [posicao] = posicaoEstoque(
    [material({ estoqueMinimo: 20 })],
    [movimento({ id: 'a', tipo: 'Entrada', quantidade: 30 }), movimento({ id: 'b', tipo: 'Saída', quantidade: 15 })],
  );
  assert.equal(posicao.saldo, 15);
  assert.equal(posicao.entradas, 30);
  assert.equal(posicao.saidas, 15);
  assert.equal(posicao.abaixoDoMinimo, true);
});

test('material sem mínimo definido nunca fica abaixo do mínimo', () => {
  const [posicao] = posicaoEstoque([material({})], []);
  assert.equal(posicao.abaixoDoMinimo, false);
});

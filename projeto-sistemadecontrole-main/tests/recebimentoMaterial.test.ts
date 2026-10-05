import assert from 'node:assert/strict';
import test from 'node:test';
import {
  faltanteDe,
  pendenciasDeRecebimento,
  recebimentoCompleto,
  resumoDeRecebimento,
} from '../src/utils/recebimentoMaterial';
import type { MovimentoMaterial } from '../src/types';

const entrada = (over: Partial<MovimentoMaterial> = {}): MovimentoMaterial => ({
  id: 'mv-1',
  data: '2026-07-02',
  tipo: 'Entrada',
  materialId: 'mat-1',
  materialDescricao: 'ESTACA MADEIRA C/ PONTA',
  quantidade: 0,
  unidade: 'PC',
  notaFiscal: '4789',
  solicitacaoCompra: 'SC 92998794',
  destino: 'Ramo 1300',
  quantidadeNota: 2000,
  responsavel: 'Deivid',
  criadoEm: '',
  ...over,
});

test('a nota diz 2.000 e chegou nada: 2.000 é carga paga que não está na obra', () => {
  const movimento = entrada();
  assert.equal(faltanteDe(movimento), 2000);
  assert.equal(recebimentoCompleto(movimento), false);
});

test('recebimento parcial mostra exatamente o que falta', () => {
  assert.equal(faltanteDe(entrada({ quantidadeNota: 450, quantidade: 50 })), 400);
});

test('entrega completa não vira pendência', () => {
  const movimento = entrada({ quantidadeNota: 500, quantidade: 500 });
  assert.equal(faltanteDe(movimento), 0);
  assert.equal(recebimentoCompleto(movimento), true);
  assert.deepEqual(pendenciasDeRecebimento([movimento]), []);
});

test('receber a mais não vira pendência negativa', () => {
  assert.equal(faltanteDe(entrada({ quantidadeNota: 100, quantidade: 130 })), 0);
});

test('só entrada tem recebimento a conferir', () => {
  assert.equal(faltanteDe(entrada({ tipo: 'Saída' })), 0);
  assert.equal(faltanteDe(entrada({ tipo: 'Ajuste' })), 0);
  assert.equal(faltanteDe(entrada({ tipo: 'Transferência' })), 0);
});

test('movimento antigo, sem quantidade de nota, não vira pendência falsa', () => {
  assert.equal(faltanteDe(entrada({ quantidadeNota: undefined })), 0);
});

test('as pendências saem da maior para a menor, com a nota e a SC junto', () => {
  const lista = pendenciasDeRecebimento([
    entrada({ id: 'a', quantidadeNota: 450, quantidade: 50 }),
    entrada({ id: 'b', quantidadeNota: 2000, quantidade: 0 }),
    entrada({ id: 'c', quantidadeNota: 300, quantidade: 300 }),
  ]);

  assert.deepEqual(lista.map(item => item.movimentoId), ['b', 'a']);
  assert.equal(lista[0].faltante, 2000);
  assert.equal(lista[0].notaFiscal, '4789');
  assert.equal(lista[0].solicitacaoCompra, 'SC 92998794');
  assert.equal(lista[0].destino, 'Ramo 1300');
});

test('o resumo conta entregas, pendentes e o quanto da nota já chegou', () => {
  const resumo = resumoDeRecebimento([
    entrada({ id: 'a', quantidadeNota: 100, quantidade: 100 }),
    entrada({ id: 'b', quantidadeNota: 100, quantidade: 40 }),
    entrada({ id: 'c', tipo: 'Saída', quantidadeNota: 999 }),
  ]);

  assert.equal(resumo.entregas, 2, 'a saída não é entrega');
  assert.equal(resumo.entregasPendentes, 1);
  assert.equal(resumo.totalFaltante, 60);
  assert.equal(resumo.percentualRecebido, 70);
});

test('sem nenhuma entrega com nota, o percentual não vira zero enganoso', () => {
  assert.equal(resumoDeRecebimento([]).percentualRecebido, 100);
});

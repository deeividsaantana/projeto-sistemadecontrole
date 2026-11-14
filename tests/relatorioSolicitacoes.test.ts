import assert from 'node:assert/strict';
import test from 'node:test';
import { movimentoPorDia, pedidosDoPeriodo, resumoDoPeriodo } from '../src/utils/relatorioSolicitacoes';
import type { Solicitacao } from '../src/utils/solicitacoes';

const item = (recebida = 0) => ({ itemId: 1, tipo: 'Material', descricao: 'Brita', quantidade: 10, unidade: 'm³', prazoDesejado: '2026-11-30', permiteParcial: true, quantidadeRecebida: recebida }) as Solicitacao['itens'][number];
const sol = (id: string, abertaEm: string, extra: Partial<Solicitacao> = {}) => ({
  id, numero: id, abertaEm, solicitante: 'Thiago', frente: 'Ramo 200', itens: [item()], etapa: 'Pendente Suprimentos',
  statusAprovacao: 'Pendente', statusLogistico: 'Aguardando Envio', reagendamentos: [], eventos: [], ...extra,
}) as Solicitacao;

const lista = [
  sol('A', '2026-11-01T10:00:00'),
  sol('B', '2026-11-03T10:00:00', { etapa: 'Entregue', chegadaEm: '2026-11-07T09:00:00', statusAprovacao: 'Aprovado', decisaoEm: '2026-11-04T09:00:00', valorTotal: 1000, itens: [item(10)] }),
  sol('C', '2026-11-05T10:00:00', { solicitante: 'Lucas' }),
  sol('D', '2026-10-20T10:00:00', { etapa: 'Entregue', chegadaEm: '2026-11-02T08:00:00' }),
];

test('Relatório do período: filtra pelo dia em que o pedido foi aberto', () => {
  assert.deepEqual(pedidosDoPeriodo(lista, { from: '2026-11-01', to: '2026-11-05' }).map(s => s.id), ['A', 'B', 'C']);
});

test('Relatório do período: porcentagens somam 100 e contam entregues e itens', () => {
  const resumo = resumoDoPeriodo(pedidosDoPeriodo(lista, { from: '2026-11-01', to: '2026-11-05' }), '2026-11-06');
  assert.equal(resumo.pedidos, 3);
  assert.equal(resumo.pctEntregues, 33);
  assert.equal(resumo.pctItensRecebidos, 33);
  assert.equal(resumo.diasAteEntrega, 4);
  assert.equal(resumo.valorAprovado, 1000);
  assert.equal(resumo.porSolicitante.reduce((soma, parte) => soma + parte.percentual, 0), 100);
  assert.deepEqual(resumo.porSolicitante.map(parte => parte.nome), ['Thiago', 'Lucas']);
});

test('Relatório do período: sem pedido, porcentagem fica "—" (null), não zero', () => {
  assert.equal(resumoDoPeriodo([], '2026-11-06').pctEntregues, null);
});

test('Relatório do período: o movimento por dia conta a entrega de pedido aberto antes', () => {
  const dias = movimentoPorDia(lista, { from: '2026-11-01', to: '2026-11-07' });
  assert.equal(dias.length, 7);
  assert.equal(dias.find(d => d.iso === '2026-11-02')?.entregues, 1);
  assert.equal(dias.find(d => d.iso === '2026-11-04')?.aprovados, 1);
  assert.equal(dias.find(d => d.iso === '2026-11-07')?.entregues, 1);
  assert.equal(dias.reduce((soma, d) => soma + d.abertos, 0), 3);
});

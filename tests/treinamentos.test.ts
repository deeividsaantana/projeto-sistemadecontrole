import assert from 'node:assert/strict';
import test from 'node:test';
import type { Treinamento } from '../src/types';
import { situacaoTreinamento, treinamentosParaAlertar } from '../src/utils/treinamentos';

const treinamento = (extra: Partial<Treinamento>): Treinamento => ({
  id: 't1',
  funcionarioId: 'f1',
  funcionarioNome: 'Colaborador',
  nome: 'NR-35',
  dataRealizacao: '2026-01-10',
  criadoEm: '',
  ...extra,
});

const HOJE = '2026-09-06';

test('treinamento sem vencimento não vence', () => {
  assert.equal(situacaoTreinamento(treinamento({}), HOJE), 'Sem vencimento');
});

test('vencimento passado é vencido', () => {
  assert.equal(situacaoTreinamento(treinamento({ dataVencimento: '2026-09-05' }), HOJE), 'Vencido');
});

test('vencimento dentro do prazo de alerta avisa antes', () => {
  assert.equal(situacaoTreinamento(treinamento({ dataVencimento: '2026-09-20' }), HOJE), 'Vence em breve');
  assert.equal(situacaoTreinamento(treinamento({ dataVencimento: '2026-10-06' }), HOJE), 'Vence em breve');
});

test('vencimento distante segue válido', () => {
  assert.equal(situacaoTreinamento(treinamento({ dataVencimento: '2026-12-01' }), HOJE), 'Válido');
});

test('alerta lista vencidos e vencendo, do mais urgente ao menos', () => {
  const alertas = treinamentosParaAlertar([
    treinamento({ id: 'valido', dataVencimento: '2027-01-01' }),
    treinamento({ id: 'breve', dataVencimento: '2026-09-20' }),
    treinamento({ id: 'vencido', dataVencimento: '2026-08-01' }),
    treinamento({ id: 'sem-data' }),
  ], HOJE);
  assert.deepEqual(alertas.map(item => item.treinamento.id), ['vencido', 'breve']);
  assert.equal(alertas[0].situacao, 'Vencido');
});

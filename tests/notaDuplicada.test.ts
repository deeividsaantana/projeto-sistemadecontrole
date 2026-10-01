import assert from 'node:assert/strict';
import test from 'node:test';
import type { MovimentoMaterial } from '../src/types';
import { CANCELADO_POR_DUPLICIDADE, desfazerNotasRepetidas, separarRepetidosDaImportacao } from '../src/modules/materials/notaDuplicada';

const mov = (id: string, extra: Partial<MovimentoMaterial> = {}): MovimentoMaterial => ({
  id, data: '2026-10-01', tipo: 'Entrada', materialId: 'brita', materialDescricao: 'Brita 1', quantidade: 10, unidade: 'm³',
  criadoEm: `2026-10-01T10:00:0${id.length}Z`, ...extra,
}) as MovimentoMaterial;

const agora = '2026-10-01T15:00:00.000Z';

test('nota repetida do mesmo fornecedor e material: fica o primeiro, os outros são desfeitos', () => {
  const lista = [
    mov('b', { notaFiscal: '1234', fornecedorNome: 'Pedreira X', criadoEm: '2026-10-01T11:00:00Z' }),
    mov('a', { notaFiscal: '1234', fornecedorNome: 'Pedreira X', criadoEm: '2026-10-01T09:00:00Z' }),
    mov('c', { notaFiscal: '001.234', fornecedorNome: 'pedreira x', criadoEm: '2026-10-01T12:00:00Z' }),
  ];
  const { movimentos, desfeitos } = desfazerNotasRepetidas(lista, agora);
  assert.deepEqual(desfeitos.map(item => item.id).sort(), ['b', 'c']);
  assert.equal(movimentos.length, 3, 'nada some da lista');
  const a = movimentos.find(item => item.id === 'a');
  assert.equal(a?.canceladoEm, undefined, 'o primeiro continua valendo');
  const b = movimentos.find(item => item.id === 'b');
  assert.equal(b?.canceladoEm, agora);
  assert.equal(b?.canceladoPor, CANCELADO_POR_DUPLICIDADE);
  assert.match(b?.observacao || '', /nota 1234 já lançada/);
});

test('mesma nota com materiais diferentes fica com todos', () => {
  const { desfeitos } = desfazerNotasRepetidas([
    mov('a', { notaFiscal: '55', fornecedorNome: 'F' }),
    mov('bb', { notaFiscal: '55', fornecedorNome: 'F', materialId: 'areia' }),
  ], agora);
  assert.equal(desfeitos.length, 0);
});

test('mesmo número de nota de fornecedores diferentes não é repetição', () => {
  const { desfeitos } = desfazerNotasRepetidas([
    mov('a', { notaFiscal: '55', fornecedorNome: 'Pedreira X' }),
    mov('bb', { notaFiscal: '55', fornecedorNome: 'Pedreira Y' }),
  ], agora);
  assert.equal(desfeitos.length, 0);
});

test('ticket repetido do mesmo material também é desfeito; sem nota nem ticket nada acontece', () => {
  const { desfeitos } = desfazerNotasRepetidas([
    mov('a', { ticket: 'T-900', tipo: 'Saída' }),
    mov('bb', { ticket: 'T900', tipo: 'Saída' }),
    mov('ccc', { tipo: 'Saída' }),
    mov('dddd', { tipo: 'Saída' }),
  ], agora);
  assert.deepEqual(desfeitos.map(item => item.id), ['bb']);
});

test('lançamento já desfeito não conta e a regra não mexe de novo no que já resolveu', () => {
  const primeira = desfazerNotasRepetidas([mov('a', { notaFiscal: '9' }), mov('bb', { notaFiscal: '9' })], agora);
  const segunda = desfazerNotasRepetidas(primeira.movimentos, '2026-10-02T00:00:00Z');
  assert.equal(segunda.desfeitos.length, 0);
  const soCancelado = desfazerNotasRepetidas([mov('a', { notaFiscal: '9', canceladoEm: agora }), mov('bb', { notaFiscal: '9' })], agora);
  assert.equal(soCancelado.desfeitos.length, 0, 'se o primeiro foi desfeito à mão, o outro passa a valer');
});

test('importação: nota já lançada no app ou repetida no arquivo fica de fora', () => {
  const atuais = [mov('a', { notaFiscal: '100', fornecedorNome: 'F' })];
  const novos = [
    mov('n1', { notaFiscal: '100', fornecedorNome: 'F' }),
    mov('n2', { notaFiscal: '200', fornecedorNome: 'F' }),
    mov('n3', { notaFiscal: '200', fornecedorNome: 'F' }),
    mov('n4'),
  ];
  const { aceitos, repetidos } = separarRepetidosDaImportacao(atuais, novos);
  assert.deepEqual(aceitos.map(item => item.id), ['n2', 'n4']);
  assert.equal(repetidos, 2);
});

test('viagens da jazida: ticket repetido no mesmo tipo sai, fica o primeiro registrado', async () => {
  const { ticketsRepetidosParaExcluir } = await import('../src/utils/ticketDuplicateDetection');
  const t = (id: string, ticketNumero: string, extra: Record<string, unknown> = {}) => ({ id, data: '2026-10-01', ticketNumero, tipoTicket: 'Liberação' as const, ...extra });
  const repetidos = ticketsRepetidosParaExcluir([
    t('novo', '450', { criadoEm: '2026-10-01T12:00:00Z' }),
    t('antigo', '450', { criadoEm: '2026-10-01T08:00:00Z' }),
    t('outro-tipo', '450', { tipoTicket: 'Recebimento', criadoEm: '2026-10-01T13:00:00Z' }),
    t('sem-numero-1', ''),
    t('sem-numero-2', ''),
  ]);
  assert.deepEqual(repetidos.map(item => item.id), ['novo']);
});

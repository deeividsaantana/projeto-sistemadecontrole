import assert from 'node:assert/strict';
import test from 'node:test';
import { proximoNumeroFvs, resumoFvs, situacaoSugerida, validarFvs } from '../src/utils/fvs';
import type { FichaVerificacaoServico, ItemFvs, RespostaFvs } from '../src/types';

const item = (id: string, resposta: RespostaFvs, obrigatorio = true): ItemFvs => ({
  itemId: id,
  descricao: id,
  obrigatorio,
  resposta,
});

const ficha = (extra: Partial<FichaVerificacaoServico> = {}): FichaVerificacaoServico => ({
  id: 'f1',
  numero: 'FVS-2026-0001',
  data: '2026-01-05',
  modeloId: 'm1',
  modeloNome: 'Verificação',
  local: 'Estaca 10+20',
  itens: [item('a', 'Conforme'), item('b', 'Conforme', false)],
  situacao: 'Aprovada',
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-05',
  atualizadoEm: '2026-01-05',
  ...extra,
});

test('item obrigatório não conforme impede a aprovação', () => {
  const problema = validarFvs(ficha({ itens: [item('a', 'Não conforme'), item('b', 'Conforme')] }));
  assert.match(String(problema), /Não é possível aprovar/);
});

test('liberação com pendência exige justificativa escrita', () => {
  const itens = [item('a', 'Não conforme', false), item('b', 'Conforme')];
  assert.match(String(validarFvs(ficha({ itens, situacao: 'Liberada com pendência' }))), /justificativa/);
  assert.equal(validarFvs(ficha({ itens, situacao: 'Liberada com pendência', observacao: 'Corrigir na próxima etapa' })), null);
});

test('ficha em preenchimento aceita item sem resposta, encerramento não', () => {
  const itens = [item('a', '' as RespostaFvs), item('b', 'Conforme')];
  assert.equal(validarFvs(ficha({ itens, situacao: 'Em preenchimento' })), null);
  assert.match(String(validarFvs(ficha({ itens, situacao: 'Aprovada' }))), /Responda todos os itens/);
});

test('reprovar sem não conformidade é recusado', () => {
  assert.match(String(validarFvs(ficha({ situacao: 'Reprovada' }))), /sem item não conforme/);
});

test('situação sugerida acompanha as respostas', () => {
  assert.equal(situacaoSugerida([item('a', '' as RespostaFvs)]), 'Em preenchimento');
  assert.equal(situacaoSugerida([item('a', 'Não conforme')]), 'Reprovada');
  assert.equal(situacaoSugerida([item('a', 'Não conforme', false)]), 'Liberada com pendência');
  assert.equal(situacaoSugerida([item('a', 'Conforme'), item('b', 'Não aplicável')]), 'Aprovada');
});

test('resumo e numeração sequencial por ano', () => {
  const resumo = resumoFvs([item('a', 'Conforme'), item('b', 'Não conforme'), item('c', 'Não aplicável', false)]);
  assert.deepEqual(resumo, { total: 3, conformes: 1, naoConformes: 1, naoAplicaveis: 1, obrigatoriosPendentes: 1 });
  assert.equal(proximoNumeroFvs([], 2026), 'FVS-2026-0001');
  assert.equal(proximoNumeroFvs([ficha({ numero: 'FVS-2026-0007' })], 2026), 'FVS-2026-0008');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aplicarSituacao,
  descreverMudanca,
  estaNoEfetivo,
  situacaoAtualDe,
} from '../src/utils/situacaoColaborador';
import type { Funcionario } from '../src/types';

const pessoa = (over: Partial<Funcionario> = {}): Funcionario => ({
  id: 'f-1',
  matricula: '103177',
  nome: 'João Batista dos Santos',
  cargo: 'PEDREIRO',
  telefone: '',
  empresaId: 'emp-1',
  ativo: true,
  status: 'ATIVO',
  ...over,
});

test('desligar grava a data de saída e tira a pessoa do efetivo', () => {
  const r = aplicarSituacao(pessoa(), { situacao: 'DESMOBILIZADO', data: '2026-09-10', motivo: 'Fim de contrato', por: 'Deivid' });

  assert.equal(r.status, 'DESMOBILIZADO');
  assert.equal(r.ativo, false, 'sai do efetivo disponível');
  assert.equal(r.dataDesmobilizacao, '2026-09-10');
  assert.match(r.situacaoRh || '', /ATIVO → DESMOBILIZADO em 2026-09-10/);
  assert.match(r.situacaoRh || '', /Fim de contrato/);
  assert.match(r.situacaoRh || '', /por Deivid/);
});

test('férias não desliga ninguém: a pessoa continua no efetivo da obra', () => {
  const r = aplicarSituacao(pessoa(), { situacao: 'FÉRIAS', data: '2026-09-10' });

  assert.equal(r.status, 'FÉRIAS');
  assert.equal(r.ativo, true, 'quem está de férias volta — não sai do efetivo');
  assert.equal(r.dataDesmobilizacao, undefined);
  assert.equal(estaNoEfetivo(r), true);
});

test('afastado também continua no efetivo', () => {
  assert.equal(estaNoEfetivo(aplicarSituacao(pessoa(), { situacao: 'AFASTADO', data: '2026-09-10' })), true);
});

test('voltar para ativo apaga a data de saída anterior', () => {
  const desligado = aplicarSituacao(pessoa(), { situacao: 'DESMOBILIZADO', data: '2026-08-01' });
  const readmitido = aplicarSituacao(desligado, { situacao: 'ATIVO', data: '2026-09-10' });

  assert.equal(readmitido.dataDesmobilizacao, undefined, 'quem voltou não tem data de saída');
  assert.equal(readmitido.ativo, true);
});

test('a situação de um cadastro antigo sem o campo vem do ativo', () => {
  assert.equal(situacaoAtualDe({ ativo: true }), 'ATIVO');
  assert.equal(situacaoAtualDe({ ativo: false }), 'INATIVO');
});

test('a mudança é descrita em português, para o histórico', () => {
  const texto = descreverMudanca(pessoa(), { situacao: 'FÉRIAS', data: '2026-09-10', motivo: 'Férias programadas' });
  assert.equal(texto, 'João Batista dos Santos: ATIVO → FÉRIAS em 2026-09-10. Motivo: Férias programadas');
});

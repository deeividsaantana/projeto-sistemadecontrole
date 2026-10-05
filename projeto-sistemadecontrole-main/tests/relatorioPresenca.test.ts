import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diasDoPeriodo,
  pessoasDia,
  pizzaDasSituacoes,
  pizzaEmCampoPorEmpresa,
  relatorioPorColaborador,
  relatorioPorEquipe,
  resumoDoPeriodo,
  serieDiaria,
} from '../src/utils/relatorioPresenca';
import type { Empresa, Funcionario, PresencaApontamento } from '../src/types';

const registro = (over: Partial<PresencaApontamento>): PresencaApontamento => ({
  id: 'r', data: '2026-09-10', horaEnvio: '07:00', grupoId: 'g-1', grupoNome: 'Equipe A',
  responsavel: 'Renilson', frenteServico: 'Ramo 100', funcionarioId: 'c-1',
  funcionarioNome: 'João Batista', funcao: 'PEDREIRO', status: 'Presente', observacao: '',
  tokenUsado: '', createdAt: '', ...over,
});

test('o período lista cada dia sem pular a virada do mês', () => {
  assert.deepEqual(diasDoPeriodo('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  assert.deepEqual(diasDoPeriodo('2026-10-02', '2026-09-29'), []);
});

test('a mesma pessoa no mesmo dia conta uma vez, pelo envio mais recente', () => {
  const linhas = pessoasDia([
    registro({ id: 'a', horaEnvio: '07:00', status: 'Ausente' }),
    registro({ id: 'b', horaEnvio: '09:30', status: 'Presente' }),
    registro({ id: 'c', data: '2026-08-31' }),
    registro({ id: 'd', funcionarioId: 'c-2', inativoEm: '2026-09-11' }),
  ], '2026-09-01', '2026-09-30');
  assert.equal(linhas.length, 1, 'fora do período e inativado não entram');
  assert.equal(linhas[0].id, 'b');
});

test('férias não derrubam a taxa de presença; falta derruba', () => {
  const linhas = [
    registro({ funcionarioId: 'c-1', status: 'Presente' }),
    registro({ funcionarioId: 'c-2', status: 'Atraso' }),
    registro({ funcionarioId: 'c-3', status: 'Ausente' }),
    registro({ funcionarioId: 'c-4', status: 'Atestado' }),
    registro({ funcionarioId: 'c-5', status: 'Férias' }),
  ];
  const resumo = resumoDoPeriodo(linhas, '2026-09-10', '2026-09-12');
  assert.equal(resumo.taxa, 50, '2 em campo de 4 que deviam vir');
  assert.equal(resumo.faltas, 1);
  assert.equal(resumo.justificadas, 1);
  assert.equal(resumo.afastamentos, 1);
  assert.equal(resumo.diasComEnvio, 1);
  assert.equal(resumo.diasNoPeriodo, 3);
  assert.equal(resumo.mediaEmCampo, 2);
});

test('sem ninguém esperado não existe taxa, e não vira zero', () => {
  assert.equal(resumoDoPeriodo([registro({ status: 'Férias' })], '2026-09-10', '2026-09-10').taxa, null);
  assert.equal(resumoDoPeriodo([], '2026-09-10', '2026-09-10').taxa, null);
});

test('a série tem todos os dias do período, com dia sem envio marcado', () => {
  const serie = serieDiaria([registro({ data: '2026-09-11', status: 'Ausente' })], '2026-09-10', '2026-09-11');
  assert.equal(serie.length, 2);
  assert.deepEqual([serie[0].total, serie[0].taxa], [0, null]);
  assert.deepEqual([serie[1].faltas, serie[1].taxa, serie[1].rotulo], [1, 0, '11/09']);
});

test('a pizza das situações soma 100% e tem cor fixa por situação', () => {
  const pizza = pizzaDasSituacoes([
    registro({ funcionarioId: 'a' }), registro({ funcionarioId: 'b' }), registro({ funcionarioId: 'c', status: 'Ausente' }),
  ]);
  assert.equal(pizza.total, 3);
  assert.equal(pizza.fatias.reduce((soma, fatia) => soma + fatia.percentual, 0), 100);
  assert.equal(pizza.fatias.find(fatia => fatia.chave === 'presente')?.cor, '#1baf7a');
  assert.equal(pizza.fatias.find(fatia => fatia.chave === 'falta')?.cor, '#eb6834');
});

test('a pizza por empresa conta só quem esteve em campo e diz quem ficou sem empresa', () => {
  const funcionarios = [{ id: 'c-1', empresaId: 'e-1' }, { id: 'c-2', empresaId: 'e-1' }] as Funcionario[];
  const empresas = [{ id: 'e-1', nome: 'RENEA' }] as Empresa[];
  const pizza = pizzaEmCampoPorEmpresa([
    registro({ funcionarioId: 'c-1' }),
    registro({ funcionarioId: 'c-2', status: 'Ausente' }),
    registro({ funcionarioId: 'c-9' }),
  ], funcionarios, empresas);
  assert.equal(pizza.total, 1);
  assert.equal(pizza.fatias[0].nome, 'RENEA');
  assert.equal(pizza.deFora, 1);
});

test('equipe e pessoa com pior presença aparecem primeiro', () => {
  const linhas = [
    registro({ grupoId: 'g-1', grupoNome: 'Boa', funcionarioId: 'c-1' }),
    registro({ grupoId: 'g-2', grupoNome: 'Ruim', funcionarioId: 'c-2', status: 'Ausente' }),
    registro({ grupoId: 'g-2', grupoNome: 'Ruim', funcionarioId: 'c-2', data: '2026-09-11', status: 'Ausente' }),
  ];
  const equipes = relatorioPorEquipe(linhas);
  assert.deepEqual(equipes.map(item => [item.nome, item.taxa]), [['Ruim', 0], ['Boa', 100]]);
  const pessoas = relatorioPorColaborador(linhas, [{ id: 'c-2', matricula: '123' } as Funcionario]);
  assert.equal(pessoas[0].chave, 'c-2');
  assert.equal(pessoas[0].faltas, 2);
  assert.equal(pessoas[0].dias, 2);
  assert.equal(pessoas[0].matricula, '123');
  assert.equal(pessoas[0].ultimoDia, '2026-09-11');
});

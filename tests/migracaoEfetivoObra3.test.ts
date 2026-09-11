import assert from 'node:assert/strict';
import test from 'node:test';
import { migrarEfetivoObra3 } from '../src/utils/migracaoEfetivoObra3';
import type { FrenteServico, Funcionario, GrupoEquipe } from '../src/types';

const pessoa = (matricula: string, extra: Partial<Funcionario> = {}): Funcionario => ({
  id: `fun-${matricula}`, matricula, nome: `PESSOA ${matricula}`, cargo: 'AJUDANTE',
  telefone: '', empresaId: 'emp-1', ativo: true, ...extra,
} as Funcionario);

const equipe = (lider: string, extra: Partial<GrupoEquipe> = {}): GrupoEquipe => ({
  id: `grp-${lider}`, nome: `EQUIPE ${lider}`, responsavel: `ENC ${lider}`, liderMatricula: lider,
  frenteServico: 'TERRAPLENAGEM', obraId: 'obr-1', funcionarioIds: [], funcionarioMatriculas: [],
  status: 'ativo', token: `token-${lider}`, linkAtivo: true, createdAt: '', updatedAt: '', ...extra,
} as GrupoEquipe);

const frente = (nome: string): FrenteServico => ({
  id: `frt-${nome}`, nome, obraId: 'obr-1', situacao: 'Planejada', ativo: true,
  criadoEm: '', atualizadoEm: '',
} as FrenteServico);

test('quem saiu da planilha vira inativo, nunca é apagado', () => {
  const local = [pessoa('1'), pessoa('2')];
  const r = migrarEfetivoObra3(local, [], [], [pessoa('1')], [], []);
  assert.equal(r.funcionarios.length, 2, 'os dois continuam no cadastro');
  assert.equal(r.funcionarios.find(p => p.matricula === '2')!.ativo, false);
  assert.equal(r.resumo.inativados, 1);
});

test('o token do link público sobrevive à migração', () => {
  const antigo = equipe('900', { token: 'token-que-esta-no-celular-do-encarregado', id: 'grp-antigo' });
  const novo = equipe('900', { token: 'token-novo', id: 'grp-novo', nome: 'EQUIPE ATUALIZADA' });
  const r = migrarEfetivoObra3([], [antigo], [], [], [novo], []);
  const migrada = r.grupos[0];
  assert.equal(migrada.token, 'token-que-esta-no-celular-do-encarregado', 'o link em campo continua valendo');
  assert.equal(migrada.id, 'grp-antigo', 'o id antigo é mantido para o histórico não ficar órfão');
  assert.equal(migrada.nome, 'EQUIPE ATUALIZADA', 'mas os dados de RH são os novos');
  assert.equal(r.resumo.equipesReaproveitadas, 1);
});

test('equipe cujo encarregado saiu fica inativa, com o token preservado', () => {
  const r = migrarEfetivoObra3([], [equipe('700')], [], [], [equipe('800')], []);
  const antiga = r.grupos.find(g => g.liderMatricula === '700')!;
  assert.equal(antiga.status, 'inativo');
  assert.equal(antiga.token, 'token-700');
  assert.equal(r.resumo.equipesInativadas, 1);
});

test('a equipe aponta para o id que o colaborador já tinha', () => {
  const local = [pessoa('55', { id: 'fun-id-antigo' })];
  const novo = equipe('9', { funcionarioMatriculas: ['55'] });
  const r = migrarEfetivoObra3(local, [], [], [pessoa('55')], [novo], []);
  assert.deepEqual(r.grupos[0].funcionarioIds, ['fun-id-antigo']);
});

test('frente existente não é sobrescrita; só entra a que falta', () => {
  const r = migrarEfetivoObra3([], [], [frente('Ramo 100')], [], [], [frente('Ramo 100'), frente('Ramo 2000')]);
  assert.deepEqual(r.frentes.map(f => f.nome), ['Ramo 100', 'Ramo 2000']);
  assert.equal(r.resumo.frentesIncluidas, 1);
});

test('o link geral sobrevive quando a equipe que o guardava fica inativa', () => {
  const antiga = equipe('700', { tokenGeral: 'geral-link-que-esta-em-campo' });
  const r = migrarEfetivoObra3([], [antiga], [], [], [equipe('800')], []);
  const ativa = r.grupos.find(g => g.status === 'ativo')!;
  const inativa = r.grupos.find(g => g.status === 'inativo')!;
  assert.equal(ativa.tokenGeral, 'geral-link-que-esta-em-campo', 'o link geral passou para uma equipe ativa');
  assert.equal(inativa.tokenGeral, undefined, 'a equipe inativa parou de anunciar o link geral');
  assert.equal(r.resumo.tokenGeralPreservado, true);
});

test('link geral em equipe que continua ativa não é movido à toa', () => {
  const antiga = equipe('900', { tokenGeral: 'geral-x' });
  const r = migrarEfetivoObra3([], [antiga], [], [], [equipe('900')], []);
  assert.equal(r.grupos[0].tokenGeral, 'geral-x');
  assert.equal(r.resumo.tokenGeralPreservado, false, 'não houve transferência');
});

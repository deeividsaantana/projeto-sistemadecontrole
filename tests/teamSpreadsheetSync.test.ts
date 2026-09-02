import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTeamSyncPlan,
  buildTeamSyncPlan,
  normalizeRegistration,
  parseEfetivoRows,
} from '../src/utils/teamSpreadsheetSync';
import type { Funcionario, GrupoEquipe } from '../src/types';

const linha = (mat: string, nome: string, enc: string, area = 'TERRAPLENAGEM') => ({
  'MAT. COLAB.': mat,
  NOME: nome,
  'FUNÇÃO': 'AUXILIAR GERAL',
  'MAT. LÍDER': '190001',
  'NOME ENCARREGADO': enc,
  'ÁREA': area,
  RESPONSAVEL: 'CONSTANTINO DEMETRIO FILHO',
});

const funcionario = (mat: string, nome: string): Funcionario => ({
  id: `fun-${mat}`, matricula: mat, nome, cargo: 'AUXILIAR GERAL', telefone: '', empresaId: 'emp-1', ativo: true,
});

const base = {
  funcionarios: [funcionario('101671', 'ANDERSON PEIXOTO'), funcionario('102364', 'JOSE ILDO')],
  obraId: 'obr-1',
  empresaId: 'emp-1',
  criarToken: () => 'token-novo',
  agoraIso: '2026-09-02T12:00:00.000Z',
};

test('cada encarregado vira uma equipe, com a composicao da planilha', () => {
  const { linhas } = parseEfetivoRows([
    linha('101671', 'ANDERSON PEIXOTO', 'RENILSON DOS SANTOS'),
    linha('102364', 'JOSE ILDO', 'RENILSON DOS SANTOS'),
    linha('103205', 'ARIANY SOUSA', 'PAULO CESAR', 'SESMT'),
  ]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [] });

  assert.equal(plan.entradas.length, 2);
  assert.equal(plan.resumo.criar, 2);
  const renilson = plan.entradas.find(e => e.responsavel === 'RENILSON DOS SANTOS')!;
  assert.equal(renilson.nome, 'TERRAPLENAGEM - RENILSON DOS SANTOS');
  assert.equal(renilson.total, 2);
});

test('o token da equipe existente e preservado: o link em campo continua valendo', () => {
  const existente: GrupoEquipe = {
    id: 'grp-1', nome: 'TERRAPLENAGEM - RENILSON DOS SANTOS', responsavel: 'Renilson Dos Santos',
    frenteServico: 'TERRAPLENAGEM', obraId: 'obr-1', funcionarioIds: ['fun-101671'],
    status: 'ativo', token: 'token-ja-distribuido', linkAtivo: true, createdAt: '', updatedAt: '',
  };
  const { linhas } = parseEfetivoRows([
    linha('101671', 'ANDERSON PEIXOTO', 'RENILSON DOS SANTOS'),
    linha('102364', 'JOSE ILDO', 'RENILSON DOS SANTOS'),
  ]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [existente] });
  const [entry] = plan.entradas;

  assert.equal(entry.acao, 'atualizar');
  assert.equal(entry.grupo.token, 'token-ja-distribuido');
  assert.equal(entry.grupo.id, 'grp-1');
  assert.deepEqual(entry.entram.map(f => f.matricula), ['102364']);
  assert.deepEqual(entry.saem, []);
});

test('colaborador da planilha sem cadastro e criado, e nao some do apontamento', () => {
  const { linhas } = parseEfetivoRows([linha('999123', 'NOVO NA OBRA', 'RENILSON DOS SANTOS')]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [] });

  assert.equal(plan.colaboradoresNovos.length, 1);
  assert.equal(plan.colaboradoresNovos[0].nome, 'NOVO NA OBRA');
  assert.equal(plan.colaboradoresNovos[0].ativo, true);
  assert.deepEqual(plan.entradas[0].grupo.funcionarioIds, ['fun-999123']);
});

test('equipe fora da planilha e desativada, nunca apagada', () => {
  const antiga: GrupoEquipe = {
    id: 'grp-antiga', nome: 'CIVIL - QUEM SAIU', responsavel: 'QUEM SAIU', frenteServico: 'CIVIL',
    obraId: 'obr-1', funcionarioIds: ['fun-101671'], status: 'ativo', token: 'tok', linkAtivo: true,
    createdAt: '', updatedAt: '',
  };
  const { linhas } = parseEfetivoRows([linha('102364', 'JOSE ILDO', 'RENILSON DOS SANTOS')]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [antiga] });

  const desativada = plan.entradas.find(e => e.acao === 'desativar')!;
  assert.equal(desativada.grupo.id, 'grp-antiga');
  assert.equal(desativada.grupo.status, 'inativo');
  assert.equal(desativada.grupo.linkAtivo, false);

  const { gruposEquipe } = applyTeamSyncPlan(plan, base.funcionarios, [antiga]);
  assert.equal(gruposEquipe.some(g => g.id === 'grp-antiga'), true, 'a equipe continua existindo');
});

test('ninguem fica em duas equipes: vale o ultimo encarregado da planilha', () => {
  const { linhas } = parseEfetivoRows([
    linha('101671', 'ANDERSON PEIXOTO', 'RENILSON DOS SANTOS'),
    linha('101671', 'ANDERSON PEIXOTO', 'EDSON MARTINS DA SILVA'),
  ]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [] });

  const comAnderson = plan.entradas.filter(e => e.grupo.funcionarioIds.includes('fun-101671'));
  assert.equal(comAnderson.length, 1);
  assert.equal(comAnderson[0].responsavel, 'EDSON MARTINS DA SILVA');
});

test('equipe sem mudanca nao e reescrita a toa', () => {
  const existente: GrupoEquipe = {
    id: 'grp-1', nome: 'TERRAPLENAGEM - RENILSON DOS SANTOS', responsavel: 'RENILSON DOS SANTOS',
    frenteServico: 'TERRAPLENAGEM', obraId: 'obr-1', funcionarioIds: ['fun-101671'],
    status: 'ativo', token: 'tok', linkAtivo: true, createdAt: '', updatedAt: '',
  };
  const { linhas } = parseEfetivoRows([linha('101671', 'ANDERSON PEIXOTO', 'RENILSON DOS SANTOS')]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [existente] });

  assert.equal(plan.entradas[0].acao, 'inalterada');
  assert.equal(plan.resumo.inalteradas, 1);
});

test('linha sem matricula ou sem encarregado e reportada, nao descartada em silencio', () => {
  const { linhas, ignoradas } = parseEfetivoRows([
    { ...linha('101671', 'ANDERSON PEIXOTO', 'RENILSON DOS SANTOS') },
    { ...linha('', 'SEM MATRICULA', 'RENILSON DOS SANTOS') },
    { ...linha('102364', 'SEM ENCARREGADO', '') },
    {},
  ]);

  assert.equal(linhas.length, 1);
  assert.equal(ignoradas.length, 2);
  assert.match(ignoradas[0].motivo, /sem matrícula/i);
  assert.match(ignoradas[1].motivo, /sem encarregado/i);
});

test('matricula casa mesmo com zero a esquerda ou formatacao diferente', () => {
  assert.equal(normalizeRegistration('0101671'), '101671');
  assert.equal(normalizeRegistration(101671), '101671');
  assert.equal(normalizeRegistration('101.671'), '101671');

  const { linhas } = parseEfetivoRows([linha('0101671', 'ANDERSON PEIXOTO', 'RENILSON DOS SANTOS')]);
  const plan = buildTeamSyncPlan({ ...base, linhas, gruposEquipe: [] });
  assert.equal(plan.colaboradoresNovos.length, 0, 'reaproveita o cadastro existente');
  assert.deepEqual(plan.entradas[0].grupo.funcionarioIds, ['fun-101671']);
});

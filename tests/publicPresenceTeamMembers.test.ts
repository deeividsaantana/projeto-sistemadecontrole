import assert from 'node:assert/strict';
import test from 'node:test';
import { __testing } from '../netlify/functions/public-presenca.js';

const snapshot = {
  gruposEquipe: [
    {
      id: 'group-1',
      nome: 'Equipe Terraplenagem',
      responsavel: 'Alvaro Alves Vilela',
      frenteServico: 'Terraplenagem',
      obraId: 'obra-1',
      funcionarioIds: ['employee-1'],
      status: 'ativo',
      token: 'token-equipe-1',
      linkAtivo: true,
    },
    {
      id: 'group-2',
      nome: 'Equipe Civil',
      responsavel: 'Jose Augusto Chagas Araujo',
      frenteServico: 'Civil',
      obraId: 'obra-1',
      funcionarioIds: ['employee-2'],
      status: 'ativo',
      token: 'token-equipe-2',
      linkAtivo: true,
    },
  ],
  funcionarios: [
    { id: 'employee-1', matricula: '101234', nome: 'Francisco Gomes Filho', cargo: 'Operador', empresaId: 'company-1', ativo: true },
    { id: 'employee-2', matricula: '101562', nome: 'Denis do Prado Pimenta', cargo: 'Auxiliar Geral', empresaId: 'company-1', ativo: true },
    { id: 'employee-3', matricula: '101564', nome: 'Eudes dos Santos Matheus', cargo: 'Operador de Caminhao', empresaId: 'company-1', ativo: true },
    { id: 'employee-4', matricula: '101565', nome: 'Jeam Oliveira da Silva', cargo: 'Motorista Pipa', empresaId: 'company-1', ativo: false },
  ],
  empresas: [{ id: 'company-1', nome: 'RENEA', status: 'ATIVO' }],
  obras: [{ id: 'obra-1', nome: 'Alto Tiete', status: 'Ativa' }],
};

test('o link so oferece para inclusao quem esta ativo e fora das equipes', () => {
  const config = __testing.getPublicConfig(snapshot, 'token-equipe-1');

  const disponiveis = config.funcionariosDisponiveis.map(employee => employee.id);
  assert.deepEqual(disponiveis, ['employee-2', 'employee-3']);
  // O inativo nunca aparece, mesmo estando no cadastro.
  assert.equal(disponiveis.includes('employee-4'), false);
  // Quem ja esta na equipe do token tambem nao aparece.
  assert.equal(disponiveis.includes('employee-1'), false);
});

test('o catalogo de inclusao nao expoe telefone nem vinculo hierarquico', () => {
  const config = __testing.getPublicConfig(snapshot, 'token-equipe-1');
  const [employee] = config.funcionariosDisponiveis;

  assert.deepEqual(Object.keys(employee).sort(), ['cargo', 'empresaId', 'id', 'matricula', 'nome']);
});

test('colaborador incluido pelo link entra na equipe e sai dos disponiveis', () => {
  const additions = new Map([['group-1', ['employee-3']]]);
  const config = __testing.getPublicConfig(snapshot, 'token-equipe-1', additions);

  assert.deepEqual(config.gruposEquipe[0].funcionarioIds.sort(), ['employee-1', 'employee-3']);
  assert.equal(config.funcionarios.some(employee => employee.id === 'employee-3'), true);
  assert.deepEqual(config.funcionariosDisponiveis.map(employee => employee.id), ['employee-2']);
});

test('inclusao de quem saiu do efetivo ativo e ignorada, sem quebrar a equipe', () => {
  const additions = new Map([['group-1', ['employee-4', 'employee-inexistente']]]);
  const employees = snapshot.funcionarios.filter(employee => employee.ativo);
  const [group] = __testing.applyTeamAdditions(
    __testing.resolveGroupEmployeeIds([snapshot.gruposEquipe[0]], employees),
    additions,
    employees,
  );

  assert.deepEqual(group.funcionarioIds, ['employee-1']);
});

test('cada equipe/colaborador tem um identificador estavel e proprio', () => {
  assert.equal(
    __testing.teamMemberDocId('group-1', 'employee-3'),
    __testing.teamMemberDocId('group-1', 'employee-3'),
  );
  assert.notEqual(
    __testing.teamMemberDocId('group-1', 'employee-3'),
    __testing.teamMemberDocId('group-2', 'employee-3'),
  );
});

test('o envio completo aceita o colaborador incluido depois da montagem da equipe', () => {
  const employees = snapshot.funcionarios.filter(employee => employee.ativo);
  const [group] = __testing.applyTeamAdditions(
    __testing.resolveGroupEmployeeIds([snapshot.gruposEquipe[0]], employees),
    new Map([['group-1', ['employee-3']]]),
    employees,
  );

  const { records } = __testing.buildPresenceRecords({
    group,
    employees,
    date: '2026-09-02',
    items: [
      { funcionarioId: 'employee-1', status: 'Presente', observacao: '' },
      { funcionarioId: 'employee-3', status: 'Presente', observacao: 'Entrou na frente as 9h' },
    ],
    token: 'token-equipe-1',
  });

  assert.equal(records.length, 2);
  assert.equal(records.find(record => record.funcionarioId === 'employee-3')?.funcionarioNome, 'Eudes dos Santos Matheus');
});

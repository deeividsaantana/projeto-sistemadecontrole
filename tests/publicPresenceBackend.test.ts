import assert from 'node:assert/strict';
import test from 'node:test';
import { __testing } from '../netlify/functions/public-presenca.js';

const employees = [
  { id: 'employee-1', matricula: 'A-101', nome: 'Ana Lima', cargo: 'Apontadora', empresaId: 'company-1', ativo: true },
  { id: 'employee-2', matricula: 'A-102', nome: 'Bruno Silva', cargo: 'Motorista', empresaId: 'company-1', ativo: true },
];

const group = {
  id: 'group-1',
  nome: 'Equipe Norte',
  responsavel: 'Ana Lima',
  frenteServico: 'Terraplenagem',
  obraId: 'work-1',
  funcionarioIds: [],
  funcionarioMatriculas: ['A-101', 'A-102'],
  status: 'ativo',
  linkAtivo: true,
  token: 'team-secure-token',
  tokenGeral: 'geral-secure-token',
};

test('backend publico resolve equipes antigas vinculadas por matricula', () => {
  const config = __testing.getPublicConfig({
    gruposEquipe: [group],
    funcionarios: employees,
    empresas: [{ id: 'company-1', nome: 'RENEA', status: 'ATIVO' }],
    obras: [{ id: 'work-1', nome: 'Obra Norte', status: 'Ativa' }],
  }, group.token);

  assert.ok(config);
  assert.deepEqual(config.gruposEquipe[0].funcionarioIds, ['employee-1', 'employee-2']);
  assert.equal(config.funcionarios.length, 2);
  assert.equal(config.funcionarios[0].telefone, '');
});

test('backend publico aceita somente uma situacao valida por colaborador', () => {
  const [resolvedGroup] = __testing.resolveGroupEmployeeIds([group], employees);
  const result = __testing.buildPresenceRecords({
    group: resolvedGroup,
    employees,
    date: '2026-08-25',
    token: group.token,
    items: [
      { funcionarioId: 'employee-1', status: 'Presente', observacao: '' },
      { funcionarioId: 'employee-2', status: 'Atestado', observacao: 'Documento entregue' },
    ],
  });

  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].funcionarioNome, 'Ana Lima');
  assert.match(result.records[0].tokenUsado, /^validado-/);
  assert.throws(() => __testing.buildPresenceRecords({
    group: resolvedGroup,
    employees,
    date: '2026-08-25',
    token: group.token,
    items: [{ funcionarioId: 'employee-1', status: 'Presente', observacao: '' }],
  }), /lista da equipe mudou ou está incompleta/i);
});

test('backend rejeita datas ISO que nao existem no calendario', async () => {
  const source = await import('../netlify/functions/_shared/firebase-admin.js');
  assert.equal(source.isIsoDate('2026-02-29'), false);
  assert.equal(source.isIsoDate('2026-02-28'), true);
  assert.equal(source.isIsoDate('2026-13-01'), false);
});

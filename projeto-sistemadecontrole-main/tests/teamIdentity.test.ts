import assert from 'node:assert/strict';
import test from 'node:test';
import type { Funcionario, GrupoEquipe, PresencaApontamento } from '../src/types';
import { readableTeamText, recoverTeamGroups, teamRecordMatches } from '../src/utils/teamIdentity';

const brokenGroup = { id: 'team-1', nome: { legado: 'sem campo legível' }, responsavel: { legado: true }, frenteServico: 'DIVERSOS', funcionarioIds: ['employee-1'], status: 'ativo', linkAtivo: true } as unknown as GrupoEquipe;

test('texto de equipe nunca renderiza a conversão implícita de objeto', () => {
  assert.equal(readableTeamText({ nome: 'Terraplenagem' }), 'Terraplenagem');
  assert.equal(readableTeamText({ legado: true }), '');
  assert.equal(readableTeamText('[object Object]'), '');
});

test('nome corrompido é recuperado pelo apontamento mais recente do grupo', () => {
  const records = [{ grupoId: 'team-1', grupoNome: 'Nome antigo', data: '2026-09-20', horaEnvio: '08:00' }, { grupoId: 'team-1', grupoNome: 'TERRAPLENAGEM - RODRIGO CORREA LIMA', responsavel: 'RODRIGO CORREA LIMA', data: '2026-09-25', horaEnvio: '09:53' }] as PresencaApontamento[];
  const [group] = recoverTeamGroups([brokenGroup], records);
  assert.equal(group.nome, 'TERRAPLENAGEM - RODRIGO CORREA LIMA');
  assert.equal(group.responsavel, 'RODRIGO CORREA LIMA');
});

test('sem histórico, equipe usa o encarregado identificado pela matrícula', () => {
  const employee = { id: 'employee-1', matricula: '123', nome: 'MARIA SILVA' } as Funcionario;
  const [group] = recoverTeamGroups([{ ...brokenGroup, liderMatricula: '123' }], [], [employee]);
  assert.equal(group.nome, 'DIVERSOS - MARIA SILVA');
});

test('reconstrói nome e área pela matrícula do líder da planilha de efetivo', () => {
  const [group] = recoverTeamGroups([{ ...brokenGroup, nome: 'DIVERSOS', frenteServico: 'DIVERSOS', liderMatricula: '103243' }]);
  assert.equal(group.nome, 'TERRAPLENAGEM - RODRIGO CORREA LIMA');
  assert.equal(group.frenteServico, 'TERRAPLENAGEM');
});

test('apontamento legado do Rodrigo casa pela identidade mesmo com grupoId antigo', () => {
  const [group] = recoverTeamGroups([{ ...brokenGroup, id: 'grupo-atual', nome: 'DIVERSOS', frenteServico: 'DIVERSOS', liderMatricula: '103243' }]);
  const record = { grupoId: 'grupo-antigo', grupoNome: 'TERRAPLENAGEM - RODRIGO CORREA LIMA', responsavel: 'RODRIGO CORREA LIMA' } as PresencaApontamento;
  assert.equal(teamRecordMatches(group, record), true);
});

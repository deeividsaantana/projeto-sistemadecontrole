import assert from 'node:assert/strict';
import test from 'node:test';
import { linhasDasEquipes, SEM_EQUIPE } from '../src/utils/exportarEquipes';
import type { Empresa, Funcionario, GrupoEquipe } from '../src/types';

const pessoa = (over: Partial<Funcionario>): Funcionario => ({
  id: 'f', nome: 'Pessoa', cargo: 'SERVENTE', telefone: '', empresaId: 'e-1', ativo: true, ...over,
});
const grupo = (over: Partial<GrupoEquipe>): GrupoEquipe => ({
  id: 'g', nome: 'Equipe', responsavel: 'Renilson', frenteServico: 'Ramo 100', funcionarioIds: [],
  status: 'ativo', token: 't', linkAtivo: true, createdAt: '', updatedAt: '', ...over,
});
const empresas: Empresa[] = [{ id: 'e-1', nome: 'RENEA' } as Empresa];

test('cada pessoa sai na linha da sua equipe, com empresa e encarregado', () => {
  const linhas = linhasDasEquipes(
    [grupo({ id: 'g-b', nome: 'Terraplanagem', funcionarioIds: ['f-2', 'f-1'] }), grupo({ id: 'g-a', nome: 'Drenagem', funcionarioIds: ['f-3'], linkAtivo: false })],
    [pessoa({ id: 'f-1', nome: 'Zé', matricula: '10' }), pessoa({ id: 'f-2', nome: 'Ana' }), pessoa({ id: 'f-3', nome: 'Bia' })],
    empresas,
  );
  assert.deepEqual(linhas.map(l => [l.equipe, l.colaborador]), [['Drenagem', 'Bia'], ['Terraplanagem', 'Ana'], ['Terraplanagem', 'Zé']]);
  assert.equal(linhas[0].situacaoEquipe, 'Inativa');
  assert.equal(linhas[2].matricula, '10');
  assert.equal(linhas[2].empresa, 'RENEA');
  assert.equal(linhas[2].encarregado, 'Renilson');
});

test('quem está ativo e fora de toda equipe entra no fim como sem equipe; inativo solto fica fora', () => {
  const linhas = linhasDasEquipes(
    [grupo({ funcionarioIds: ['f-1', 'sumiu'] })],
    [pessoa({ id: 'f-1', nome: 'Ana' }), pessoa({ id: 'f-2', nome: 'Caio', area: 'Ramo 200', liderNome: 'Jorge' }), pessoa({ id: 'f-3', nome: 'Davi', ativo: false })],
    empresas,
  );
  assert.deepEqual(linhas.map(l => l.colaborador), ['Ana', 'Caio']);
  assert.equal(linhas[1].equipe, SEM_EQUIPE);
  assert.equal(linhas[1].frente, 'Ramo 200');
  assert.equal(linhas[1].encarregado, 'Jorge');
});

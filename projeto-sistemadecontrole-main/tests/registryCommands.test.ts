import assert from 'node:assert/strict';
import test from 'node:test';
import type { Empresa, Equipamento, Funcionario } from '../src/types';
import { inactivateEmpresa, inactivateEquipamento, inactivateFuncionario, normalizeEmpresa, normalizeFuncionario, saveRegistryItem } from '../src/masterData/registryCommands';

const empresa: Empresa = { id: 'e1', nome: 'Parceira', cnpj: '', telefone: '', responsavel: '', tipos: ['FORNECEDOR'], status: 'INATIVO', criadoEm: 'anterior' };
const funcionario: Funcionario = { id: 'f1', nome: 'Pessoa', cargo: '', telefone: '', empresaId: 'e1', ativo: true, status: 'DESMOBILIZADO', criadoEm: 'anterior' };

test('empresa editada preserva tipo, status e data de criação', () => {
  const result = normalizeEmpresa({ ...empresa, tipos: [], status: undefined, criadoEm: undefined }, empresa, 'agora');
  assert.deepEqual(result.tipos, ['FORNECEDOR']);
  assert.equal(result.status, 'INATIVO');
  assert.equal(result.criadoEm, 'anterior');
  assert.equal(result.atualizadoEm, 'agora');
});

test('colaborador desmobilizado fica inativo sem perder identidade e criação', () => {
  const result = normalizeFuncionario({ ...funcionario, criadoEm: undefined }, funcionario, 'agora');
  assert.equal(result.ativo, false);
  assert.equal(result.status, 'DESMOBILIZADO');
  assert.equal(result.criadoEm, 'anterior');
});

test('cadastro novo entra no fim e edição preserva posição dos demais', () => {
  const second = { ...empresa, id: 'e2' };
  assert.deepEqual(saveRegistryItem([empresa], second, true).map(item => item.id), ['e1', 'e2']);
  assert.deepEqual(saveRegistryItem([empresa, second], { ...empresa, nome: 'Revista' }, false).map(item => item.nome), ['Revista', 'Parceira']);
});

test('inativação de empresa preserva identidade, tipos e data de criação', () => {
  const next = inactivateEmpresa({ ...empresa, status: 'ATIVO' }, 'agora');
  assert.equal(next.id, empresa.id);
  assert.equal(next.status, 'INATIVO');
  assert.deepEqual(next.tipos, empresa.tipos);
  assert.equal(next.criadoEm, empresa.criadoEm);
  assert.equal(next.atualizadoEm, 'agora');
});

test('desmobilização de colaborador mantém matrícula e vínculos', () => {
  const next = inactivateFuncionario({ ...funcionario, status: 'ATIVO' }, 'agora');
  assert.equal(next.id, funcionario.id);
  assert.equal(next.empresaId, funcionario.empresaId);
  assert.equal(next.status, 'DESMOBILIZADO');
  assert.equal(next.ativo, false);
  assert.equal(next.atualizadoEm, 'agora');
});

test('desmobilização de equipamento mantém referências operacionais', () => {
  const equipamento = { id: 'eq1', status: 'Ativo', empresaId: 'e1', localAtualId: 'o1', operadorResponsavelId: 'f1' } as Equipamento;
  const next = inactivateEquipamento(equipamento);
  assert.equal(next.id, equipamento.id);
  assert.equal(next.empresaId, equipamento.empresaId);
  assert.equal(next.localAtualId, equipamento.localAtualId);
  assert.equal(next.operadorResponsavelId, equipamento.operadorResponsavelId);
  assert.equal(next.status, 'Desmobilizado');
  assert.equal(next.mobilizado, false);
});

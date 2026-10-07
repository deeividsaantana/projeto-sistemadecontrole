import assert from 'node:assert/strict';
import test from 'node:test';
import type { Empresa, Equipamento, Funcionario } from '../src/types';
import { mergeEmpresaImport, mergeEquipamentoImport, mergeFuncionarioImport } from '../src/masterData/registryImportMerge';

test('planilha sem status preserva inativação, tipos e criação de empresa', () => {
  const saved = { id: 'e1', nome: 'Parceira', cnpj: '1', tipos: ['EMPRESA', 'FORNECEDOR'], status: 'INATIVO', criadoEm: 'antigo' } as Empresa;
  const sheet = { id: 'import', nome: 'Parceira', cnpj: '1', tipos: ['FORNECEDOR'], status: 'ATIVO', criadoEm: 'novo' } as Empresa;
  const result = mergeEmpresaImport(saved, sheet, false);
  assert.equal(result.status, 'INATIVO');
  assert.deepEqual(result.tipos, ['EMPRESA', 'FORNECEDOR']);
  assert.equal(result.criadoEm, 'antigo');
  assert.equal(mergeEmpresaImport(saved, sheet, true).status, 'ATIVO');
});

test('planilha sem situação não remobiliza equipamento nem apaga local existente', () => {
  const saved = { id: 'eq1', status: 'Desmobilizado', mobilizado: false, localAtualId: 'o1' } as Equipamento;
  const sheet = { id: 'import', status: 'Ativo', mobilizado: false, localAtualId: '' } as Equipamento;
  const result = mergeEquipamentoImport(saved, sheet, false, false);
  assert.equal(result.status, 'Desmobilizado');
  assert.equal(result.mobilizado, false);
  assert.equal(result.localAtualId, 'o1');
  assert.equal(mergeEquipamentoImport(saved, sheet, true, true).status, 'Ativo');
});

test('planilha sem situação não reativa colaborador nem troca data de criação', () => {
  const saved = { id: 'f1', status: 'DESMOBILIZADO', ativo: false, criadoEm: 'antigo' } as Funcionario;
  const sheet = { id: 'import', status: 'ATIVO', ativo: true, criadoEm: 'novo' } as Funcionario;
  const result = mergeFuncionarioImport(saved, sheet, false);
  assert.equal(result.status, 'DESMOBILIZADO');
  assert.equal(result.ativo, false);
  assert.equal(result.criadoEm, 'antigo');
  assert.equal(mergeFuncionarioImport(saved, sheet, true).ativo, true);
});

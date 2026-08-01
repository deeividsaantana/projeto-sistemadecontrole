import assert from 'node:assert/strict';
import {
  duplicateRecordId,
  isActiveCollaborator,
  nextMasterId,
  normalizeRegistryKey,
  registrySummary,
} from '../src/masterData/centralRegistry';

assert.equal(normalizeRegistryKey(' cb-1005 '), 'CB1005');
assert.equal(nextMasterId('COL', ['COL-0001', 'COL-0010', 'legado']), 'COL-0011');
assert.equal(duplicateRecordId([{ id: '1', matricula: '001.234' }], '001234', item => item.matricula), '1');
assert.equal(isActiveCollaborator({ id: '1', nome: 'A', cargo: 'B', telefone: '', empresaId: '', ativo: true, status: 'DESMOBILIZADO' }), false);

assert.deepEqual(registrySummary({
  empresas: [{ id: 'e1', nome: 'Fornecedor', cnpj: '', telefone: '', responsavel: '', tipos: ['FORNECEDOR'] }],
  equipamentos: [
    { id: 'q1', prefixo: 'EQ1', nome: 'Escavadeira', tipo: 'Escavadeira', marca: '', modelo: '', seriePlaca: '', empresaId: '', status: 'Ativo', localAtualId: '', observacao: '' },
    { id: 'v1', prefixo: 'CB1', nome: 'Caminhão', tipo: 'Caminhão', marca: '', modelo: '', seriePlaca: '', empresaId: '', status: 'Ativo', localAtualId: '', observacao: '', categoriaFrota: 'Veículo' },
  ],
  funcionarios: [{ id: 'c1', matricula: '1', nome: 'Pessoa', cargo: 'Função', telefone: '', empresaId: '', ativo: true, status: 'ATIVO' }],
  obras: [{ id: 'o1', nome: 'Ramo 200', endereco: '', responsavel: '', status: 'Ativa' }],
}), {
  colaboradoresAtivos: 1,
  colaboradoresDesmobilizados: 0,
  equipamentosAtivos: 1,
  veiculos: 1,
  fornecedores: 1,
  locais: 1,
  inconsistencias: 0,
});

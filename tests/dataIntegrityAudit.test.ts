import assert from 'node:assert/strict';
import { auditOperationalIntegrity } from '../src/utils/dataIntegrityAudit';

const issues = auditOperationalIntegrity({
  empresas: [{ id: 'e1', nome: 'Empresa X', cnpj: '', telefone: '', responsavel: '' }],
  equipamentos: [
    { id: 'q1', prefixo: 'CB 729', nome: 'Basculante', tipo: 'Basculante', marca: '', modelo: '', seriePlaca: 'ABC-1D23', empresaId: 'e1', status: 'Ativo', localAtualId: '', observacao: '' },
    { id: 'q2', prefixo: 'cb-729', nome: 'Duplicado', tipo: 'Basculante', marca: '', modelo: '', seriePlaca: 'ABC1D23', empresaId: 'inexistente', status: 'Ativo', localAtualId: '', observacao: '' },
  ],
  funcionarios: [], grupos: [], controles: [], ordens: [],
});
assert.ok(issues.some(item => item.title === 'Prefixo duplicado'));
assert.ok(issues.some(item => item.title === 'Placa duplicado'));
assert.ok(issues.some(item => item.category === 'Problema de vínculo'));

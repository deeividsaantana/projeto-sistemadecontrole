import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseWorkServices } from '../src/next/services/repositories/servicesRepository';

test('serviços da obra são filtrados e situações inválidas não são autorizadas', () => {
  assert.deepEqual(normalizeSupabaseWorkServices([
    {
      id: 'servico-1', project_id: 'obra-1', codigo: 'SRV-01', descricao: 'Pavimentação', unidade: 'M2',
      quantidade_prevista: 1000, situacao: 'Ativo', observacao: null, ativo: true,
      created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
    },
    {
      id: 'servico-2', project_id: 'obra-2', codigo: null, descricao: 'Outra obra', unidade: 'M',
      quantidade_prevista: null, situacao: 'Ativo', observacao: null, ativo: true,
      created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
    },
    {
      id: 'servico-3', project_id: 'obra-1', codigo: null, descricao: 'Inválido', unidade: 'M',
      quantidade_prevista: null, situacao: 'Excluído', observacao: null, ativo: false,
      created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
    },
  ], 'obra-1'), [{
    id: 'servico-1', projectId: 'obra-1', code: 'SRV-01', description: 'Pavimentação', unit: 'M2',
    plannedQuantity: 1000, status: 'Ativo', observation: undefined, active: true,
    createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z',
  }]);
});

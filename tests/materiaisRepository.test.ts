import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseMateriais } from '../src/next/services/repositories/materiaisRepository';

test('materiais Supabase mapeiam campos opcionais sem inventar valores', () => {
  assert.deepEqual(normalizeSupabaseMateriais([
    {
      id: 'material-1',
      codigo: null,
      descricao: 'Brita 1',
      categoria: null,
      unidade: 'M3',
      fornecedor_padrao_id: null,
      estoque_minimo: null,
      observacao: null,
      ativo: true,
      created_at: '2026-10-03T00:00:00Z',
      updated_at: '2026-10-03T00:00:00Z',
    },
  ]), [{
    id: 'material-1',
    codigo: '',
    descricao: 'Brita 1',
    categoria: '',
    unidade: 'M3',
    fornecedorPadraoId: undefined,
    estoqueMinimo: undefined,
    observacao: undefined,
    ativo: true,
    criadoEm: '2026-10-03T00:00:00Z',
    atualizadoEm: '2026-10-03T00:00:00Z',
  }]);
});

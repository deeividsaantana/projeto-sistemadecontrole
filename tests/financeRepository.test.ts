import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseLancamentos, normalizeSupabaseOrcamentos } from '../src/next/services/repositories/financeRepository';

test('orçamento Supabase preserva categoria válida e projeto opcional', () => {
  assert.deepEqual(normalizeSupabaseOrcamentos([
    {
      id: 'orc-1', project_id: 'obra-1', competencia: '2026-10', categoria: 'Material',
      valor_orcado: 1250.5, responsavel: 'Ana', observacao: null, ativo: true,
      created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
    },
    {
      id: 'orc-2', project_id: null, competencia: '2026-13', categoria: 'Invalida',
      valor_orcado: 100, responsavel: 'Ana', observacao: null, ativo: true,
      created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
    },
  ]), [{
    id: 'orc-1', competencia: '2026-10', categoria: 'Material', valorOrcado: 1250.5,
    obraId: 'obra-1', observacao: undefined, responsavel: 'Ana', ativo: true,
    criadoEm: '2026-10-03T00:00:00Z', atualizadoEm: '2026-10-03T00:00:00Z',
  }]);
});

test('lançamentos Supabase preservam fornecedor, frente e documento opcionais', () => {
  const [lancamento] = normalizeSupabaseLancamentos([{
    id: 'custo-1', project_id: 'obra-1', fornecedor_id: 'forn-1', data: '2026-10-03',
    categoria: 'Locação', descricao: 'Locação de equipamento', valor: 500,
    frente: 'Ramo 900', documento: 'NF-10', responsavel: 'Ana', observacao: null,
    ativo: true, created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z',
  }]);

  assert.equal(lancamento.fornecedorId, 'forn-1');
  assert.equal(lancamento.frente, 'Ramo 900');
  assert.equal(lancamento.valor, 500);
});

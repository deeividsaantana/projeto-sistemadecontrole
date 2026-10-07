import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseParceiros } from '../src/next/services/repositories/administracaoRepository';

test('parceiros Supabase preservam dados de fornecedor e normalizam campos nulos', () => {
  assert.deepEqual(normalizeSupabaseParceiros([{
    id: 'parceiro-1',
    nome: 'Pedraforte',
    cnpj: null,
    telefone: '11999999999',
    responsavel: null,
    tipos: ['FORNECEDOR', 'MATERIAIS', 'LOCACAO_EQUIPAMENTOS', 'TIPO_INVALIDO'],
    status: 'ATIVO',
    created_at: '2026-10-03T00:00:00Z',
    updated_at: '2026-10-03T00:00:00Z',
  }]), [{
    id: 'parceiro-1',
    nome: 'Pedraforte',
    cnpj: '',
    telefone: '11999999999',
    responsavel: '',
    tipos: ['FORNECEDOR', 'MATERIAIS', 'LOCACAO_EQUIPAMENTOS'],
    status: 'ATIVO',
    criadoEm: '2026-10-03T00:00:00Z',
    atualizadoEm: '2026-10-03T00:00:00Z',
  }]);
});

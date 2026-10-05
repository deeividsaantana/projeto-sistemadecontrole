import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseEtapas } from '../src/next/services/repositories/administracaoRepository';

test('etapas Supabase preservam somente registros com id e nome', () => {
  assert.deepEqual(normalizeSupabaseEtapas([
    { id: 'etapa-1', nome: 'Drenagem' },
    { id: '', nome: 'Sem id' },
    { id: 'etapa-2', nome: '' },
  ]), [
    { id: 'etapa-1', nome: 'Drenagem' },
  ]);
});

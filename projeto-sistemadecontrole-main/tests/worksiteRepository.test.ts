import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseWorksites } from '../src/next/services/repositories/worksiteRepository';

test('obras Supabase são filtradas pela organização ativa', () => {
  const worksites = normalizeSupabaseWorksites(
    [
      { id: 'obra-1', organization_id: 'renea', name: 'Rodovia da Serra' },
      { id: 'obra-2', organization_id: 'renea', name: 'Complexo do Alto Tietê' },
      { id: 'obra-3', organization_id: 'outra', name: 'Obra externa' },
      { id: '', organization_id: 'renea', name: 'Sem id' },
    ],
    'renea',
  );

  assert.deepEqual(worksites, [
    { id: 'obra-1', organizationId: 'renea', name: 'Rodovia da Serra' },
    { id: 'obra-2', organizationId: 'renea', name: 'Complexo do Alto Tietê' },
  ]);
});

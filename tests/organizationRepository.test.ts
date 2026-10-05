import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupabaseOrganizations } from '../src/next/services/repositories/organizationRepository';

test('organizações Supabase são limitadas às memberships e contam projetos por organização', () => {
  const organizations = normalizeSupabaseOrganizations(
    [
      { id: 'renea', name: 'RENEA Infraestrutura' },
      { id: 'sem-acesso', name: 'Sem acesso' },
    ],
    [
      { organization_id: 'renea', role: 'admin' },
    ],
    [
      { organization_id: 'renea' },
      { organization_id: 'renea' },
      { organization_id: 'outra' },
    ],
  );

  assert.deepEqual(organizations, [{
    id: 'renea',
    name: 'RENEA Infraestrutura',
    slug: 'renea',
    plan: 'Profissional',
    status: 'active',
    userRole: 'admin',
    worksitesCount: 2,
  }]);
});

test('papéis Supabase não administrativos ficam somente leitura no catálogo', () => {
  const [organization] = normalizeSupabaseOrganizations(
    [{ id: 'renea', name: 'RENEA Infraestrutura' }],
    [{ organization_id: 'renea', role: 'editor' }],
    [],
  );

  assert.equal(organization.userRole, 'engenheiro');
  assert.equal(organization.worksitesCount, 0);
});

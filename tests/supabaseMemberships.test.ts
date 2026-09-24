import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMembershipRows, type MembershipRow, type ProjectRow } from '../src/supabase/memberships';

test('normaliza membership e lista somente projetos da mesma organização', () => {
  const memberships: MembershipRow[] = [
    { organization_id: 'org-1', role: 'editor' },
    { organization_id: 'org-2', role: 'admin' },
  ];
  const projects: ProjectRow[] = [
    { id: 'p-1', organization_id: 'org-1' },
    { id: 'p-2', organization_id: 'org-1' },
    { id: 'p-3', organization_id: 'org-2' },
  ];

  assert.deepEqual(normalizeMembershipRows(memberships, projects), [
    { organizationId: 'org-1', role: 'editor', projectIds: ['p-1', 'p-2'] },
    { organizationId: 'org-2', role: 'admin', projectIds: ['p-3'] },
  ]);
});

test('descarta linhas incompletas sem criar escopo autorizado', () => {
  assert.deepEqual(normalizeMembershipRows([
    { organization_id: '', role: 'editor' },
    { organization_id: 'org-1', role: '' },
  ], [{ id: 'p-1', organization_id: 'org-1' }]), []);
});
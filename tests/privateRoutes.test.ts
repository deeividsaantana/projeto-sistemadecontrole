import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrivatePath, parsePrivatePath } from '../src/app/routing/privateRoutes';
import { resolveActiveScope, resolveScopeForPath } from '../src/app/context/activeScope';

test('rotas privadas exigem organizacao, obra e modulo validos', () => {
  assert.deepEqual(parsePrivatePath('/app/org-1/projeto-2/materials'), {
    organizationId: 'org-1', projectId: 'projeto-2', module: 'materials', rest: [],
  });
  assert.equal(parsePrivatePath('/app/org-1/materials'), null);
  assert.equal(parsePrivatePath('/app/org-1/projeto-2/unknown'), null);
  assert.equal(parsePrivatePath('/ticket-link/token'), null);
  assert.equal(parsePrivatePath('/app/%2F/projeto-2/materials'), null);
});

test('caminho canonico codifica ids sem permitir segmentos extras', () => {
  assert.equal(buildPrivatePath({ organizationId: 'org 1', projectId: 'p 2', module: 'materials', rest: ['imports'] }), '/app/org%201/p%202/materials/imports');
  assert.throws(() => buildPrivatePath({ organizationId: '../other', projectId: 'p2', module: 'materials', rest: [] }));
});

test('escopo ativo depende de membership e vinculo de obra', () => {
  const memberships = [{ organizationId: 'org-1', role: 'gestor', projectIds: ['p-1'] }];
  assert.deepEqual(resolveActiveScope('org-1', 'p-1', memberships), { organizationId: 'org-1', projectId: 'p-1', role: 'gestor' });
  assert.equal(resolveActiveScope('org-2', 'p-1', memberships), null);
  assert.equal(resolveActiveScope('org-1', 'p-2', memberships), null);
  assert.equal(resolveActiveScope('org-1', 'p-1', []), null);
});

test('rota privada só ganha escopo quando a membership autoriza a URL', () => {
  const memberships = [{ organizationId: 'org-1', role: 'editor', projectIds: ['p-1'] }];
  assert.deepEqual(resolveScopeForPath('/app/org-1/p-1/materials', memberships), {
    organizationId: 'org-1', projectId: 'p-1', role: 'editor',
  });
  assert.equal(resolveScopeForPath('/app/org-2/p-1/materials', memberships), null);
  assert.equal(resolveScopeForPath('/presenca-link/token', memberships), null);
});

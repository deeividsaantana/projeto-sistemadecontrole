import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_NAVIGATION_ITEMS,
  ROLE_ACCESS,
  normalizeUserRole,
} from '../src/app/navigation/navigation';

test('perfil administrador mantém acesso a todos os módulos atuais', () => {
  assert.deepEqual(
    [...ROLE_ACCESS.admin],
    ALL_NAVIGATION_ITEMS.map(item => item.id),
  );
});

test('perfis preservam as restrições atuais', () => {
  assert.equal(ROLE_ACCESS.gestor.includes('configuracoes'), false);
  assert.deepEqual([...ROLE_ACCESS.leitura], ['dashboard', 'reports']);
  assert.equal(ROLE_ACCESS.operador.includes('lancamentos'), true);
  assert.equal(ROLE_ACCESS.operador.includes('configuracoes'), false);
});

test('claim desconhecida mantém compatibilidade administrativa', () => {
  assert.equal(normalizeUserRole('gestor'), 'gestor');
  assert.equal(normalizeUserRole('perfil-antigo'), 'admin');
});

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

test('perfis preservam restrições e não expõem módulos removidos', () => {
  assert.equal(ROLE_ACCESS.gestor.includes('configuracoes'), false);
  assert.deepEqual([...ROLE_ACCESS.leitura], ['dashboard', 'consulta-geral', 'reports']);
  assert.equal(ROLE_ACCESS.gestor.includes('pendencias'), false);
  assert.equal(ROLE_ACCESS.gestor.includes('auditoria'), false);
  assert.equal(ROLE_ACCESS.admin.includes('auditoria'), false);
  assert.equal(ROLE_ACCESS.admin.includes('inteligencia'), false);
  assert.equal(ROLE_ACCESS.admin.includes('controle-presenca'), false);
  assert.equal(ROLE_ACCESS.admin.includes('partes-diarias'), false);
  assert.equal(ROLE_ACCESS.gestor.includes('usuarios'), false);
  assert.equal(ROLE_ACCESS.admin.includes('usuarios'), true);
  assert.equal(ROLE_ACCESS.operador.includes('pendencias'), false);
  assert.equal(ROLE_ACCESS.operador.includes('lancamentos'), true);
  assert.equal(ROLE_ACCESS.operador.includes('configuracoes'), false);
  assert.equal(ROLE_ACCESS.operador.includes('partes-diarias'), false);
});

test('claim desconhecida aplica privilégio mínimo', () => {
  assert.equal(normalizeUserRole('gestor'), 'gestor');
  assert.equal(normalizeUserRole('administrador'), 'admin');
  assert.equal(normalizeUserRole('perfil-antigo'), 'leitura');
  assert.equal(normalizeUserRole(undefined), 'leitura');
});

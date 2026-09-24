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
  // Leitura tem acesso apenas a dashboard e relatorios (módulos primários)
  assert.deepEqual([...ROLE_ACCESS.leitura], ['dashboard', 'relatorios']);

  // Administração é exclusiva do admin
  assert.equal(ROLE_ACCESS.admin.includes('administracao'), true);
  assert.equal(ROLE_ACCESS.gestor.includes('administracao'), false);
  assert.equal(ROLE_ACCESS.operador.includes('administracao'), false);
  assert.equal(ROLE_ACCESS.leitura.includes('administracao'), false);

  // Cadastros mestres: admin e gestor alteram a base, operador e leitura não
  assert.equal(ROLE_ACCESS.admin.includes('cadastros'), true);
  assert.equal(ROLE_ACCESS.gestor.includes('cadastros'), true);
  assert.equal(ROLE_ACCESS.operador.includes('cadastros'), false);
  assert.equal(ROLE_ACCESS.leitura.includes('cadastros'), false);

  // Módulos não-primários não aparecem em ROLE_ACCESS nem em ALL_NAVIGATION_ITEMS
  assert.equal(ROLE_ACCESS.admin.includes('configuracoes'), false);
  assert.equal(ROLE_ACCESS.admin.includes('usuarios'), false);
  assert.equal(ROLE_ACCESS.admin.includes('reports'), false);
  assert.equal(ROLE_ACCESS.admin.includes('inteligencia'), false);
  assert.equal(ROLE_ACCESS.admin.includes('controle-presenca'), false);
  assert.equal(ROLE_ACCESS.admin.includes('partes-diarias'), false);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'usuarios'), false);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'configuracoes'), false);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'reports'), false);

  // Central Operacional é tela de campo: operação usa, leitura não
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'central-operacional'), true);
  assert.equal(ROLE_ACCESS.operador.includes('central-operacional'), true);
  assert.equal(ROLE_ACCESS.leitura.includes('central-operacional'), false);

  // Módulos primários estão em ALL_NAVIGATION_ITEMS
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'colaboradores'), true);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'lancamentos'), true);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'controle-equipamentos'), true);
  assert.equal(ROLE_ACCESS.operador.includes('colaboradores'), true);
  assert.equal(ROLE_ACCESS.operador.includes('lancamentos'), true);
});

test('claim desconhecida aplica privilégio mínimo', () => {
  assert.equal(normalizeUserRole('gestor'), 'gestor');
  assert.equal(normalizeUserRole('administrador'), 'admin');
  assert.equal(normalizeUserRole('perfil-antigo'), 'leitura');
  assert.equal(normalizeUserRole(undefined), 'leitura');
});

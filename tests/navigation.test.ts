import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_NAVIGATION_ITEMS,
  ROLE_ACCESS,
  normalizeUserRole,
} from '../src/app/navigation/navigation';

test('perfil administrador mantém acesso a todos os módulos atuais', () => {
  // Task 8: presenca-publica é uma rota especial, não está em ALL_NAVIGATION_ITEMS
  const abasDePrincipio = ALL_NAVIGATION_ITEMS.map(item => item.id);
  const todasAsAbas = new Set([...abasDePrincipio, 'presenca-publica']);
  assert.deepEqual(
    new Set(ROLE_ACCESS.admin),
    todasAsAbas,
  );
});

test('perfis preservam restrições e não expõem módulos removidos', () => {
  // Leitura vê só o Painel e a presença pública (Relatórios saiu em 2026-11-10).
  assert.deepEqual([...ROLE_ACCESS.leitura], ['dashboard', 'presenca-publica']);

  // Administração saiu em 2026-11-10: nenhum perfil abre essa aba.
  for (const perfil of ['admin', 'gestor', 'operador', 'leitura'] as const) assert.equal(ROLE_ACCESS[perfil].includes('administracao'), false);

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

  // Central Operacional saiu do app a pedido do usuário em 2026-09-28
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'central-operacional'), false);
  assert.equal(ROLE_ACCESS.admin.includes('central-operacional'), false);

  // Módulos primários estão em ALL_NAVIGATION_ITEMS
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'colaboradores'), true);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'lancamentos'), true);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'controle-equipamentos'), true);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'meu-dia'), false);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'diario-obra'), false);
  assert.equal(ALL_NAVIGATION_ITEMS.some(item => item.id === 'pluviometro'), true);
  assert.equal(ROLE_ACCESS.admin.includes('pluviometro'), true);
  assert.equal(ROLE_ACCESS.gestor.includes('pluviometro'), true);
  assert.equal(ROLE_ACCESS.operador.includes('pluviometro'), true);
  assert.equal(ROLE_ACCESS.operador.includes('colaboradores'), true);
  assert.equal(ROLE_ACCESS.operador.includes('lancamentos'), true);
});

test('claim desconhecida aplica privilégio mínimo', () => {
  assert.equal(normalizeUserRole('gestor'), 'gestor');
  assert.equal(normalizeUserRole('administrador'), 'admin');
  assert.equal(normalizeUserRole('perfil-antigo'), 'leitura');
  assert.equal(normalizeUserRole(undefined), 'leitura');
});

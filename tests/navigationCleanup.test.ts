import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLE_ACCESS, PRIMARY_MODULE_IDS, ALL_NAVIGATION_ITEMS, MODULE_REDIRECTS } from '../src/app/navigation/navigation';

test('ROLE_ACCESS cleanup', async (suite) => {
  await suite.test('admin should have access only to primary modules', () => {
    const adminModules = new Set(ROLE_ACCESS.admin as any);
    const primaryModules = new Set(PRIMARY_MODULE_IDS);
    // Task 8: presenca-publica é uma rota especial, não está em PRIMARY_MODULE_IDS
    const especiais = new Set(['presenca-publica']);

    adminModules.forEach((moduleId: any) => {
      const ehPrimario = primaryModules.has(moduleId);
      const ehEspecial = especiais.has(moduleId);
      assert.strictEqual(ehPrimario || ehEspecial, true, `${moduleId} not in PRIMARY_MODULE_IDS or special routes`);
    });
  });

  await suite.test('gestor should have access only to primary modules except administracao', () => {
    const gestorModules = new Set(ROLE_ACCESS.gestor as any);
    const primaryModules = new Set(PRIMARY_MODULE_IDS);
    // Task 8: presenca-publica é uma rota especial, não está em PRIMARY_MODULE_IDS
    const especiais = new Set(['presenca-publica']);

    gestorModules.forEach((moduleId: any) => {
      const ehPrimario = primaryModules.has(moduleId);
      const ehEspecial = especiais.has(moduleId);
      assert.strictEqual(ehPrimario || ehEspecial, true, `${moduleId} not in PRIMARY_MODULE_IDS or special routes`);
      assert.notStrictEqual(moduleId, 'administracao', 'Administração saiu do menu em 2026-11-10');
    });
  });

  await suite.test('operador should have access to subset of primary modules', () => {
    const operadorModules = new Set(ROLE_ACCESS.operador as any);
    const primaryModules = new Set(PRIMARY_MODULE_IDS);
    // Task 8: presenca-publica é uma rota especial, não está em PRIMARY_MODULE_IDS
    const especiais = new Set(['presenca-publica']);

    operadorModules.forEach((moduleId: any) => {
      const ehPrimario = primaryModules.has(moduleId);
      const ehEspecial = especiais.has(moduleId);
      assert.strictEqual(ehPrimario || ehEspecial, true, `${moduleId} not in PRIMARY_MODULE_IDS or special routes`);
    });
  });

  await suite.test('leitura should have access to dashboard, relatorios and presenca-publica', () => {
    assert.deepStrictEqual(ROLE_ACCESS.leitura, ['dashboard', 'presenca-publica']);
  });
});

test('ALL_NAVIGATION_ITEMS cleanup', async (suite) => {
  await suite.test('should contain exactly 11 items from PRIMARY_MODULE_IDS', () => {
    assert.strictEqual(ALL_NAVIGATION_ITEMS.length, 11, `Expected 11 items, got ${ALL_NAVIGATION_ITEMS.length}`);
  });

  await suite.test('should contain only primary module IDs', () => {
    const primarySet = new Set(PRIMARY_MODULE_IDS);
    const allItemIds = new Set(ALL_NAVIGATION_ITEMS.map(item => item.id));

    allItemIds.forEach((id: string) => {
      assert.strictEqual(primarySet.has(id as any), true, `${id} not in PRIMARY_MODULE_IDS`);
    });
  });

  await suite.test('should not contain any auxiliary modules', () => {
    const auxiliaryModules = ['consulta-geral', 'periodo', 'pendencias', 'notificacoes', 'assistente', 'frentes', 'producao', 'cronograma', 'fvs'];
    const allItemIds = new Set(ALL_NAVIGATION_ITEMS.map(item => item.id));

    auxiliaryModules.forEach(moduleId => {
      assert.strictEqual(allItemIds.has(moduleId), false, `${moduleId} should not be in ALL_NAVIGATION_ITEMS`);
    });
  });
});

test('endereços antigos abrem a tela onde o dado mora hoje', async (suite) => {
  await suite.test('todo redirecionamento leva a uma tela do menu', () => {
    const primarySet = new Set<string>(PRIMARY_MODULE_IDS);

    Object.values(MODULE_REDIRECTS).forEach(destination => {
      assert.strictEqual(primarySet.has(destination), true, `${destination} not in PRIMARY_MODULE_IDS`);
    });
  });

  await suite.test('telas cortadas que tinham dado levam ao lugar novo', () => {
    assert.strictEqual(MODULE_REDIRECTS['tickets-jazida'], 'materiais');
    assert.strictEqual(MODULE_REDIRECTS.frota, 'controle-equipamentos');
    assert.strictEqual(MODULE_REDIRECTS.equipes, 'presenca');
    assert.strictEqual(MODULE_REDIRECTS.auditoria, 'cadastros');
    assert.strictEqual(MODULE_REDIRECTS.permissoes, 'cadastros');
    // Abas tiradas em 2026-11-10 a pedido do usuário.
    assert.strictEqual(MODULE_REDIRECTS.administracao, 'cadastros');
    assert.strictEqual(MODULE_REDIRECTS.relatorios, 'dashboard');
    assert.strictEqual(MODULE_REDIRECTS.planejamento, 'meu-dia');
  });
});

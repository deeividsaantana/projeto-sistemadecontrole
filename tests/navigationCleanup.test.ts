import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLE_ACCESS, PRIMARY_MODULE_IDS, ALL_NAVIGATION_ITEMS, AUXILIARY_MODULE_DESTINATIONS } from '../src/app/navigation/navigation';

test('ROLE_ACCESS cleanup', async (suite) => {
  await suite.test('admin should have access only to primary modules', () => {
    const adminModules = new Set(ROLE_ACCESS.admin as any);
    const primaryModules = new Set(PRIMARY_MODULE_IDS);

    adminModules.forEach((moduleId: any) => {
      assert.strictEqual(primaryModules.has(moduleId), true, `${moduleId} not in PRIMARY_MODULE_IDS`);
    });
  });

  await suite.test('gestor should have access only to primary modules except administracao', () => {
    const gestorModules = new Set(ROLE_ACCESS.gestor as any);
    const primaryModules = new Set(PRIMARY_MODULE_IDS);

    gestorModules.forEach((moduleId: any) => {
      assert.strictEqual(primaryModules.has(moduleId), true, `${moduleId} not in PRIMARY_MODULE_IDS`);
      assert.notStrictEqual(moduleId, 'administracao', `gestor should not access administracao`);
    });
  });

  await suite.test('operador should have access to subset of primary modules', () => {
    const operadorModules = new Set(ROLE_ACCESS.operador as any);
    const primaryModules = new Set(PRIMARY_MODULE_IDS);

    operadorModules.forEach((moduleId: any) => {
      assert.strictEqual(primaryModules.has(moduleId), true, `${moduleId} not in PRIMARY_MODULE_IDS`);
    });
  });

  await suite.test('leitura should have access only to dashboard and relatorios', () => {
    assert.deepStrictEqual(ROLE_ACCESS.leitura, ['dashboard', 'relatorios']);
  });
});

test('ALL_NAVIGATION_ITEMS cleanup', async (suite) => {
  await suite.test('should contain exactly 15 items from PRIMARY_MODULE_IDS', () => {
    assert.strictEqual(ALL_NAVIGATION_ITEMS.length, 15, `Expected 15 items, got ${ALL_NAVIGATION_ITEMS.length}`);
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

test('Auxiliary module redirection', async (suite) => {
  await suite.test('should map all auxiliary modules to primary modules', () => {
    const primarySet = new Set(PRIMARY_MODULE_IDS);

    Object.values(AUXILIARY_MODULE_DESTINATIONS).forEach((destination: any) => {
      assert.strictEqual(primarySet.has(destination), true, `${destination} not in PRIMARY_MODULE_IDS`);
    });
  });

  await suite.test('periodo should redirect to relatorios', () => {
    assert.strictEqual(AUXILIARY_MODULE_DESTINATIONS['periodo'], 'relatorios');
  });

  await suite.test('consulta-geral should redirect to dashboard', () => {
    assert.strictEqual(AUXILIARY_MODULE_DESTINATIONS['consulta-geral'], 'dashboard');
  });

  await suite.test('frentes should redirect to central-operacional', () => {
    assert.strictEqual(AUXILIARY_MODULE_DESTINATIONS['frentes'], 'central-operacional');
  });
});

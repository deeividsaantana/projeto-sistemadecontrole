import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRIMARY_MODULE_IDS,
  SIDEBAR_NAVIGATION_GROUPS,
  isPrimaryModule,
} from '../src/app/navigation/navigation';

test('sidebar expõe os 9 módulos primários do ERP', () => {
  const rendered = SIDEBAR_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.id));
  assert.deepEqual(rendered, [...PRIMARY_MODULE_IDS]);
  assert.equal(rendered.length, 9);
  assert.equal(isPrimaryModule('manutencao'), true);
  assert.equal(isPrimaryModule('tickets-jazida'), false);
  assert.equal(isPrimaryModule('frota'), false);
});

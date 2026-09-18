import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_NAVIGATION_ITEMS,
  AUXILIARY_MODULE_DESTINATIONS,
  isPrimaryModule,
} from '../src/app/navigation/navigation';

test('todo módulo auxiliar tem destino primário', () => {
  const auxiliary = ALL_NAVIGATION_ITEMS.map(item => item.id).filter(id => !isPrimaryModule(id));
  assert.deepEqual(auxiliary.filter(id => !AUXILIARY_MODULE_DESTINATIONS[id]), []);
  assert.equal(AUXILIARY_MODULE_DESTINATIONS['tickets-jazida'], 'central-operacional');
  assert.equal(AUXILIARY_MODULE_DESTINATIONS.custos, 'relatorios');
  assert.equal(AUXILIARY_MODULE_DESTINATIONS.permissoes, 'administracao');
});

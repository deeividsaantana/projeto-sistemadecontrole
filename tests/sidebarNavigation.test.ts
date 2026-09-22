import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRIMARY_MODULE_IDS,
  SIDEBAR_NAVIGATION_GROUPS,
  isPrimaryModule,
} from '../src/app/navigation/navigation';

test('sidebar expõe os 15 módulos primários do ERP', () => {
  const rendered = SIDEBAR_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.id));
  assert.deepEqual(rendered, [...PRIMARY_MODULE_IDS]);
  assert.equal(rendered.length, 15);
  assert.equal(isPrimaryModule('manutencao'), true);
  // Tickets Jazida e Controle de Estacas voltaram à navegação principal em
  // 2026-09-22: eram tecnicamente inalcançáveis (nenhum link renderizado
  // dava acesso a essas telas) e é lá que vivem as novas importações com
  // prévia/lote/lineage.
  assert.equal(isPrimaryModule('tickets-jazida'), true);
  assert.equal(isPrimaryModule('estacas'), true);
  assert.equal(isPrimaryModule('frota'), false);
  assert.equal(isPrimaryModule('modo-campo'), true);
  assert.equal(isPrimaryModule('planejamento'), true);
  assert.equal(isPrimaryModule('diario-obra'), true);
  assert.equal(isPrimaryModule('lancamentos'), true);
});

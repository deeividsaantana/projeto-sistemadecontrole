import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRIMARY_MODULE_IDS,
  SIDEBAR_NAVIGATION_GROUPS,
  isPrimaryModule,
} from '../src/app/navigation/navigation';

test('sidebar expõe os 14 módulos primários do ERP', () => {
  const rendered = SIDEBAR_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.id));
  assert.deepEqual(rendered, [...PRIMARY_MODULE_IDS]);
  assert.equal(rendered.length, 14);
  assert.equal(isPrimaryModule('manutencao'), true);
  assert.equal(isPrimaryModule('central-operacional'), false);
  // Controle de Estacas voltou à navegação principal em 2026-09-22. Os
  // tickets da jazida saíram do menu em 2026-09-28: são a parte Viagens da
  // jazida dentro de Materiais.
  assert.equal(isPrimaryModule('tickets-jazida'), false);
  assert.equal(isPrimaryModule('estacas'), true);
  assert.equal(isPrimaryModule('frota'), false);
  // Modo Campo saiu em 2026-10-16: repetia o menu e os números do Painel.
  assert.equal(isPrimaryModule('modo-campo'), false);
  assert.equal(isPrimaryModule('planejamento'), true);
  assert.equal(isPrimaryModule('diario-obra'), true);
  assert.equal(isPrimaryModule('lancamentos'), true);
  // Cadastros voltou ao menu em 2026-09-24: o atalho em Administração
  // levava a uma aba sem permissão em nenhum perfil.
  assert.equal(isPrimaryModule('cadastros'), true);
});

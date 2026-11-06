import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationSyncTrigger } from '../src/app/navigation/navigationSyncPolicy';

test('trocar de tela não dispara sincronização remota implicitamente', () => {
  assert.equal(navigationSyncTrigger({}), 'none');
});

test('atualização explícita continua podendo pedir sincronização', () => {
  assert.equal(navigationSyncTrigger({ explicitRefresh: true }), 'refresh');
});

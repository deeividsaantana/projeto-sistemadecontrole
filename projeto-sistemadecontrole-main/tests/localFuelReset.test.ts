import assert from 'node:assert/strict';
import test from 'node:test';
import { LOCAL_FUEL_RESET_VERSION, shouldResetLocalFuel } from '../src/utils/localFuelReset';

test('zeragem local acontece uma vez por versão', () => {
  // Primeira execução: sem versão armazenada
  assert.equal(shouldResetLocalFuel(undefined), true, 'deve resetar quando sem versão');

  // Execução com null
  assert.equal(shouldResetLocalFuel(null), true, 'deve resetar quando versão é null');

  // Execução com versão correta: não deve resetar de novo
  assert.equal(shouldResetLocalFuel(LOCAL_FUEL_RESET_VERSION), false, 'não deve resetar se versão está atualizada');

  // Execução com versão anterior: deve resetar
  assert.equal(shouldResetLocalFuel('2026-09-18'), true, 'deve resetar quando versão é antiga');
});

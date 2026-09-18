import assert from 'node:assert/strict';
import test from 'node:test';
import { LOCAL_FUEL_RESET_VERSION, shouldResetLocalFuel } from '../src/utils/localFuelReset';

test('zeragem local acontece uma vez por versão', () => {
  assert.equal(shouldResetLocalFuel(undefined), true);
  assert.equal(shouldResetLocalFuel(null), true);
  assert.equal(shouldResetLocalFuel(LOCAL_FUEL_RESET_VERSION), false);
});

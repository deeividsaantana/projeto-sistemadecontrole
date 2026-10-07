import assert from 'node:assert/strict';
import test from 'node:test';
import { OPERATIONAL_DRIVERS, OPERATIONAL_DRIVER_COUNT } from '../src/fleet/operationalDrivers';

test('mini lista operacional contém os 35 motoristas sem matrículas duplicadas', () => {
  assert.equal(OPERATIONAL_DRIVER_COUNT, 35);
  assert.equal(new Set(OPERATIONAL_DRIVERS.map(driver => driver.matricula)).size, 35);
  assert.ok(OPERATIONAL_DRIVERS.every(driver => driver.ativo && driver.status === 'ATIVO'));
});

test('mini lista preserva motoristas de basculante, pipa e carreta', () => {
  assert.equal(OPERATIONAL_DRIVERS.find(driver => driver.matricula === '101979')?.nome, 'WEDLEY PEREIRA DOS SANTOS');
  assert.equal(OPERATIONAL_DRIVERS.find(driver => driver.matricula === '101565')?.cargo, 'OPERADOR DE CAMINHÃO PIPA');
  assert.equal(OPERATIONAL_DRIVERS.find(driver => driver.matricula === '102507')?.cargo, 'OPERADOR DE CARRETA');
});

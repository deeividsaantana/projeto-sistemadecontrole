import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento } from '../src/types';
import { getOperationalFuelLiters, parseFuelAnalyticsNumber, splitOperationalFuelRecords } from '../src/utils/fuelAnalyticsSafety';

const record = (quantidadeLitros: unknown, status: Abastecimento['status'] = 'OK') => ({
  id: String(quantidadeLitros), quantidadeLitros, status,
}) as Abastecimento;

test('normaliza números de combustível sem concatenar texto', () => {
  assert.equal(parseFuelAnalyticsNumber(120), 120);
  assert.equal(parseFuelAnalyticsNumber('120'), 120);
  assert.equal(parseFuelAnalyticsNumber('120,5'), 120.5);
  assert.equal(parseFuelAnalyticsNumber('1.500'), 1500);
  assert.equal(parseFuelAnalyticsNumber('1.500,00'), 1500);
});

test('preserva registros absurdos para revisão, mas os exclui dos indicadores', () => {
  const valid = record('492');
  const polluted = record('25.826.481.837.205');
  const cancelled = record(185, 'Cancelado');
  assert.equal(getOperationalFuelLiters(valid), 492);
  assert.equal(getOperationalFuelLiters(polluted), null);
  assert.equal(getOperationalFuelLiters(cancelled), null);
  const split = splitOperationalFuelRecords([valid, polluted, cancelled]);
  assert.deepEqual(split.operational.map(item => item.id), ['492']);
  assert.equal(split.review.length, 2);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIsoDate, normalizeOperationalTime } from '../src/fleet/time';

// O ExcelJS entrega a célula "16/10/2026 00:00" como 2026-10-16T00:00:00Z.
test('C7: data da planilha de frota fica no mesmo dia', () => {
  assert.equal(normalizeIsoDate(new Date(Date.UTC(2026, 9, 16, 0, 0))), '2026-10-16');
});

test('C7: hora da planilha de frota não volta 3 horas', () => {
  // Célula "07:30" lida pelo ExcelJS: 1899-12-30T07:30:00Z.
  assert.equal(normalizeOperationalTime(new Date(Date.UTC(1899, 11, 30, 7, 30))), '07:30');
  assert.equal(normalizeOperationalTime(new Date(Date.UTC(2026, 9, 16, 1, 15))), '01:15');
});

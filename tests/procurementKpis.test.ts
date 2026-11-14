import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProcurementKpis } from '../src/modules/procurement/kpis';

test('calcula OTIF, atraso e lead time dos pedidos concluídos', () => {
  const result = calculateProcurementKpis([
    { openedAt: '2026-11-01T08:00:00Z', quotedAt: '2026-11-01T12:00:00Z', promisedEnd: '2026-11-05', receivedAt: '2026-11-05T10:00:00Z', ordered: 10, received: 10 },
    { openedAt: '2026-11-01T08:00:00Z', quotedAt: '2026-11-03T08:00:00Z', promisedEnd: '2026-11-05', receivedAt: '2026-11-06T10:00:00Z', ordered: 10, received: 8 },
  ], '2026-11-07');
  assert.equal(result.total, 2);
  assert.equal(result.otifPercent, 50);
  assert.equal(result.latePercent, 50);
  assert.equal(result.averageLeadTimeHours, 110);
  assert.equal(result.averageQuotationSlaHours, 26);
});

test('não inventa KPI quando não há registros válidos', () => {
  assert.deepEqual(calculateProcurementKpis([], '2026-11-07'), {
    total: 0, otifPercent: 0, latePercent: 0, averageLeadTimeHours: 0, averageQuotationSlaHours: 0,
  });
});

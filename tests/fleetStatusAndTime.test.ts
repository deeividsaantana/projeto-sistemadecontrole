import assert from 'node:assert/strict';
import {
  FLEET_OPERATIONAL_STATUS,
  type FleetEvent,
} from '../src/fleet/domain';
import {
  deriveCurrentStatusFromEvents,
  getFleetStatusDefinition,
  normalizeOperationalStatus,
  statusCountsAsStopped,
  statusIsOperationallyAvailable,
} from '../src/fleet/status';
import {
  calculateDurationMinutes,
  calculateStoppedMinutes,
  formatBrazilianDate,
  formatDurationMinutes,
  isChronological,
  isValidIsoDate,
  normalizeIsoDate,
  normalizeOperationalTime,
  parseOperationalTime,
} from '../src/fleet/time';

assert.equal(normalizeOperationalStatus('EM OPERAÇÃO'), FLEET_OPERATIONAL_STATUS.operating);
assert.equal(normalizeOperationalStatus('rodando'), FLEET_OPERATIONAL_STATUS.operating);
assert.equal(normalizeOperationalStatus('Em Manutenção'), FLEET_OPERATIONAL_STATUS.maintenance);
assert.equal(normalizeOperationalStatus('A disposição'), FLEET_OPERATIONAL_STATUS.available);
assert.equal(normalizeOperationalStatus('Disponível'), FLEET_OPERATIONAL_STATUS.available);
assert.equal(normalizeOperationalStatus('Esperando motorista'), FLEET_OPERATIONAL_STATUS.waitingDriver);
assert.equal(normalizeOperationalStatus('aguardando oficina'), FLEET_OPERATIONAL_STATUS.waitingMaintenance);
assert.equal(normalizeOperationalStatus('status desconhecido'), FLEET_OPERATIONAL_STATUS.unclassified);

assert.equal(statusCountsAsStopped(FLEET_OPERATIONAL_STATUS.maintenance), true);
assert.equal(statusCountsAsStopped(FLEET_OPERATIONAL_STATUS.operating), false);
assert.equal(statusIsOperationallyAvailable(FLEET_OPERATIONAL_STATUS.waitingDriver), true);
assert.equal(statusIsOperationallyAvailable(FLEET_OPERATIONAL_STATUS.unavailable), false);
assert.equal(getFleetStatusDefinition(FLEET_OPERATIONAL_STATUS.available).shortLabel, 'À disposição');

const sequence: FleetEvent[] = [
  {
    id: 'evt-1',
    equipmentId: 'cb770',
    occurredAt: '2026-08-12T07:59:00-03:00',
    kind: 'OPERATION_STARTED',
    nextStatus: FLEET_OPERATIONAL_STATUS.operating,
    source: 'USER',
  },
  {
    id: 'evt-2',
    equipmentId: 'cb770',
    occurredAt: '2026-08-12T08:00:00-03:00',
    kind: 'MAINTENANCE_ENTERED',
    previousStatus: FLEET_OPERATIONAL_STATUS.operating,
    nextStatus: FLEET_OPERATIONAL_STATUS.maintenance,
    source: 'USER',
  },
  {
    id: 'evt-3',
    equipmentId: 'cb770',
    occurredAt: '2026-08-12T08:54:00-03:00',
    kind: 'MAINTENANCE_RELEASED',
    previousStatus: FLEET_OPERATIONAL_STATUS.maintenance,
    nextStatus: FLEET_OPERATIONAL_STATUS.available,
    source: 'USER',
  },
  {
    id: 'evt-4',
    equipmentId: 'cb770',
    occurredAt: '2026-08-12T08:55:00-03:00',
    kind: 'RETURNED_TO_OPERATION',
    previousStatus: FLEET_OPERATIONAL_STATUS.available,
    nextStatus: FLEET_OPERATIONAL_STATUS.operating,
    source: 'USER',
  },
];

assert.equal(
  deriveCurrentStatusFromEvents(sequence, FLEET_OPERATIONAL_STATUS.unclassified),
  FLEET_OPERATIONAL_STATUS.operating,
);
assert.equal(isChronological(sequence.map(event => event.occurredAt)), true);
assert.equal(isChronological([...sequence].reverse().map(event => event.occurredAt)), false);

assert.deepEqual(parseOperationalTime('7:59'), {
  raw: '07:59',
  hours: 7,
  minutes: 59,
  totalMinutes: 479,
  valid: true,
});
assert.equal(normalizeOperationalTime('08:54:00'), '08:54');
assert.equal(normalizeOperationalTime('25:00'), '');
assert.equal(normalizeOperationalTime(0.5), '12:00');
assert.equal(calculateDurationMinutes('2026-08-12', '08:00', '08:54'), 54);
assert.equal(calculateStoppedMinutes('2026-08-12', '08:00', '13:54'), 354);
assert.equal(formatDurationMinutes(354), '05:54');
assert.equal(formatDurationMinutes(undefined), '—');
assert.equal(formatDurationMinutes(0), '00:00');

assert.equal(isValidIsoDate('2026-08-12'), true);
assert.equal(isValidIsoDate('2026-02-30'), false);
assert.equal(normalizeIsoDate('12/08/2026'), '2026-08-12');
assert.equal(normalizeIsoDate('31/02/2026'), '');
assert.equal(formatBrazilianDate('2026-08-12'), '12/08/2026');

import assert from 'node:assert/strict';
import { normalizeEmployeeCode, normalizePlate, normalizePrefix, operationalRowKey } from '../src/utils/canonicalIdentity';

assert.equal(normalizePrefix('CB 729'), 'CB729');
assert.equal(normalizePrefix('cb-729'), 'CB729');
assert.equal(normalizePlate('ABC-1D23'), 'ABC1D23');
assert.equal(normalizeEmployeeCode(' 001548 '), '001548');
assert.equal(
  operationalRowKey({ date: '2026-08-13', prefix: 'CB 729', employeeCode: '1548', time: '07:00', type: 'operação' }),
  operationalRowKey({ date: '2026-08-13', prefix: 'cb-729', employeeCode: '1548', time: '07:00', type: 'operacao' }),
);

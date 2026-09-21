// tests/importNormalizers.test.ts
import assert from 'node:assert/strict';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportInvoiceOrNull,
  normalizeImportPlateOrNull,
  normalizeImportPrefixOrNull,
  normalizeImportTextOrNull,
  normalizeImportTimeOrNull,
  normalizeImportUnitOrNull,
} from '../src/imports/normalizers';

assert.equal(normalizeImportDateOrNull('05/01/2026'), '2026-01-05');
assert.equal(normalizeImportDateOrNull(''), null, 'data ausente não vira data inventada');
assert.equal(normalizeImportDateOrNull('lixo'), null);

assert.equal(normalizeImportTimeOrNull('07:59'), '07:59');
assert.equal(normalizeImportTimeOrNull(0.5), '12:00', 'serial Excel 0.5 = meio-dia');
assert.equal(normalizeImportTimeOrNull(''), null, 'horário ausente não vira 00:00');

assert.equal(normalizeImportDecimalOrNull('12,5'), 12.5);
assert.equal(normalizeImportDecimalOrNull('0'), 0, 'zero informado de verdade continua zero');
assert.equal(normalizeImportDecimalOrNull(''), null, 'quantidade ausente não vira zero');
assert.equal(normalizeImportDecimalOrNull(null), null);

assert.equal(normalizeImportUnitOrNull('m³'), 'M3');
assert.equal(normalizeImportUnitOrNull('Ton'), 'TON');
assert.equal(normalizeImportUnitOrNull('un'), 'UN');
assert.equal(normalizeImportUnitOrNull(''), null);

assert.equal(normalizeImportInvoiceOrNull(' 12.345-6 '), '123456');
assert.equal(normalizeImportInvoiceOrNull(''), null);

assert.equal(normalizeImportPlateOrNull('abc-1d23'), 'ABC1D23');
assert.equal(normalizeImportPlateOrNull(''), null);

assert.equal(normalizeImportPrefixOrNull('cb-770'), 'CB770');
assert.equal(normalizeImportPrefixOrNull(''), null);

assert.equal(normalizeImportTextOrNull('  Solo Reforçado  '), 'Solo Reforçado');
assert.equal(normalizeImportTextOrNull(''), null);

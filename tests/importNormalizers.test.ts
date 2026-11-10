// tests/importNormalizers.test.ts
import assert from 'node:assert/strict';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportTextOrNull,
  normalizeImportTimeOrNull,
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
assert.equal(normalizeImportDecimalOrNull('N/A'), null, 'texto sem dígito não pode virar zero fabricado');
assert.equal(normalizeImportDecimalOrNull('-'), null, 'traço sozinho não pode virar zero fabricado');
assert.equal(normalizeImportDecimalOrNull('abc'), null);

assert.equal(normalizeImportTextOrNull('  Solo Reforçado  '), 'Solo Reforçado');
assert.equal(normalizeImportTextOrNull(''), null);

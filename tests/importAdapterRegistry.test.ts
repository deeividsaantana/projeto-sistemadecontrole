import assert from 'node:assert/strict';
import { classifySheet, findAdapterForSheet } from '../src/imports/adapters';

assert.equal(findAdapterForSheet('Cravações')?.domain, 'stakes');
// Materiais e viagens da jazida saíram do sistema em 2026-11-10: as abas delas não são mais lidas.
assert.equal(findAdapterForSheet('Tubos de concreto'), undefined);
assert.equal(findAdapterForSheet('LIBERAÇÃO'), undefined);
assert.equal(findAdapterForSheet('Resumo Geral'), undefined, 'abas consolidadas não podem virar registros de outro domínio');
assert.equal(findAdapterForSheet('Aba Nunca Vista'), undefined);

const recognized = classifySheet('Cravações', ['Data', 'Estaca'], 5);
assert.equal(recognized.recognized, true);
assert.equal(recognized.domain, 'stakes');
assert.equal(recognized.rowCount, 5);

const deferred = classifySheet('Aba Nunca Vista', ['X', 'Y'], 3);
assert.equal(deferred.recognized, false);
assert.equal(deferred.rowCount, 3);
assert.ok(deferred.reason);
assert.equal(deferred.columnMapping, undefined);

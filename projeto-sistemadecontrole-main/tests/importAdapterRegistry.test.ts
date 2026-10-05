import assert from 'node:assert/strict';
import { classifySheet, findAdapterForSheet } from '../src/imports/adapters';

assert.ok(findAdapterForSheet('Tubos de concreto'));
assert.equal(findAdapterForSheet('Tubos de concreto')?.domain, 'materials-receipts');
assert.equal(findAdapterForSheet('Rachão')?.domain, 'materials-movements');
assert.equal(findAdapterForSheet('Cravações')?.domain, 'stakes');
assert.equal(findAdapterForSheet('LIBERAÇÃO')?.domain, 'travels');
assert.equal(findAdapterForSheet('Tubos PEAD - PVC')?.domain, 'materials-receipts');
assert.equal(findAdapterForSheet('Ferramentas e Materiais de Apoi')?.domain, 'materials-receipts');
assert.equal(findAdapterForSheet('Resumo Geral'), undefined, 'abas consolidadas não podem virar registros de outro domínio');
assert.equal(findAdapterForSheet('Aba Nunca Vista'), undefined);

const recognized = classifySheet('Tubos de concreto', ['Data', 'NF'], 5);
assert.equal(recognized.recognized, true);
assert.equal(recognized.domain, 'materials-receipts');
assert.equal(recognized.rowCount, 5);
assert.ok(recognized.columnMapping?.some(mapping => mapping.column === 'NF' && mapping.mappedTo === 'notaFiscal'));

const deferred = classifySheet('Aba Nunca Vista', ['X', 'Y'], 3);
assert.equal(deferred.recognized, false);
assert.equal(deferred.rowCount, 3);
assert.ok(deferred.reason);
assert.equal(deferred.columnMapping, undefined);

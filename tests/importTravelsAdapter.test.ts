// tests/importTravelsAdapter.test.ts
import assert from 'node:assert/strict';
import { travelsAdapter } from '../src/imports/adapters/travelsAdapter';
import type { ImportParseContext } from '../src/imports/types';

assert.equal(travelsAdapter.domain, 'travels');
assert.equal(travelsAdapter.supports('LIBERAÇÃO'), true);
assert.equal(travelsAdapter.supports('recebimento'), true);
assert.equal(travelsAdapter.supports('Cadastro'), true);
assert.equal(travelsAdapter.supports('Conferência'), true);
assert.equal(travelsAdapter.supports('Resumo'), true);
assert.equal(travelsAdapter.supports('Aba fora do padrão'), false);

const context: ImportParseContext = {
  sourceFile: 'VIAGENS JAZIDA SABESP.xlsx',
  sourceHash: 'hash-trv',
  sourceSheet: 'LIBERAÇÃO',
  importBatchId: 'imp-viagens-hashtrv',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Ticket: '000123', Prefixo: 'CB-770', Material: 'Solo', Quantidade: 12, Destino: 'Marginal', Horário: '08:15' },
    { Ticket: '', Prefixo: '', Material: '', Quantidade: '', Destino: '', Horário: '' },
    // Repete o mesmo ticket na mesma via (LIBERAÇÃO) — mesma chave operacional da linha 1.
    { Ticket: '000123', Prefixo: 'CB-770', Material: 'Solo', Quantidade: 12, Destino: 'Marginal', Horário: '08:20' },
  ],
};

const parsed = travelsAdapter.parse(context);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].value.via, 'liberacao');
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);
assert.equal(parsed[2].operationalKey, parsed[0].operationalKey, 'mesmo ticket e via da linha 1');

const preview = travelsAdapter.reconcile(parsed, undefined);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
assert.equal(preview.counts['duplicate-in-file'], 1, 'segunda ocorrência do mesmo ticket/via no arquivo é duplicate-in-file, nunca descartada');

import assert from 'node:assert/strict';
import { receiptsAdapter } from '../src/imports/adapters/receiptsAdapter';
import type { ImportParseContext } from '../src/imports/types';
import type { MovimentoMaterial } from '../src/types';

assert.equal(receiptsAdapter.domain, 'materials-receipts');
assert.equal(receiptsAdapter.supports('Tubos de concreto'), true);
assert.equal(receiptsAdapter.supports('TUBOS PEAD/PVC'), true);
assert.equal(receiptsAdapter.supports('Resumo Geral'), false, 'aba de resumo agregado não vira linha operacional');
assert.equal(receiptsAdapter.supports('Aba Desconhecida'), false);

const mapping = receiptsAdapter.describeColumns(['Data', 'Material', 'NF', 'Coluna Estranha']);
assert.deepEqual(mapping.find(m => m.column === 'NF'), { column: 'NF', mappedTo: 'notaFiscal' });
assert.deepEqual(mapping.find(m => m.column === 'Coluna Estranha'), { column: 'Coluna Estranha', mappedTo: null });

const context: ImportParseContext = {
  sourceFile: 'CONTROLE DE RECEBIMENTO.xlsx',
  sourceHash: 'hash-abc',
  sourceSheet: 'Tubos de concreto',
  importBatchId: 'imp-controle-hashabc',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Material: 'Tubo concreto 400mm', NF: '12.345', 'Quantidade Recebida': 10, Unidade: 'UN' },
    { Data: '06/01/2026', Material: 'Tubo concreto 600mm', NF: '', 'Quantidade Recebida': 4, Unidade: 'UN' },
  ],
};

const parsed = receiptsAdapter.parse(context);
assert.equal(parsed.length, 2);
assert.equal(parsed[0].lineage.sourceRow, 2);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review', 'sem NF a linha fica em conferência, nunca invalidada');
assert.equal(parsed[1].operationalKey, undefined);
assert.match(parsed[1].lineage.validationMessages.join(' '), /nota fiscal/i);

const current: MovimentoMaterial[] = [];
const firstPreview = receiptsAdapter.reconcile(parsed, current);
assert.equal(firstPreview.counts.new, 1);
assert.equal(firstPreview.counts.review, 1);
assert.equal(firstPreview.dryRun, true);

// Reimportar a mesma linha completa contra o estado já existente marca "unchanged", nunca duplica.
const existing: MovimentoMaterial = {
  id: 'mov-1', data: '2026-01-05', tipo: 'Entrada', materialId: 'mat-1',
  materialDescricao: 'Tubo concreto 400mm', quantidade: 10, unidade: 'UN',
  notaFiscal: '12345', responsavel: 'Sistema', criadoEm: '2026-01-05T00:00:00.000Z',
  atualizadoEm: '2026-01-05T00:00:00.000Z',
} as MovimentoMaterial;
const secondPreview = receiptsAdapter.reconcile(parsed, [existing]);
assert.equal(secondPreview.counts.unchanged, 1);
assert.equal(secondPreview.counts.new, 0);
assert.equal(secondPreview.counts.review, 1, 'a linha incompleta continua em conferência, nunca vira duplicata');

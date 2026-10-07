import assert from 'node:assert/strict';
import { buildImportBatchId, buildRowLineage, cleanRowForLineage, computeSourceHash } from '../src/imports/provenance';

const bytesA = new TextEncoder().encode('conteudo-do-arquivo-1');
const bytesB = new TextEncoder().encode('conteudo-do-arquivo-2');

const hashA1 = await computeSourceHash(bytesA);
const hashA2 = await computeSourceHash(bytesA);
const hashB = await computeSourceHash(bytesB);
assert.equal(hashA1, hashA2, 'o mesmo conteúdo deve gerar o mesmo hash');
assert.notEqual(hashA1, hashB, 'conteúdos diferentes devem gerar hashes diferentes');
assert.match(hashA1, /^[0-9a-f]{64}$/, 'sha-256 em hex deve ter 64 caracteres');

const batchId1 = buildImportBatchId('CONTROLE DE RECEBIMENTO.xlsx', hashA1);
const batchId2 = buildImportBatchId('CONTROLE DE RECEBIMENTO.xlsx', hashA1);
const batchId3 = buildImportBatchId('CONTROLE DE RECEBIMENTO.xlsx', hashB);
assert.equal(batchId1, batchId2, 'reimportar o mesmo arquivo deve gerar o mesmo lote');
assert.notEqual(batchId1, batchId3, 'conteúdo diferente deve gerar lote diferente');
assert.match(batchId1, /^imp-/);

const cleaned = cleanRowForLineage({ Data: new Date('2026-01-05T00:00:00.000Z'), Quantidade: 12.5, Vazio: '', Nulo: null });
assert.equal(cleaned.Vazio, null, 'campo vazio vira null, nunca string vazia tratada como valor');
assert.equal(cleaned.Nulo, null);
assert.equal(cleaned.Quantidade, '12.5');

const lineage = buildRowLineage({
  sourceFile: 'CONTROLE DE RECEBIMENTO.xlsx',
  sourceSheet: 'Tubos de concreto',
  sourceRow: 8,
  sourceHash: hashA1,
  importBatchId: batchId1,
  importedAt: '2026-09-21T12:00:00.000Z',
  validationStatus: 'review',
  validationMessages: ['Nota fiscal ausente.', 'Nota fiscal ausente.'],
  originalData: cleaned,
});
assert.equal(lineage.validationMessages.length, 1, 'mensagens duplicadas são deduplicadas');
assert.deepEqual(lineage.originalData, cleaned);
assert.throws(() => { (lineage.originalData as Record<string, unknown>).Quantidade = '0'; }, 'originalData deve ser congelado');

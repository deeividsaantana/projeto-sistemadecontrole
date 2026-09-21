import assert from 'node:assert/strict';
import { materialsAdapter } from '../src/imports/adapters/materialsAdapter';
import type { ImportParseContext } from '../src/imports/types';
import type { MovimentoMaterial } from '../src/types';

assert.equal(materialsAdapter.domain, 'materials-movements');
assert.equal(materialsAdapter.supports('Rachão'), true);
assert.equal(materialsAdapter.supports('Bota-fora Lara'), true);
assert.equal(materialsAdapter.supports('Q.E. São Bento'), true);
assert.equal(materialsAdapter.supports('resumo geral'), false, 'resumo agregado fica deferred');
assert.equal(materialsAdapter.supports('Aba qualquer'), false);

const context: ImportParseContext = {
  sourceFile: 'MATERIAIS COMPLEXO DO ALTO TIETÊ.xlsx',
  sourceHash: 'hash-xyz',
  sourceSheet: 'Rachão',
  importBatchId: 'imp-materiais-hashxyz',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Movimento: 'Entrada', Origem: 'Jazida', Destino: 'Frente 3', Quantidade: 40, Unidade: 'M3', Placa: 'ABC1D23' },
    { Data: '', Movimento: 'Saída', Destino: '', Quantidade: '', Unidade: '', Placa: '' },
    // Repete a chave operacional da linha 1 (mesma data, origem, destino, quantidade e placa).
    { Data: '05/01/2026', Movimento: 'Entrada', Origem: 'Jazida', Destino: 'Frente 3', Quantidade: 40, Unidade: 'M3', Placa: 'ABC1D23' },
  ],
};

const parsed = materialsAdapter.parse(context);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);
assert.equal(parsed[2].operationalKey, parsed[0].operationalKey, 'mesma chave operacional da linha 1');

const preview = materialsAdapter.reconcile(parsed, [] as MovimentoMaterial[]);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
assert.equal(preview.counts['duplicate-in-file'], 1, 'segunda ocorrência da mesma chave no arquivo é duplicate-in-file, nunca descartada');

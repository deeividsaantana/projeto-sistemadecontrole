import assert from 'node:assert/strict';
import { stakesAdapter } from '../src/imports/adapters/stakesAdapter';
import type { ImportParseContext } from '../src/imports/types';

assert.equal(stakesAdapter.domain, 'stakes');
assert.equal(stakesAdapter.supports('CADASTRO DE MATERIAIS'), true);
assert.equal(stakesAdapter.supports('Veículos e Implementos'), true);
assert.equal(stakesAdapter.supports('Lançamentos Logísticos'), true);
assert.equal(stakesAdapter.supports('Cravações'), true);
assert.equal(stakesAdapter.supports('Conferência'), true);
assert.equal(stakesAdapter.supports('Lista Auxiliar 1'), true);
assert.equal(stakesAdapter.supports('Resumo'), true);
assert.equal(stakesAdapter.supports('Aba sem relação nenhuma'), false, 'aba fora das categorias esperadas fica deferred');

const context: ImportParseContext = {
  sourceFile: 'CRAVAÇÕES DE ESTACAS PRANCHA.xlsx',
  sourceHash: 'hash-stk',
  sourceSheet: 'Cravações',
  importBatchId: 'imp-cravacoes-hashstk',
  importedAt: '2026-09-21T12:00:00.000Z',
  headerRow: 1,
  rows: [
    { Data: '05/01/2026', Item: 'Perfil PS-27', 'NF/Lote': 'LOTE-9' },
    { Data: '', Item: '', 'NF/Lote': '' },
    // Repete a chave operacional da linha 1 (mesmo NF/lote, item e data).
    { Data: '05/01/2026', Item: 'Perfil PS-27', 'NF/Lote': 'LOTE-9' },
  ],
};

const parsed = stakesAdapter.parse(context);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].lineage.validationStatus, 'ready');
assert.ok(parsed[0].operationalKey);
assert.equal(parsed[1].lineage.validationStatus, 'review');
assert.equal(parsed[1].operationalKey, undefined);
assert.equal(parsed[2].operationalKey, parsed[0].operationalKey, 'mesma chave operacional da linha 1');

const preview = stakesAdapter.reconcile(parsed, undefined);
assert.equal(preview.counts.new, 1);
assert.equal(preview.counts.review, 1);
assert.equal(preview.counts['duplicate-in-file'], 1, 'segunda ocorrência da mesma chave no arquivo é duplicate-in-file, nunca descartada');

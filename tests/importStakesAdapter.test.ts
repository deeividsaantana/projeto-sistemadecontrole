import assert from 'node:assert/strict';
import { stakesAdapter } from '../src/imports/adapters/stakesAdapter';
import type { ImportParseContext } from '../src/imports/types';
import type { ControleEstacas } from '../src/types';

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

// A23: reimportar a planilha da semana não dobra lotes nem cravações.
const lancamentos: ImportParseContext = {
  ...context,
  sourceSheet: 'Lançamentos',
  sourceHash: 'hash-semana-2',
  rows: [
    { Data: '20/07/2026', NF: 15788, 'Descrição': 'IMOB ESTACA P DUP AZ17-700 S430GP 10,0M', 'Comprimento (m)': 10 },
    { Data: '21/07/2026', NF: 15790, 'Descrição': 'IMOB ESTACA P DUP AZ17-700 S430GP 10,0M', 'Comprimento (m)': 10 },
  ],
};
const cravacoes: ImportParseContext = {
  ...context,
  sourceSheet: 'Cravações',
  sourceHash: 'hash-semana-2',
  rows: [
    { Data: '27/07/2026', Item: 1, 'Serviço': 'Cravação de estaca prancha', 'Identificação': 'AP 12 ferradura', Perfil: 'Estaca 3-B', 'Comprimento (m)': 10, 'Comprimento cravado': 9 },
    { Data: '28/07/2026', Item: 2, 'Serviço': 'Cravação de estaca prancha', 'Identificação': 'AP 12 ferradura', Perfil: 'Estaca 4-A', 'Comprimento (m)': 10, 'Comprimento cravado': 9 },
    { Data: '', Item: 3, 'Identificação': 'AP 12 ferradura', Perfil: 'Estaca 5-A', 'Comprimento (m)': 10 },
  ],
};
const lotesParsed = stakesAdapter.parse(lancamentos);
const cravacoesParsed = stakesAdapter.parse(cravacoes);
assert.ok(cravacoesParsed[0].operationalKey, 'cravação sem NF tem chave pela identificação, perfil e data');
assert.equal(cravacoesParsed[2].operationalKey, undefined, 'cravação sem data fica em conferência');
assert.match(cravacoesParsed[2].lineage.validationMessages.join(' '), /sem data/);

const semNada = stakesAdapter.reconcile([...lotesParsed, ...cravacoesParsed], { lotes: [], cravacoes: [] });
assert.equal(semNada.counts.new, 4, 'primeira importação traz os 2 lotes e as 2 cravações');
assert.equal(semNada.counts.review, 1);

const jaNoApp = {
  lotes: [{ notaFiscal: '15788', descricao: 'imob estaca p dup az17-700 s430gp 10,0m', data: '2026-07-20', inativoEm: '2026-08-01T10:00:00.000Z' }],
  cravacoes: [{ identificacao: 'AP 12 FERRADURA', perfil: 'Estaca 3-B', data: '2026-07-27' }],
} as unknown as ControleEstacas;
const reimportacao = stakesAdapter.reconcile([...lotesParsed, ...cravacoesParsed], jaNoApp);
assert.equal(reimportacao.counts.unchanged, 2, 'lote (mesmo inativado) e cravação que já estão no app não voltam');
assert.equal(reimportacao.counts.new, 2, 'só o lote e a cravação novos da semana entram');
const novos = reimportacao.rows.filter(item => item.disposition === 'new').map(item => item.row.lineage.sourceRow);
assert.deepEqual(novos, [3, 3]);

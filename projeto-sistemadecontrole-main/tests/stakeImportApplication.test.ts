import assert from 'node:assert/strict';
import { buildStakeImportApplication } from '../src/imports/stakeImportApplication';
import type { ImportPreview, ImportPreviewRow } from '../src/imports/types';
import type { ControleEstacas } from '../src/types';

const lineage = (sheet: string, row: number, status: 'ready' | 'review' = 'ready') => ({
  sourceFile: 'CRAVAÇÕES DE ESTACAS PRANCHA.xlsx', sourceSheet: sheet, sourceRow: row,
  sourceHash: 'hash-stk', importedAt: '2026-09-22T12:00:00.000Z', importBatchId: 'imp-stk',
  validationStatus: status, validationMessages: [], originalData: {},
});

// Data-hora real do Excel chega como Date JS no mesmo instante (não no epoch
// 1899) — cleanImportValue truncaria isso para só "AAAA-MM-DD", por isso o
// builder precisa ler de rawRow, nunca de lineage.originalData, para horário.
const rows: ImportPreviewRow<unknown>[] = [
  {
    disposition: 'new',
    row: {
      lineage: lineage('Lançamentos', 6),
      operationalKey: 'estaca-lote-1',
      value: {},
      rawRow: {
        Data: new Date('2026-07-20T00:00:00.000Z'),
        Hora: new Date('2026-07-20T14:07:00.000Z'),
        Movimento: 'Saída',
        NF: 15788,
        'Código Material': '93966',
        'Descrição': 'IMOB ESTACA P DUP AZ17-700 S430GP 10,0M',
        Tipo: 'ESTACA P DUP',
        'Comprimento (m)': 10,
        Unidade: 'TO',
        'Peso (kg)': 13158,
        'Valor Unitário (R$)': 8,
        'Valor Total (R$)': 105264,
        'Carreta / Placa': 'MSZ5536',
        Transportadora: 'ULIHORT HORTIGRANJEIROS LTDA',
        'Destino / Obra': 'SPMAR / Bloco 18 Alto Tietê',
        'Tipo de Carregamento': 'Feixe central',
        Status: 'Pendente',
      },
    },
  },
  {
    disposition: 'new',
    row: {
      lineage: lineage('Cravações', 2),
      operationalKey: 'estaca-cravacao-1',
      value: {},
      rawRow: { Data: new Date('2026-07-27T00:00:00.000Z'), Item: 1, 'Serviço': 'Cravação de estaca prancha', 'Identificação': 'AP 12 ferradura', Perfil: 'Estaca 3-B', 'Comprimento (m)': 10, 'Comprimento cravado (m)': 15 },
    },
  },
  {
    disposition: 'new',
    row: { lineage: lineage('Cadastro Materiais', 4), operationalKey: 'estaca-cadastro-1', value: {}, rawRow: { Código: '93966' } },
  },
  {
    disposition: 'review',
    row: { lineage: lineage('Lançamentos', 9, 'review'), value: {}, rawRow: {} },
  },
  {
    disposition: 'duplicate-in-file',
    row: { lineage: lineage('Lançamentos', 10), operationalKey: 'estaca-lote-1', value: {}, rawRow: {} },
  },
];

const preview: ImportPreview<unknown> = {
  batchId: 'imp-stk', sourceFile: 'CRAVAÇÕES DE ESTACAS PRANCHA.xlsx', sourceHash: 'hash-stk',
  generatedAt: '2026-09-22T12:00:00.000Z', dryRun: true, sheets: [],
  counts: { new: 3, 'potential-update': 0, unchanged: 0, 'duplicate-in-file': 1, review: 1, invalid: 0, deferred: 0 },
  rows,
};

const emptyControle: ControleEstacas = { lotes: [], cravacoes: [] };
const result = buildStakeImportApplication(preview, emptyControle, 'Responsável Teste');

assert.equal(result.lotes.length, 1);
assert.equal(result.cravacoes.length, 1);
assert.deepEqual(result.skipped, { duplicate: 1, review: 1, reference: 1, other: 0 });

const [lote] = result.lotes;
assert.equal(lote.data, '2026-07-20');
assert.equal(lote.hora, '14:07', 'hora precisa vir de rawRow, não da lineage truncada em dia');
assert.equal(lote.notaFiscal, '15788');
assert.equal(lote.perfilModelo, 'AZ17-700', 'perfil derivado por regex da descrição, igual EstacasTab');
assert.equal(lote.comprimentoM, 10);
assert.equal(lote.quantidadeFisica, 1);
assert.equal(lote.status, 'Pendente');
assert.match(lote.observacao, /CRAVAÇÕES.*Lançamentos.*linha 6.*imp-stk/i);

const [cravacao] = result.cravacoes;
assert.equal(cravacao.identificacao, 'AP 12 ferradura');
assert.equal(cravacao.comprimentoM, 10);
assert.equal(cravacao.comprimentoCravadoM, 15);
assert.equal(cravacao.sobraM, 0, 'cravado maior que o comprimento nunca gera sobra negativa');
assert.equal(cravacao.perdaM, 0);

const reapplied = buildStakeImportApplication(preview, { lotes: result.lotes, cravacoes: result.cravacoes }, 'Responsável Teste');
assert.equal(reapplied.lotes.length, 0, 'reaplicar o mesmo lote não duplica lotes');
assert.equal(reapplied.cravacoes.length, 0, 'reaplicar o mesmo lote não duplica cravações');

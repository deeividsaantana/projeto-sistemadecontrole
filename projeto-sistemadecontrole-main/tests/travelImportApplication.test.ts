import assert from 'node:assert/strict';
import { buildTravelImportApplication } from '../src/imports/travelImportApplication';
import type { ImportPreview, ImportPreviewRow } from '../src/imports/types';
import type { TicketJazida } from '../src/types';

const lineage = (sheet: string, row: number, status: 'ready' | 'review' = 'ready') => ({
  sourceFile: 'VIAGENS JAZIDA SABESP.xlsx', sourceSheet: sheet, sourceRow: row,
  sourceHash: 'hash-trv', importedAt: '2026-09-22T12:00:00.000Z', importBatchId: 'imp-trv',
  validationStatus: status, validationMessages: [], originalData: {},
});

const rows: ImportPreviewRow<unknown>[] = [
  {
    disposition: 'new',
    row: {
      lineage: lineage('LIBERAÇÃO', 2),
      operationalKey: 'viagem-1',
      value: {},
      rawRow: {
        Data: new Date('2026-07-01T00:00:00.000Z'), 'Ticket Nº': 1, Prefixo: 'CB929', Placa: 'FEJ4812',
        'Hora de saída': new Date('1899-12-30T08:36:00.000Z'), 'Quantidade m³': 14, 'Destino / Obra': 'Marginal',
      },
    },
  },
  {
    disposition: 'new',
    row: {
      lineage: lineage('RECEBIMENTO', 2),
      operationalKey: 'viagem-2',
      value: {},
      rawRow: {
        Data: new Date('2026-06-27T00:00:00.000Z'), 'Ticket Nº': 1, Prefixo: 'CB767', Placa: 'EFO7669',
        'Hora de chegada': new Date('1899-12-30T14:00:00.000Z'), 'Quantidade m³': 14, 'Ramo de Descarga': 'Ramo 700',
      },
    },
  },
  {
    disposition: 'new',
    row: { lineage: lineage('CADASTRO', 2), operationalKey: 'cadastro-1', value: {}, rawRow: { Prefixo: 'CB1005', Placa: 'FEJ6753' } },
  },
  {
    disposition: 'new',
    row: {
      lineage: lineage('LIBERAÇÃO', 3),
      operationalKey: 'viagem-3',
      value: {},
      rawRow: { Data: new Date('2026-07-01T00:00:00.000Z'), 'Ticket Nº': 2, Prefixo: 'CB730' }, // sem quantidade
    },
  },
  {
    disposition: 'review',
    row: { lineage: lineage('LIBERAÇÃO', 4, 'review'), value: {}, rawRow: {} },
  },
  {
    disposition: 'duplicate-in-file',
    row: { lineage: lineage('LIBERAÇÃO', 5), operationalKey: 'viagem-1', value: {}, rawRow: {} },
  },
];

const preview: ImportPreview<unknown> = {
  batchId: 'imp-trv', sourceFile: 'VIAGENS JAZIDA SABESP.xlsx', sourceHash: 'hash-trv',
  generatedAt: '2026-09-22T12:00:00.000Z', dryRun: true, sheets: [],
  counts: { new: 4, 'potential-update': 0, unchanged: 0, 'duplicate-in-file': 1, review: 1, invalid: 0, deferred: 0 },
  rows,
};

const result = buildTravelImportApplication(preview, [], 'Responsável Teste');

assert.equal(result.tickets.length, 2, 'só liberação+recebimento completos viram ticket');
assert.deepEqual(result.skipped, { duplicate: 1, review: 2, reference: 1, other: 0 });

const liberacao = result.tickets.find(t => t.tipoTicket === 'Liberação')!;
assert.ok(liberacao);
assert.equal(liberacao.data, '2026-07-01');
assert.equal(liberacao.horaSaida, '08:36', 'hora precisa vir do valor bruto, não da lineage truncada em dia');
assert.equal(liberacao.prefixo, 'CB929');
assert.equal(liberacao.destinoObra, 'Marginal');
assert.equal(liberacao.tipoMaterial, 'Outros', 'planilha não tem coluna de material: usa o mesmo default do importador existente');
assert.equal(liberacao.empresa, 'RENEA');
assert.match(liberacao.observacao, /VIAGENS.*LIBERAÇÃO.*linha 2.*imp-trv/i);

const recebimento = result.tickets.find(t => t.tipoTicket === 'Recebimento')!;
assert.ok(recebimento);
assert.equal(recebimento.horaChegada, '14:00');
assert.equal(recebimento.destinoObra, 'Ramo 700');

const reapplied = buildTravelImportApplication(preview, result.tickets as TicketJazida[], 'Responsável Teste');
assert.equal(reapplied.tickets.length, 0, 'reaplicar o mesmo lote não duplica tickets');

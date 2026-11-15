import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { parseProcurementWorkbook } from '../server/procurementSpreadsheetSync.js';

test('importador lê Solicitações, Prioridade e Substituição', async () => {
  const workbook = new ExcelJS.Workbook();
  const requests = workbook.addWorksheet('Solicitações');
  requests.addRow(['Título']);
  requests.addRow(['Data', 'N° do pedido', 'Solicitante', 'Item', 'Unidade', 'Quantidade ', 'Solicitação de compra SC  (N°)', 'previsão de entrega']);
  requests.addRow([new Date('2026-08-13'), 101, 'Lucas', 'Tubos', 'Und.', 12, 92995523, new Date('2026-09-01')]);
  workbook.addWorksheet('Prioridade').addRow(['coluna']);
  workbook.addWorksheet('Substituição').addRow(['coluna']);
  const result = await parseProcurementWorkbook(await workbook.xlsx.writeBuffer());
  assert.deepEqual(result.sheets, ['Solicitações', 'Prioridade', 'Substituição']);
  assert.deepEqual(result.requests[0], {
    source: 'Solicitações', request_date: '2026-08-13', source_request_number: '101', requester_name: 'Lucas',
    item_description: 'Tubos', unit: 'Und.', quantity_requested: 12, source_purchase_order: '92995523', delivery_deadline: '2026-09-01',
  });
});

test('sincronização registra a falha no banco quando a planilha não baixa', async () => {
  const { syncProcurementSpreadsheet } = await import('../server/procurementSpreadsheetSyncJob.js');
  const inserts: Array<Record<string, unknown>> = [];
  // Imita o construtor do Supabase: só tem `then`, não tem `.catch`.
  const client = { from: () => ({ insert: (row: Record<string, unknown>) => ({ then: (ok: (v: unknown) => unknown) => { inserts.push(row); return Promise.resolve({ error: null }).then(ok); } }) }) };
  await assert.rejects(
    syncProcurementSpreadsheet({ client, download: async () => { throw new Error('OneDrive fora'); } }),
    /OneDrive fora/,
  );
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, 'FALHA');
  assert.equal(inserts[0].error_message, 'OneDrive fora');
});

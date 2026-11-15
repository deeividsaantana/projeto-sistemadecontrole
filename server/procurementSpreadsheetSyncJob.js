import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../api/_shared/supabase-admin.js';
import { downloadProcurementWorkbook, parseProcurementWorkbook } from './procurementSpreadsheetSync.js';

const keyFor = row => crypto.createHash('sha256').update(JSON.stringify([
  row.source_request_number, row.request_date, row.requester_name, row.item_description,
  row.unit, row.quantity_requested, row.source_purchase_order, row.delivery_deadline,
])).digest('hex');

export const syncProcurementSpreadsheet = async ({ client = getSupabaseAdmin(), download = downloadProcurementWorkbook } = {}) => {
  const startedAt = new Date().toISOString();
  try {
    const parsed = await parseProcurementWorkbook(await download());
    const rows = parsed.allRows.map(row => ({
      organization_id: 'renea', source_key: keyFor(row), sheet_name: row.source,
      source_request_number: row.source_request_number || row.pedido || row.request_number || null, request_date: row.request_date || row.data || null,
      requester_name: row.requester_name || row.solicitante || null, item_description: row.item_description || row.item || row.produto || null,
      unit: row.unit || row.unidade || null, quantity_requested: row.quantity_requested ?? row.quantidade ?? null,
      source_purchase_order: row.source_purchase_order || row.sc || null, delivery_deadline: row.delivery_deadline || row.previsao || row.fim || null,
      raw_data: row, source_updated_at: startedAt, updated_at: startedAt,
    }));
    if (rows.length) {
      const { error } = await client.from('erp_procurement_sheet_rows').upsert(rows, { onConflict: 'organization_id,source_key' });
      if (error) throw error;
    }
    await client.from('erp_procurement_sync_runs').insert({ organization_id: 'renea', source: 'sharepoint-public-xlsx', status: 'SUCESSO', rows_seen: rows.length, rows_written: rows.length, started_at: startedAt, finished_at: new Date().toISOString() });
    return { rowsSeen: rows.length, rowsWritten: rows.length };
  } catch (error) {
    // O construtor do Supabase só tem `then` (sem `.catch`): o registro da falha precisa de await dentro de try.
    try {
      await client.from('erp_procurement_sync_runs').insert({ organization_id: 'renea', source: 'sharepoint-public-xlsx', status: 'FALHA', error_message: String(error?.message || error), started_at: startedAt, finished_at: new Date().toISOString() });
    } catch {
      // Sem banco não há onde registrar; o erro original segue abaixo.
    }
    throw error;
  }
};

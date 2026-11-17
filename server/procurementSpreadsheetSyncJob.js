import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../api/_shared/supabase-admin.js';
import { downloadProcurementWorkbook, parseProcurementWorkbook } from './procurementSpreadsheetSync.js';


// Coluna de data no banco só aceita data. Texto como "OK" (entregue) fica só no raw_data.
export const dataOuNulo = value => {
  const texto = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  return br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : null;
};

const textoOuNulo = value => (value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim());
const numeroOuNulo = value => {
  const n = Number(String(value ?? '').replace(',', '.'));
  return value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(n) ? null : n;
};

// Linha da planilha → linha do banco. A chave usa a aba e a linha inteira; linhas
// idênticas (mesmo item pedido duas vezes) ganham um número de ordem para não colidirem.
export const linhasParaBanco = (allRows, startedAt) => {
  const vistas = new Map();
  return allRows.map(row => {
    const base = crypto.createHash('sha256').update(JSON.stringify([row.source, row])).digest('hex');
    const ordem = vistas.get(base) || 0;
    vistas.set(base, ordem + 1);
    return {
      organization_id: 'renea', source_key: ordem ? `${base}-${ordem}` : base, sheet_name: row.source,
      source_request_number: textoOuNulo(row.source_request_number || row.pedido || row.request_number),
      request_date: dataOuNulo(row.request_date || row.data),
      requester_name: textoOuNulo(row.requester_name || row.solicitante),
      item_description: textoOuNulo(row.item_description || row.item || row.produto),
      unit: textoOuNulo(row.unit || row.unidade),
      quantity_requested: numeroOuNulo(row.quantity_requested ?? row.quantidade),
      source_purchase_order: textoOuNulo(row.source_purchase_order || row.sc),
      delivery_deadline: dataOuNulo(row.delivery_deadline || row.previsao || row.fim),
      raw_data: row, source_updated_at: startedAt, updated_at: startedAt,
    };
  });
};

export const syncProcurementSpreadsheet = async ({ client = getSupabaseAdmin(), download = downloadProcurementWorkbook } = {}) => {
  const startedAt = new Date().toISOString();
  try {
    const parsed = await parseProcurementWorkbook(await download());
    const rows = linhasParaBanco(parsed.allRows, startedAt);
    if (rows.length) {
      const { error } = await client.from('erp_procurement_sheet_rows').upsert(rows, { onConflict: 'organization_id,source_key' });
      if (error) throw error;
      // Linha apagada ou editada na planilha: a versão antiga sai do espelho.
      const { error: erroLimpeza } = await client.from('erp_procurement_sheet_rows').delete().eq('organization_id', 'renea').lt('source_updated_at', startedAt);
      if (erroLimpeza) throw erroLimpeza;
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

// Uma leitura por vez: duas ao mesmo tempo podiam apagar o que a outra acabou de gravar
// (a limpeza tira tudo que é mais velho que o início da própria leitura).
let leituraEmAndamento = null;
export const sincronizarUmaVez = (opcoes = {}) => {
  leituraEmAndamento ||= syncProcurementSpreadsheet(opcoes).finally(() => { leituraEmAndamento = null; });
  return leituraEmAndamento;
};

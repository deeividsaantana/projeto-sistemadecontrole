// Planilha de compras no preview: o espelho que o servidor grava a cada 3h,
// com um pedido novo (140) e uma mudança no 101 (nova previsão de entrega).
import type { ProcurementSheet, ProcurementSheetRow } from '../src/services/procurementSheetApi';
export type * from '../src/services/procurementSheetApi';

const LIDA = new Date(Date.now() - 40 * 60_000).toISOString();
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const linha = (id: string, pedido: string, quem: string, item: string, sc: string, previsao: string): ProcurementSheetRow => {
  const raw = { source: 'Solicitações', request_date: dia(-20), source_request_number: pedido, requester_name: quem, item_description: item, unit: 'Und.', quantity_requested: 12, source_purchase_order: sc, delivery_deadline: previsao };
  return { id, sheet_name: 'Solicitações', source_request_number: pedido, request_date: raw.request_date, requester_name: quem, item_description: item, unit: 'Und.', quantity_requested: 12, source_purchase_order: sc || null, delivery_deadline: /^\d{4}/.test(previsao) ? previsao : null, raw_data: raw, source_updated_at: LIDA };
};
const ROWS: ProcurementSheetRow[] = [
  linha('r1', '101', 'Lucas', 'TUBOS DE PVC 400mm de 6m', '93021654', dia(5)),
  linha('r2', '109', 'Carlos', 'MADEIRITE PLASTIFICADO 18mm', '93041040', dia(-2)),
  linha('r3', '109', 'Carlos', 'SARRAFO 10cm x 2,5cm x 3m', '93041040', dia(-2)),
  linha('r4', '109', 'Carlos', 'ESPUMA EXPANSIVA', '93041040', dia(-2)),
  linha('r5', '140', 'Thiago', 'LUVA DE RASPA', '', ''),
  { ...linha('r6', '101', 'Lucas', 'TUBOS DE PVC 400mm de 6m', '', ''), sheet_name: 'Prioridade', raw_data: { source: 'Prioridade', prioridade: '1º', data: dia(-20), pedido: 101 } },
];

export const loadProcurementSheet = async (sheet = 'Solicitações'): Promise<ProcurementSheet> => ({
  rows: ROWS.filter(row => !sheet || row.sheet_name === sheet),
  lastRun: { status: 'SUCESSO', error_message: null, finished_at: LIDA },
});

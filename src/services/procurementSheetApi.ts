import { supabaseAuth as auth } from '../auth/supabaseAuth';

export interface ProcurementSheetRow {
  id: string;
  sheet_name: string;
  source_request_number: string | null;
  request_date: string | null;
  requester_name: string | null;
  item_description: string | null;
  unit: string | null;
  quantity_requested: number | null;
  source_purchase_order: string | null;
  delivery_deadline: string | null;
  raw_data: Record<string, unknown> | null;
  source_updated_at: string | null;
}

export interface ProcurementSyncRun {
  status: 'SUCESSO' | 'FALHA' | string;
  error_message: string | null;
  finished_at: string | null;
}

export interface ProcurementSheet {
  rows: ProcurementSheetRow[];
  lastRun: ProcurementSyncRun | null;
  /** O site consegue gravar na planilha (script da planilha configurado na Render). */
  escrita: boolean;
}

export interface ProcurementSheetWrite extends ProcurementSheet {
  /** N° do pedido que a planilha deu a cada card aberto no site ("SOL-2026-0005" → 131). */
  pedidos: Record<string, number>;
}

export const loadProcurementSheet = async (sheet = ''): Promise<ProcurementSheet> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para visualizar a planilha de compras.');
  const query = `?limit=2000${sheet ? `&sheet=${encodeURIComponent(sheet)}` : ''}`;
  const response = await fetch(`/api/procurement-sheet${query}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success !== true) throw new Error(payload.message || 'Não foi possível carregar a planilha de compras.');
  return { rows: (payload.data || []) as ProcurementSheetRow[], lastRun: (payload.lastRun || null) as ProcurementSyncRun | null, escrita: payload.escrita === true };
};

/** Manda para a planilha o que mudou no site e devolve o espelho já relido. */
export const sendToProcurementSheet = async (linhas: readonly unknown[]): Promise<ProcurementSheetWrite> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para enviar à planilha de compras.');
  const response = await fetch('/api/procurement-sheet', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ linhas }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success !== true) throw new Error(payload.message || 'Não foi possível enviar à planilha de compras.');
  return {
    rows: (payload.data || []) as ProcurementSheetRow[],
    lastRun: (payload.lastRun || null) as ProcurementSyncRun | null,
    escrita: true,
    pedidos: (payload.pedidos || {}) as Record<string, number>,
  };
};

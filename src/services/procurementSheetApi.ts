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
  return { rows: (payload.data || []) as ProcurementSheetRow[], lastRun: (payload.lastRun || null) as ProcurementSyncRun | null };
};

import { auth } from './firebase';

export interface OneDriveFuelSyncStatus {
  state: 'waiting' | 'ready' | 'error';
  intervalMinutes: number;
  batchId?: string;
  fileName?: string;
  fileModifiedAt?: string;
  syncedAt?: string;
  rowCount?: number;
  warningCount?: number;
  message?: string;
}

export interface OneDriveFuelRow {
  sourceRowId: string;
  sourceFile?: string;
  rowNumber: number;
  sheet: string;
  data: string;
  hora: string;
  prefixo: string;
  descricaoEquipamento: string;
  kmInicial: number;
  horimetroInicial: number;
  quantidadeLitros: number;
  quantidadeOriginal: string;
  comboio: string;
  tipoCombustivel: string;
  empresa: string;
  bombaInicial: number;
  bombaFinal: number;
  responsavel: string;
  observacao: string;
  avisos: string;
}

export interface OneDriveFuelPayload {
  status: OneDriveFuelSyncStatus;
  rows: OneDriveFuelRow[];
}

export const loadOneDriveFuelPayload = async (): Promise<OneDriveFuelPayload> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para consultar o OneDrive.');
  const token = await user.getIdToken();
  const response = await fetch('/.netlify/functions/sync-combustivel-onedrive?action=payload', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) throw new Error(result.message || 'Não foi possível consultar o OneDrive.');
  return {
    status: result.status as OneDriveFuelSyncStatus,
    rows: Array.isArray(result.rows) ? result.rows as OneDriveFuelRow[] : [],
  };
};

import {
  downloadSupabaseBackup,
  getSupabaseConnectionStatus,
  uploadSupabaseBackup,
} from '../supabase/cloudSync';
import type { CloudBaseline } from '../cloudMerge';
import type {
  CloudConnectionStatus,
  CloudData,
  CloudDownloadResult,
  CloudUploadResult,
} from './cloudTypes';

export type {
  CloudConnectionStatus,
  CloudData,
  CloudDownloadResult,
  CloudUploadResult,
};

export const formatCloudSyncError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('SUPABASE_CONFIG_MISSING')) {
    return 'O Supabase foi ativado, mas as variáveis públicas de conexão ainda não foram configuradas.';
  }
  if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('permission denied')) {
    return 'O Supabase recusou o acesso. Confirme a sessão e o vínculo do usuário com a organização.';
  }
  return message || 'Falha ao sincronizar com o Supabase.';
};

export const getCloudConnectionStatus = async (
  _database?: unknown,
): Promise<CloudConnectionStatus> => getSupabaseConnectionStatus();

export const downloadCloudBackup = async (
  _database?: unknown,
): Promise<CloudDownloadResult> => downloadSupabaseBackup();

export const uploadCloudBackup = async (
  _database: unknown,
  data: CloudData,
  knownCloudVersion = '',
  baseline?: CloudBaseline,
): Promise<CloudUploadResult> => uploadSupabaseBackup(data, knownCloudVersion, baseline);

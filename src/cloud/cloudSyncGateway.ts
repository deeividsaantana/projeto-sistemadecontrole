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
} from './cloudTypes';

const loadSupabaseSync = () => import('../supabase/cloudSync');

export const formatCloudSyncError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('SUPABASE_CONFIG_MISSING')) {
    return 'O Supabase está ativo, mas as variáveis públicas de conexão ainda não foram configuradas.';
  }
  if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('permission denied')) {
    return 'O Supabase recusou o acesso. Confirme a sessão e o vínculo do usuário com a organização.';
  }
  return message || 'Não foi possível sincronizar com o Supabase.';
};

export const getCloudConnectionStatus = async (
  _legacyDatabase?: unknown,
): Promise<CloudConnectionStatus> => {
  const { getSupabaseConnectionStatus } = await loadSupabaseSync();
  return getSupabaseConnectionStatus();
};

export const downloadCloudBackup = async (
  _legacyDatabase?: unknown,
): Promise<CloudDownloadResult> => {
  const { downloadSupabaseBackup } = await loadSupabaseSync();
  return downloadSupabaseBackup();
};

export const uploadCloudBackup = async (
  data: CloudData,
  knownCloudVersion = '',
  baseline?: CloudBaseline,
): Promise<CloudUploadResult> => {
  const { uploadSupabaseBackup } = await loadSupabaseSync();
  return uploadSupabaseBackup(data, knownCloudVersion, baseline);
};

import type { CloudBaseline } from '../cloudMerge';
import { cloudProvider } from '../platform/cloudProvider';
import type { CloudConnectionStatus, CloudData, CloudDownloadResult, CloudUploadResult } from './types';

const loadSupabaseSync = () => import('../supabase/cloudSync');
export type { CloudConnectionStatus, CloudData, CloudDownloadResult, CloudUploadResult };

export const formatCloudSyncError = (error: unknown): string => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error || '');
  if (message.includes('SUPABASE_CONFIG_MISSING')) return 'O Supabase ainda não foi configurado neste ambiente.';
  if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('permission denied')) return 'O Supabase recusou o acesso. Confirme a sessão e o vínculo com a organização.';
  return message || 'Não foi possível sincronizar com o Supabase.';
};

const assertSupabase = () => {
  if (cloudProvider !== 'supabase') throw new Error('SUPABASE_ONLY_PROVIDER_REQUIRED');
};

export const getCloudConnectionStatus = async (_database?: unknown): Promise<CloudConnectionStatus> => {
  assertSupabase();
  return (await loadSupabaseSync()).getSupabaseConnectionStatus();
};

export const downloadCloudBackup = async (_database?: unknown): Promise<CloudDownloadResult> => {
  assertSupabase();
  return (await loadSupabaseSync()).downloadSupabaseBackup();
};

export const uploadCloudBackup = async (_database: unknown, data: CloudData, knownCloudVersion = '', baseline?: CloudBaseline): Promise<CloudUploadResult> => {
  assertSupabase();
  return (await loadSupabaseSync()).uploadSupabaseBackup(data, knownCloudVersion, baseline);
};

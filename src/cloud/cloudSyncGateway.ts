import type { Firestore } from 'firebase/firestore';
import {
  downloadFirebaseBackup,
  formatFirebaseSyncError,
  getFirebaseConnectionStatus,
  uploadFirebaseBackup,
  type FirebaseCloudData,
  type FirebaseConnectionStatus,
  type FirebaseDownloadResult,
  type FirebaseUploadResult,
} from '../firebaseCloudSync';
import type { CloudBaseline } from '../cloudMerge';
import { cloudProvider } from '../platform/cloudProvider';

export type CloudData = FirebaseCloudData;
export type CloudConnectionStatus = FirebaseConnectionStatus;
export type CloudDownloadResult = FirebaseDownloadResult;
export type CloudUploadResult = FirebaseUploadResult;

const loadSupabaseSync = () => import('../supabase/cloudSync');

export const formatCloudSyncError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('SUPABASE_CONFIG_MISSING')) {
    return 'O Supabase foi ativado, mas as variáveis públicas de conexão ainda não foram configuradas.';
  }
  if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('permission denied')) {
    return 'O Supabase recusou o acesso. Confirme a sessão e o vínculo do usuário com a organização.';
  }
  return formatFirebaseSyncError(error);
};

export const getCloudConnectionStatus = async (
  database: Firestore,
): Promise<CloudConnectionStatus> => {
  if (cloudProvider === 'firebase') return getFirebaseConnectionStatus(database);
  if (cloudProvider === 'supabase') {
    const { getSupabaseConnectionStatus } = await loadSupabaseSync();
    return getSupabaseConnectionStatus();
  }

  const firebaseStatus = await getFirebaseConnectionStatus(database);
  const { getSupabaseConnectionStatus } = await loadSupabaseSync();
  try {
    await getSupabaseConnectionStatus();
  } catch (error) {
    console.warn('Firebase disponível; o espelho Supabase ainda não respondeu.', error);
  }
  return firebaseStatus;
};

export const downloadCloudBackup = async (
  database: Firestore,
): Promise<CloudDownloadResult> => {
  if (cloudProvider === 'supabase') {
    const { downloadSupabaseBackup } = await loadSupabaseSync();
    return downloadSupabaseBackup();
  }
  // Em dual-write o Firebase permanece autoritativo até a virada planejada.
  return downloadFirebaseBackup(database);
};

export const uploadCloudBackup = async (
  database: Firestore,
  data: CloudData,
  knownCloudVersion = '',
  baseline?: CloudBaseline,
): Promise<CloudUploadResult> => {
  if (cloudProvider === 'supabase') {
    const { uploadSupabaseBackup } = await loadSupabaseSync();
    return uploadSupabaseBackup(data, knownCloudVersion, baseline);
  }

  const firebaseResult = await uploadFirebaseBackup(database, data, knownCloudVersion, baseline);
  if (cloudProvider === 'dual-write') {
    const { uploadSupabaseBackup } = await loadSupabaseSync();
    try {
      await uploadSupabaseBackup(data, '', undefined);
    } catch (error) {
      // O provedor autoritativo confirmou o backup. A sombra é observável, mas
      // não transforma uma gravação válida em falha operacional.
      console.warn('Backup Firebase confirmado; falha ao atualizar o espelho Supabase.', error);
    }
  }
  return firebaseResult;
};


import { captureCloudBaseline, mergeCloudSnapshotsWithBaseline, resolvePublishPayload, type CloudBaseline } from '../cloudMerge';
import type {
  FirebaseCloudData,
  FirebaseConnectionStatus,
  FirebaseDownloadResult,
  FirebaseUploadResult,
} from '../firebaseCloudSync';
import { getSupabaseClient } from './client';
import { resolveSupabaseClientConfig } from './config';

const MAX_CONFLICT_ATTEMPTS = 4;

interface SnapshotRow {
  payload: FirebaseCloudData;
  updated_at: string;
  record_count: number;
}

const countRecords = (data: FirebaseCloudData) => Object.values(data).reduce<number>(
  (total, value) => total + (Array.isArray(value) ? value.length : 0),
  0,
);

const isVersionConflict = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('CLOUD_VERSION_CONFLICT');
};

const normalizeSupabaseError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message || 'Falha no Supabase.'));
  }
  return new Error(String(error || 'Falha no Supabase.'));
};

export const getSupabaseConnectionStatus = async (): Promise<FirebaseConnectionStatus> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data, error } = await client
    .from('erp_snapshots')
    .select('updated_at')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error);
  return {
    connected: true,
    updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : '',
    schemaVersion: 1,
  };
};

export const downloadSupabaseBackup = async (): Promise<FirebaseDownloadResult> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data, error } = await client
    .from('erp_snapshots')
    .select('payload, updated_at, record_count')
    .eq('organization_id', organizationId)
    .maybeSingle<SnapshotRow>();

  if (error) throw normalizeSupabaseError(error);
  if (!data) return { data: null, source: 'none', updatedAt: '', totalRecords: 0 };
  return {
    data: data.payload,
    source: 'supabase',
    updatedAt: data.updated_at,
    totalRecords: data.record_count ?? countRecords(data.payload),
  };
};

const publishSnapshot = async (
  data: FirebaseCloudData,
  knownCloudVersion: string,
): Promise<FirebaseUploadResult> => {
  const client = getSupabaseClient();
  const organizationId = resolveSupabaseClientConfig().organizationId;
  const { data: result, error } = await client.rpc('publish_erp_snapshot', {
    p_organization_id: organizationId,
    p_known_updated_at: knownCloudVersion || null,
    p_payload: data,
  });

  if (error) throw normalizeSupabaseError(error);
  const published = Array.isArray(result) ? result[0] : result;
  const updatedAt = String(published?.published_at || new Date().toISOString());
  return {
    updatedAt,
    totalRecords: Number(published?.total_records ?? countRecords(data)),
    writtenDocuments: 1,
    reusedDocuments: 0,
    publishedBaseline: captureCloudBaseline(data),
  };
};

export const uploadSupabaseBackup = async (
  data: FirebaseCloudData,
  knownCloudVersion = '',
  baseline?: CloudBaseline,
): Promise<FirebaseUploadResult> => {
  let payload = data;
  let expectedVersion = knownCloudVersion;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONFLICT_ATTEMPTS; attempt += 1) {
    try {
      const remote = await downloadSupabaseBackup();
      if (remote.updatedAt && remote.updatedAt !== expectedVersion) {
        payload = resolvePublishPayload({
          localPayload: payload,
          remoteSnapshot: remote.data,
          remoteUpdatedAt: remote.updatedAt,
          knownCloudVersion: expectedVersion,
          baseline,
        }) as FirebaseCloudData;
        expectedVersion = remote.updatedAt;
      }
      return await publishSnapshot(payload, expectedVersion);
    } catch (error) {
      if (!isVersionConflict(error) || attempt === MAX_CONFLICT_ATTEMPTS) throw error;
      lastError = error;
      const remote = await downloadSupabaseBackup();
      payload = mergeCloudSnapshotsWithBaseline(remote.data, payload, baseline) as FirebaseCloudData;
      expectedVersion = remote.updatedAt;
    }
  }

  throw normalizeSupabaseError(lastError);
};


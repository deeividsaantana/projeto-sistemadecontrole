import { auth } from '../firebase';

export const MASTER_DATA_ENTITIES = [
  'companies',
  'locations',
  'work_branches',
  'equipment',
  'vehicles',
  'collaborators',
  'suppliers',
  'materials',
  'convoys',
  'fuel_types',
  'lubricant_products',
  'service_stages',
] as const;

export type MasterDataEntity = typeof MASTER_DATA_ENTITIES[number];
export type MasterDataReviewEntity =
  | 'companies'
  | 'suppliers'
  | 'materials'
  | 'locations'
  | 'work_branches'
  | 'collaborators'
  | 'equipment'
  | 'vehicles';

export interface MasterDataGatewayStatus {
  configured: boolean;
  mode: 'firebase-auth-netlify-firestore';
  organization: {
    id: string;
    code: string;
    name: string;
  };
  role: 'admin' | 'gestor' | 'operador' | 'leitura';
  supportedEntities: MasterDataEntity[];
}

export interface PersistedAuditLog {
  id: string;
  module: string;
  recordId: string;
  action: string;
  userId: string;
  userEmail?: string | null;
  createdAtIso: string;
  details?: Record<string, unknown>;
}

export type ManagedUserRole = 'admin' | 'gestor' | 'operador' | 'leitura';

export interface ManagedUser {
  id: string;
  firebaseUid: string;
  email: string | null;
  fullName: string;
  role: ManagedUserRole;
  active: boolean;
  lastSeenAt?: unknown;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const endpoint = '/.netlify/functions/master-data';

const authorizationHeaders = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para consultar os cadastros mestres.');
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    'Content-Type': 'application/json',
  };
};

const request = async <T>(url: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...await authorizationHeaders(),
      ...init.headers,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.message || 'Não foi possível consultar a persistência protegida do Firebase.');
  }
  return payload as ApiEnvelope<T>;
};

export const loadMasterDataGatewayStatus = async (): Promise<MasterDataGatewayStatus> => {
  const response = await request<MasterDataGatewayStatus>(endpoint);
  return response.data;
};

export const loadPersistedAuditTrail = async (limit = 100): Promise<PersistedAuditLog[]> => {
  const query = new URLSearchParams({ action: 'audit', limit: String(limit) });
  const response = await request<{ records: PersistedAuditLog[] }>(endpoint + '?' + query);
  return response.data.records;
};

export const loadManagedUsers = async (limit = 100): Promise<ManagedUser[]> => {
  const query = new URLSearchParams({ action: 'users', limit: String(limit) });
  const response = await request<{ users: ManagedUser[] }>(endpoint + '?' + query);
  return response.data.users;
};

export const createManagedUser = async (input: {
  fullName: string;
  email: string;
  password: string;
  role: ManagedUserRole;
}) => {
  const response = await request<{ uid: string; email: string; fullName: string; role: ManagedUserRole }>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ action: 'create-user', ...input }),
  });
  return response.data;
};

export const updateManagedUser = async (input: {
  uid: string;
  role: ManagedUserRole;
  active: boolean;
}) => {
  const response = await request<{ uid: string; role: ManagedUserRole; active: boolean }>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'update-user', ...input }),
  });
  return response.data;
};

export const listMasterData = async <T extends Record<string, unknown>>(
  entity: MasterDataEntity,
  options: { search?: string; limit?: number } = {},
): Promise<T[]> => {
  const query = new URLSearchParams({ entity });
  if (options.search) query.set('search', options.search);
  if (options.limit) query.set('limit', String(options.limit));
  const response = await request<{ entity: MasterDataEntity; records: T[] }>(`${endpoint}?${query}`);
  return response.data.records;
};

export const createMasterData = async <T extends Record<string, unknown>>(
  entity: MasterDataEntity,
  data: Record<string, unknown>,
): Promise<T> => {
  const response = await request<{ entity: MasterDataEntity; record: T }>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ entity, data }),
  });
  return response.data.record;
};

export const updateMasterData = async <T extends Record<string, unknown>>(
  entity: MasterDataEntity,
  id: string,
  data: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<T> => {
  const response = await request<{ entity: MasterDataEntity; record: T }>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify({ entity, id, data, expectedUpdatedAt }),
  });
  return response.data.record;
};

export const archiveMasterData = async (entity: MasterDataEntity, id: string): Promise<void> => {
  await request<{ entity: MasterDataEntity; id: string }>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify({ entity, id }),
  });
};

export const preserveMasterDataImport = async (
  sourceName: string,
  rows: unknown[],
  options: {
    entity?: MasterDataEntity;
    sourceType?: string;
    worksheetName?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<{ batchId: string; preservedRows: number }> => {
  const response = await request<{ batchId: string; preservedRows: number }>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      action: 'preserve-import',
      sourceName,
      rows,
      ...options,
    }),
  });
  return response.data;
};

export interface StagedMasterDataImport {
  batchId: string;
  entity: MasterDataReviewEntity;
  totalRows: number;
  readyRows: number;
  matchedRows: number;
  duplicateRows: number;
  invalidRows: number;
}

export interface StagedFuelImport {
  batchId: string;
  preservedRows: number;
  reviewRows: number;
  pendingRows: number;
}

export interface StagedTravelImport {
  batchId: string;
  preservedRows: number;
  reviewRows: number;
  pendingRows: number;
  duplicateRows: number;
}

export const stageMasterDataImport = async (
  sourceName: string,
  entity: MasterDataReviewEntity,
  worksheetName: string,
  rows: unknown[],
  metadata: Record<string, unknown> = {},
): Promise<StagedMasterDataImport> => {
  const response = await request<StagedMasterDataImport>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      action: 'stage-master-import',
      sourceName,
      sourceType: 'master-workbook',
      entity,
      worksheetName,
      rows,
      metadata,
    }),
  });
  return response.data;
};

export const stageFuelDataset = async (
  sourceName: string,
  rows: unknown[],
  metadata: Record<string, unknown> = {},
): Promise<StagedFuelImport[]> => {
  const chunks: unknown[][] = [];
  let currentChunk: unknown[] = [];
  let currentBytes = 2;
  rows.forEach(row => {
    const rowBytes = new TextEncoder().encode(JSON.stringify(row)).length + 1;
    if (currentChunk.length > 0 && (currentChunk.length >= 5000 || currentBytes + rowBytes > 3_000_000)) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentBytes = 2;
    }
    currentChunk.push(row);
    currentBytes += rowBytes;
  });
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const batches: StagedFuelImport[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const response = await request<StagedFuelImport>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        action: 'stage-fuel-import',
        sourceName: chunks.length > 1 ? `${sourceName} • lote ${index + 1}` : sourceName,
        sourceType: 'fuel-system',
        worksheetName: 'ABASTECIMENTOS',
        rows: chunk,
        metadata: {
          ...metadata,
          chunkIndex: index,
          chunkRows: chunk.length,
          totalRows: rows.length,
        },
      }),
    });
    batches.push(response.data);
  }
  return batches;
};

export const stageTravelDataset = async (
  sourceName: string,
  rows: unknown[],
  metadata: Record<string, unknown> = {},
): Promise<StagedTravelImport[]> => {
  const chunks: unknown[][] = [];
  let currentChunk: unknown[] = [];
  let currentBytes = 2;
  rows.forEach(row => {
    const rowBytes = new TextEncoder().encode(JSON.stringify(row)).length + 1;
    if (currentChunk.length > 0 && (currentChunk.length >= 5000 || currentBytes + rowBytes > 3_000_000)) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentBytes = 2;
    }
    currentChunk.push(row);
    currentBytes += rowBytes;
  });
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const batches: StagedTravelImport[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const response = await request<StagedTravelImport>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        action: 'stage-travel-import',
        sourceName: chunks.length > 1 ? `${sourceName} • lote ${index + 1}` : sourceName,
        sourceType: 'travel-system',
        worksheetName: 'LIBERAÇÃO + RECEBIMENTO',
        rows: chunk,
        metadata: {
          ...metadata,
          chunkIndex: index,
          chunkRows: chunk.length,
          totalRows: rows.length,
        },
      }),
    });
    batches.push(response.data);
  }
  return batches;
};

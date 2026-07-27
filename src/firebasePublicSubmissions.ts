import {
  collection,
  doc,
  Firestore,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { ApontamentoRamoRegistro, PresencaApontamento } from './types';

const SUBMISSIONS_COLLECTION = 'sistemarenea_public_submissions';

export type PublicSubmission = {
  id: string;
  kind: 'presence' | 'apontamento';
  status: 'pending' | 'processed';
  createdAtIso: string;
  payload: {
    grupoId?: string;
    grupoNome?: string;
    ramoId?: string;
    data: string;
    records?: PresencaApontamento[];
    record?: ApontamentoRamoRegistro;
  };
};

export const loadPendingPublicSubmissions = async (database: Firestore): Promise<PublicSubmission[]> => {
  const snapshot = await getDocs(query(
    collection(database, SUBMISSIONS_COLLECTION),
    where('status', '==', 'pending'),
  ));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }) as PublicSubmission)
    .filter(item => item.kind === 'presence' || item.kind === 'apontamento')
    .filter(item => item.payload && typeof item.payload.data === 'string')
    .sort((a, b) => String(a.createdAtIso || '').localeCompare(String(b.createdAtIso || '')));
};

export const markPublicSubmissionsProcessed = async (
  database: Firestore,
  submissionIds: string[],
  processedBy: string,
) => {
  for (let index = 0; index < submissionIds.length; index += 400) {
    const batch = writeBatch(database);
    submissionIds.slice(index, index + 400).forEach(id => {
      batch.update(doc(database, SUBMISSIONS_COLLECTION, id), {
        status: 'processed',
        processedAt: serverTimestamp(),
        processedBy,
      });
    });
    await batch.commit();
  }
};

import {
  collection,
  doc,
  Firestore,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import type { PresencaApontamento } from './types';

export const SUBMISSIONS_COLLECTION = 'sistemarenea_public_submissions';

/**
 * `equipe` carrega inclusão ou remoção de um colaborador feita pelo link
 * público. O painel incorpora a alteração sem tocar no cadastro da pessoa.
 */
export type PublicSubmission = {
  id: string;
  kind: 'presence' | 'presence-reset' | 'equipe';
  status: 'pending' | 'processed' | 'cancelled';
  createdAtIso: string;
  payload: {
    grupoId?: string;
    grupoNome?: string;
    data: string;
    records?: PresencaApontamento[];
    funcionarioId?: string;
    funcionarioNome?: string;
    funcao?: string;
    operacao?: 'adicionar' | 'remover';
  };
};

export const normalizeSubmissionSnapshot = (items: Array<{ id: string; data: () => Record<string, unknown> }>): PublicSubmission[] => items
  .map(item => ({ id: item.id, ...item.data() }) as PublicSubmission)
  .filter(item => item.kind === 'presence' || item.kind === 'presence-reset' || item.kind === 'equipe')
  .filter(item => item.payload && typeof item.payload.data === 'string')
  .sort((a, b) => String(a.createdAtIso || '').localeCompare(String(b.createdAtIso || '')));

export const subscribePendingPublicSubmissions = (
  database: Firestore,
  onChange: (submissions: PublicSubmission[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  query(collection(database, SUBMISSIONS_COLLECTION), where('status', '==', 'pending')),
  snapshot => onChange(normalizeSubmissionSnapshot(snapshot.docs)),
  error => onError(error),
);

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

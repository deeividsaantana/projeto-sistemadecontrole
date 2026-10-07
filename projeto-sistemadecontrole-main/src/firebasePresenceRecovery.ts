import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import {
  normalizeSubmissionSnapshot,
  SUBMISSIONS_COLLECTION,
  type PublicSubmission,
} from './firebasePublicSubmissions';

/**
 * Lê TODOS os envios de presença já feitos pelo link público, processados ou
 * não. Usado para reconstruir o histórico quando o retrato consolidado
 * perdeu registros antigos: a fila pública em si nunca é apagada nem
 * sobrescrita pelo navegador (as regras do Firestore proíbem create/delete
 * por aqui, só o Admin SDK cria e só "status" pode ser atualizado), então
 * ela continua sendo a fonte confiável mesmo que o retrato consolidado
 * tenha sido perdido.
 *
 * Deliberadamente numa leitura pontual (getDocs), não numa assinatura em
 * tempo real: é uma ação manual e rara de recuperação, não o caminho normal
 * de entrada de presença no painel — esse caminho continua sendo só
 * onSnapshot, em firebasePublicSubmissions.ts.
 */
export const fetchAllPresenceSubmissions = async (
  database: Firestore,
): Promise<PublicSubmission[]> => {
  const snapshot = await getDocs(
    query(collection(database, SUBMISSIONS_COLLECTION), where('kind', '==', 'presence')),
  );
  return normalizeSubmissionSnapshot(snapshot.docs);
};

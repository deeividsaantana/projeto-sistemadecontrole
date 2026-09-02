import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  FALLBACK_FIREBASE_PROJECT_ID,
  getMissingFirebaseClientConfigKeys,
  getMissingFirebaseEnvKeys,
  resolveFirebaseClientConfig,
} from './config/firebaseClientConfig';

const firebaseConfig = resolveFirebaseClientConfig();
const missingFirebaseKeys = getMissingFirebaseClientConfigKeys(firebaseConfig);
const missingEnvKeys = getMissingFirebaseEnvKeys();

if (missingFirebaseKeys.length > 0) {
  console.warn(`Configuração Firebase incompleta: ${missingFirebaseKeys.join(', ')}.`);
}

// Sem as variáveis do build, o sistema abre normalmente e conversa com o projeto
// embutido — nenhum dado da obra aparece e a causa não fica visível em lugar
// nenhum. O aviso nomeia o projeto em uso para que a troca de site ou de conta
// não termine em um banco silenciosamente errado.
if (missingEnvKeys.length > 0) {
  console.error(
    `[RENEA] Firebase sem configuração de ambiente: ${missingEnvKeys.join(', ')}. `
    + `O sistema está usando o projeto embutido "${FALLBACK_FIREBASE_PROJECT_ID}" e não os dados da obra. `
    + 'Defina as variáveis VITE_FIREBASE_* no painel do site e publique de novo.',
  );
}

/** Projeto Firebase que este build realmente usa. Consultável pelo console. */
export const activeFirebaseProjectId = firebaseConfig.projectId;
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__reneaFirebaseProjectId = activeFirebaseProjectId;
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Error handling types and helper as specified by firebase-integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, // Simple local credentials in use
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;

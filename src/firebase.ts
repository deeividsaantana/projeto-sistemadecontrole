import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  getMissingFirebaseClientConfigKeys,
  resolveFirebaseClientConfig,
} from './config/firebaseClientConfig';

const firebaseConfig = resolveFirebaseClientConfig();
const missingFirebaseKeys = getMissingFirebaseClientConfigKeys(firebaseConfig);

if (missingFirebaseKeys.length > 0) {
  console.warn(`Configuração Firebase incompleta: ${missingFirebaseKeys.join(', ')}.`);
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

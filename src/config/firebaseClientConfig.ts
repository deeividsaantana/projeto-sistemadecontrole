export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

type FirebaseEnv = Partial<Record<
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_DATABASE_URL'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_FIREBASE_MEASUREMENT_ID',
  string
>>;

const defaultFirebaseClientConfig: FirebaseClientConfig = {
  apiKey: 'AIzaSyDGN9xLkhgsqDIMXSTU9G03LEeC4Jmjpo4',
  authDomain: 'sistemarenea.firebaseapp.com',
  databaseURL: 'https://sistemarenea-default-rtdb.firebaseio.com',
  projectId: 'sistemarenea',
  storageBucket: 'sistemarenea.firebasestorage.app',
  messagingSenderId: '259137561260',
  appId: '1:259137561260:web:835cac33a4a8ba6afaf509',
  measurementId: 'G-JJXRKV2FB7',
};

const pickEnv = (env: FirebaseEnv, key: keyof FirebaseEnv, fallback: string) => {
  const value = String(env[key] || '').trim();
  return value || fallback;
};

export const resolveFirebaseClientConfig = (
  env: FirebaseEnv = import.meta.env,
): FirebaseClientConfig => ({
  apiKey: pickEnv(env, 'VITE_FIREBASE_API_KEY', defaultFirebaseClientConfig.apiKey),
  authDomain: pickEnv(env, 'VITE_FIREBASE_AUTH_DOMAIN', defaultFirebaseClientConfig.authDomain),
  databaseURL: pickEnv(env, 'VITE_FIREBASE_DATABASE_URL', defaultFirebaseClientConfig.databaseURL),
  projectId: pickEnv(env, 'VITE_FIREBASE_PROJECT_ID', defaultFirebaseClientConfig.projectId),
  storageBucket: pickEnv(env, 'VITE_FIREBASE_STORAGE_BUCKET', defaultFirebaseClientConfig.storageBucket),
  messagingSenderId: pickEnv(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID', defaultFirebaseClientConfig.messagingSenderId),
  appId: pickEnv(env, 'VITE_FIREBASE_APP_ID', defaultFirebaseClientConfig.appId),
  measurementId: pickEnv(env, 'VITE_FIREBASE_MEASUREMENT_ID', defaultFirebaseClientConfig.measurementId || ''),
});

export const getMissingFirebaseClientConfigKeys = (
  config: FirebaseClientConfig,
): Array<keyof FirebaseClientConfig> => {
  const requiredKeys: Array<keyof FirebaseClientConfig> = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  return requiredKeys.filter(key => !String(config[key] || '').trim());
};

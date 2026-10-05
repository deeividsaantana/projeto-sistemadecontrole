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

/**
 * Retrato do projeto da obra, embutido para que a aplicação abra mesmo sem
 * configuração de ambiente. Vale como rede de segurança, não como fonte de
 * verdade: um valor que mude no console e não aqui passa a divergir em silêncio.
 * `getMissingFirebaseEnvKeys` denuncia o build que depende deste retrato.
 */
const defaultFirebaseClientConfig: FirebaseClientConfig = {
  apiKey: 'AIzaSyBPcOluz5J84fdSMRFekHwa-6TCk2ts4K8',
  authDomain: 'sistemaerp-787f6.firebaseapp.com',
  databaseURL: 'https://sistemaerp-787f6-default-rtdb.firebaseio.com',
  projectId: 'sistemaerp-787f6',
  storageBucket: 'sistemaerp-787f6.firebasestorage.app',
  messagingSenderId: '333772297925',
  appId: '1:333772297925:web:b7ece8323a6ef5e28742ac',
  measurementId: 'G-WS7H39BVDR',
};

const pickEnv = (env: FirebaseEnv, key: keyof FirebaseEnv, fallback: string) => {
  const value = String(env[key] || '').trim();
  return value || fallback;
};

/** Variáveis sem as quais o navegador cai no projeto embutido. */
const REQUIRED_ENV_KEYS: Array<keyof FirebaseEnv> = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

/**
 * Variáveis ausentes no build. Diferente de `getMissingFirebaseClientConfigKeys`,
 * que inspeciona o resultado já preenchido pelos padrões e por isso nunca acusa
 * nada, esta função olha o ambiente e revela a falta antes de ela virar um banco
 * errado em produção.
 */
export const getMissingFirebaseEnvKeys = (
  env: FirebaseEnv = import.meta.env,
): Array<keyof FirebaseEnv> => REQUIRED_ENV_KEYS.filter(key => !String(env[key] || '').trim());

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

/** Projeto embutido, para comparar com o que o build realmente vai usar. */
export const FALLBACK_FIREBASE_PROJECT_ID = defaultFirebaseClientConfig.projectId;

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

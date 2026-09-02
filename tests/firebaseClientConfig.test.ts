import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FALLBACK_FIREBASE_PROJECT_ID,
  getMissingFirebaseClientConfigKeys,
  getMissingFirebaseEnvKeys,
  resolveFirebaseClientConfig,
} from '../src/config/firebaseClientConfig';

const AMBIENTE_COMPLETO = {
  VITE_FIREBASE_API_KEY: 'api-env',
  VITE_FIREBASE_AUTH_DOMAIN: 'auth-env.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://env.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'project-env',
  VITE_FIREBASE_STORAGE_BUCKET: 'bucket-env.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: 'app-env',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-ENV',
};

test('configuracao Firebase aceita variaveis Vite por ambiente', () => {
  const config = resolveFirebaseClientConfig(AMBIENTE_COMPLETO);

  assert.equal(config.apiKey, 'api-env');
  assert.equal(config.projectId, 'project-env');
  assert.equal(config.measurementId, 'G-ENV');
  assert.deepEqual(getMissingFirebaseClientConfigKeys(config), []);
});

test('configuracao Firebase preserva fallback do projeto atual', () => {
  const config = resolveFirebaseClientConfig({});

  assert.equal(config.projectId, 'sistemaerp-787f6');
  assert.equal(config.authDomain, 'sistemaerp-787f6.firebaseapp.com');
  assert.equal(config.storageBucket, 'sistemaerp-787f6.firebasestorage.app');
  assert.deepEqual(getMissingFirebaseClientConfigKeys(config), []);
});

test('build sem variaveis de ambiente e denunciado antes de virar banco errado', () => {
  // O projeto embutido preenche tudo, entao a conferencia do resultado nao acusa
  // nada. Quem revela a falta e a conferencia do ambiente.
  const config = resolveFirebaseClientConfig({});
  assert.deepEqual(getMissingFirebaseClientConfigKeys(config), []);

  assert.deepEqual(getMissingFirebaseEnvKeys({}), [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ]);
  assert.equal(config.projectId, FALLBACK_FIREBASE_PROJECT_ID);
});

test('ambiente completo nao acusa falta, e measurementId e opcional', () => {
  assert.deepEqual(getMissingFirebaseEnvKeys(AMBIENTE_COMPLETO), []);
  const { VITE_FIREBASE_MEASUREMENT_ID: _ignorado, ...semMedicao } = AMBIENTE_COMPLETO;
  assert.deepEqual(getMissingFirebaseEnvKeys(semMedicao), []);
});

test('uma unica variavel faltando ja aponta o problema pelo nome', () => {
  const { VITE_FIREBASE_PROJECT_ID: _ausente, ...semProjeto } = AMBIENTE_COMPLETO;
  assert.deepEqual(getMissingFirebaseEnvKeys(semProjeto), ['VITE_FIREBASE_PROJECT_ID']);
});

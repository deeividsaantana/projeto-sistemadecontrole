import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMissingFirebaseClientConfigKeys,
  resolveFirebaseClientConfig,
} from '../src/config/firebaseClientConfig';

test('configuracao Firebase aceita variaveis Vite por ambiente', () => {
  const config = resolveFirebaseClientConfig({
    VITE_FIREBASE_API_KEY: 'api-env',
    VITE_FIREBASE_AUTH_DOMAIN: 'auth-env.firebaseapp.com',
    VITE_FIREBASE_DATABASE_URL: 'https://env.firebaseio.com',
    VITE_FIREBASE_PROJECT_ID: 'project-env',
    VITE_FIREBASE_STORAGE_BUCKET: 'bucket-env.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    VITE_FIREBASE_APP_ID: 'app-env',
    VITE_FIREBASE_MEASUREMENT_ID: 'G-ENV',
  });

  assert.equal(config.apiKey, 'api-env');
  assert.equal(config.projectId, 'project-env');
  assert.equal(config.measurementId, 'G-ENV');
  assert.deepEqual(getMissingFirebaseClientConfigKeys(config), []);
});

test('configuracao Firebase preserva fallback local atual', () => {
  const config = resolveFirebaseClientConfig({});

  assert.equal(config.projectId, 'sistemarenea');
  assert.equal(config.authDomain, 'sistemarenea.firebaseapp.com');
  assert.equal(config.storageBucket, 'sistemarenea.firebasestorage.app');
  assert.deepEqual(getMissingFirebaseClientConfigKeys(config), []);
});

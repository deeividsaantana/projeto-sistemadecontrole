import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const providerSource = readFileSync(new URL('../src/platform/cloudProvider.ts', import.meta.url), 'utf8');
const gatewaySource = readFileSync(new URL('../src/cloud/cloudSyncGateway.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('provider de nuvem final e exclusivamente supabase', () => {
  assert.doesNotMatch(providerSource, /firebase|dual-write/i);
  assert.match(providerSource, /export const cloudProvider(?:: CloudProvider)? = 'supabase'/);
  assert.match(providerSource, /export const isSupabaseCloudEnabled = true/);
});

test('gateway operacional nao importa nem usa Firebase como fallback', () => {
  assert.doesNotMatch(gatewaySource, /firebaseCloudSync|downloadFirebaseBackup|uploadFirebaseBackup|getFirebaseConnectionStatus|formatFirebaseSyncError/);
  assert.doesNotMatch(gatewaySource, /Firestore/);
  assert.match(gatewaySource, /downloadSupabaseBackup/);
  assert.match(gatewaySource, /uploadSupabaseBackup/);
});

test('rotas privadas SaaS entram direto no shell Supabase', () => {
  assert.doesNotMatch(mainSource, /isSupabaseCloudEnabled/);
  assert.match(mainSource, /if \(privateRoute\)/);
  assert.match(mainSource, /<PrivateRouteApp route=\{privateRoute\}/);
});

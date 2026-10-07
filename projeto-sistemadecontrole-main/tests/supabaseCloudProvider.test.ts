import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveCloudProvider,
  isSupabaseCloudEnabledFor,
} from '../src/platform/cloudProvider';

test('provider Supabase cai para Firebase quando as variaveis obrigatorias ainda nao existem', () => {
  const provider = resolveCloudProvider({
    VITE_CLOUD_PROVIDER: 'supabase',
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: '',
    VITE_SUPABASE_ORGANIZATION_ID: '',
  });

  assert.equal(provider, 'firebase');
  assert.equal(isSupabaseCloudEnabledFor({
    VITE_CLOUD_PROVIDER: 'supabase',
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: '',
    VITE_SUPABASE_ORGANIZATION_ID: '',
  }), false);
});

test('provider dual-write continua habilitado quando o Supabase estiver configurado', () => {
  const provider = resolveCloudProvider({
    VITE_CLOUD_PROVIDER: 'dual-write',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
    VITE_SUPABASE_ORGANIZATION_ID: 'renea',
  });

  assert.equal(provider, 'dual-write');
  assert.equal(isSupabaseCloudEnabledFor({
    VITE_CLOUD_PROVIDER: 'dual-write',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
    VITE_SUPABASE_ORGANIZATION_ID: 'renea',
  }), true);
});

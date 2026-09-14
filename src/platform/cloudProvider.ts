export type CloudProvider = 'firebase' | 'supabase' | 'dual-write';

const SUPPORTED_PROVIDERS = new Set<CloudProvider>(['firebase', 'supabase', 'dual-write']);

const requestedProvider = String(import.meta.env.VITE_CLOUD_PROVIDER || 'firebase')
  .trim()
  .toLowerCase();

export const cloudProvider: CloudProvider = SUPPORTED_PROVIDERS.has(requestedProvider as CloudProvider)
  ? requestedProvider as CloudProvider
  : 'firebase';

export const isSupabaseCloudEnabled = cloudProvider === 'supabase' || cloudProvider === 'dual-write';

export const cloudProviderLabel = cloudProvider === 'supabase'
  ? 'Supabase'
  : cloudProvider === 'dual-write'
    ? 'Firebase + Supabase'
    : 'Firebase';


export type CloudProvider = 'supabase';

const SUPPORTED_PROVIDERS = new Set<CloudProvider>(['supabase']);

// Supabase é o único provedor aceito pelo sistema.
const requestedProvider = String(import.meta.env.VITE_CLOUD_PROVIDER || 'supabase')
  .trim()
  .toLowerCase();

export const cloudProvider: CloudProvider = SUPPORTED_PROVIDERS.has(requestedProvider as CloudProvider)
  ? requestedProvider as CloudProvider
  : 'supabase';

export const isSupabaseCloudEnabled = true;

export const cloudProviderLabel = 'Supabase';


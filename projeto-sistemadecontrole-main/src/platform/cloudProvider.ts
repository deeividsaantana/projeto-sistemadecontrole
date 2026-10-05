export type CloudProvider = 'firebase' | 'supabase' | 'dual-write';

const SUPPORTED_PROVIDERS = new Set<CloudProvider>(['firebase', 'supabase', 'dual-write']);

export interface CloudProviderEnvironment {
  VITE_CLOUD_PROVIDER?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ORGANIZATION_ID?: string;
}

const hasSupabaseConfiguration = (environment: CloudProviderEnvironment): boolean => Boolean(
  String(environment.VITE_SUPABASE_URL || '').trim()
  && String(environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY || '').trim()
  && String(environment.VITE_SUPABASE_ORGANIZATION_ID || 'renea').trim(),
);

export const resolveCloudProvider = (environment: CloudProviderEnvironment = {}): CloudProvider => {
  const requestedProvider = String(environment.VITE_CLOUD_PROVIDER || 'firebase')
    .trim()
    .toLowerCase();

  if (!SUPPORTED_PROVIDERS.has(requestedProvider as CloudProvider)) return 'firebase';
  if (requestedProvider !== 'firebase' && !hasSupabaseConfiguration(environment)) return 'firebase';
  return requestedProvider as CloudProvider;
};

export const cloudProvider: CloudProvider = resolveCloudProvider(import.meta.env ?? {});

export const isSupabaseCloudEnabled = cloudProvider === 'supabase' || cloudProvider === 'dual-write';

export const isSupabaseCloudEnabledFor = (environment: CloudProviderEnvironment): boolean => {
  const provider = resolveCloudProvider(environment);
  return provider === 'supabase' || provider === 'dual-write';
};

export const cloudProviderLabel = cloudProvider === 'supabase'
  ? 'Supabase'
  : cloudProvider === 'dual-write'
    ? 'Firebase + Supabase'
    : 'Firebase';

export type CloudProvider = 'supabase';

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
  void environment;
  return 'supabase';
};

export const cloudProvider: CloudProvider = 'supabase';

export const isSupabaseCloudEnabled = true;

export const isSupabaseCloudEnabledFor = (environment: CloudProviderEnvironment): boolean =>
  Boolean(
    String(environment.VITE_SUPABASE_URL || '').trim()
    && String(environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY || '').trim()
    && String(environment.VITE_SUPABASE_ORGANIZATION_ID || 'renea').trim(),
  );

export const cloudProviderLabel = 'Supabase';

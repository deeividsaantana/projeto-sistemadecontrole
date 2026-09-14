export interface SupabaseClientConfig {
  url: string;
  publishableKey: string;
  organizationId: string;
}

export const resolveSupabaseClientConfig = (): SupabaseClientConfig => ({
  url: String(import.meta.env.VITE_SUPABASE_URL || '').trim(),
  publishableKey: String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      || import.meta.env.VITE_SUPABASE_ANON_KEY
      || '',
  ).trim(),
  organizationId: String(import.meta.env.VITE_SUPABASE_ORGANIZATION_ID || 'renea').trim(),
});

export const getMissingSupabaseConfigKeys = (config = resolveSupabaseClientConfig()): string[] => {
  const missing: string[] = [];
  if (!config.url) missing.push('VITE_SUPABASE_URL');
  if (!config.publishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!config.organizationId) missing.push('VITE_SUPABASE_ORGANIZATION_ID');
  return missing;
};


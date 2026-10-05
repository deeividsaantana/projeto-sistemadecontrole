import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMissingSupabaseConfigKeys, resolveSupabaseClientConfig } from './config';

let browserClient: SupabaseClient | undefined;

export const getSupabaseClient = (): SupabaseClient => {
  if (browserClient) return browserClient;

  const config = resolveSupabaseClientConfig();
  const missing = getMissingSupabaseConfigKeys(config);
  if (missing.length > 0) {
    throw new Error(`SUPABASE_CONFIG_MISSING: ${missing.join(', ')}`);
  }

  browserClient = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
};


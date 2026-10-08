/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ORGANIZATION_ID?: string;
  readonly VITE_SUPABASE_OPERATIONAL_ATTACHMENTS_BUCKET?: string;
  readonly VITE_CLOUD_PROVIDER?: 'supabase';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_ORGANIZATION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

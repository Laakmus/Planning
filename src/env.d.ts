/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db/database.types';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
    }
  }
}

interface ImportMetaEnv {
  // Serwer (sekrety — nigdy w kodzie klienta)
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly CORS_ORIGIN?: string;
  readonly MS_CLIENT_ID?: string;
  readonly MS_CLIENT_SECRET?: string;
  readonly MS_TENANT_ID?: string;
  readonly APP_ENCRYPTION_KEY?: string;
  readonly LOCK_EXPIRY_MINUTES?: string;
  // Publiczne (trafiają do bundla przeglądarki)
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_BASE_URL?: string;
  readonly PUBLIC_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


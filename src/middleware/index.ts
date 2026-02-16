import { createClient } from "@supabase/supabase-js";
import { defineMiddleware } from "astro:middleware";

import type { Database } from "../db/database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

/**
 * Middleware tworzący per-request klienta Supabase z tokenem JWT z nagłówka Authorization.
 * Jeśli nagłówek nie jest obecny, klient jest tworzony z kluczem anonowym (bez sesji).
 */
export const onRequest = defineMiddleware((context, next) => {
  const authHeader = context.request.headers.get("Authorization");

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  context.locals.supabase = supabase;
  return next();
});


import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { supabaseClient } from "../db/supabase.client";

/**
 * Astro middleware that sets up a Supabase client on every request.
 *
 * For API routes (/api/**) the middleware creates a per-request Supabase client
 * initialized with the user's JWT from the Authorization header. This ensures
 * that Row Level Security (RLS) policies are evaluated in the context of the
 * authenticated user, not the anonymous key.
 *
 * For non-API routes (pages), the global anonymous client is used as before.
 */
export const onRequest = defineMiddleware((context, next) => {
  const isApiRoute = context.url.pathname.startsWith("/api/");

  if (isApiRoute) {
    // Extract Bearer token from Authorization header
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    // Create a per-request Supabase client with the user's JWT.
    // Even if there is no token, we still create the client — the endpoint
    // (via requireAuth) will return 401 when getUser() fails.
    const supabaseUrl = import.meta.env.SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    context.locals.supabase = supabase;
  } else {
    // Non-API routes use the shared anonymous client
    context.locals.supabase = supabaseClient;
  }

  return next();
});

/**
 * Astro middleware: Supabase client injection + rate limiting + idempotency-key.
 * Dotyczy wyłącznie endpointów /api/*.
 */
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./db/database.types";

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per userId or IP)
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const MAX_RATE_BUCKETS = 50_000;

const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_WRITE = 100; // POST/PUT/PATCH/DELETE per minute
const RATE_LIMIT_READ = 1000; // GET per minute

function getRateLimit(method: string): number {
  return method === "GET" ? RATE_LIMIT_READ : RATE_LIMIT_WRITE;
}

function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Ewikacja najstarszego wpisu gdy mapa osiągnęła limit
    if (!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value;
      if (oldestKey !== undefined) rateBuckets.delete(oldestKey);
    }
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// ---------------------------------------------------------------------------
// Idempotency-Key cache (in-memory, 24h TTL)
// ---------------------------------------------------------------------------

interface CachedResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  expiresAt: number;
}

const idempotencyCache = new Map<string, CachedResponse>();
const MAX_CACHE_SIZE = 10_000;

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ---------------------------------------------------------------------------
// Periodic cleanup (every 5 min)
// ---------------------------------------------------------------------------

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanupIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
  for (const [key, cached] of idempotencyCache) {
    if (cached.expiresAt <= now) idempotencyCache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// JWT helper
// ---------------------------------------------------------------------------

/** Wyciąga user ID (sub claim) z JWT bez walidacji podpisu. */
function extractSubFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, method } = context.request;
  const pathname = new URL(url).pathname;

  // Only apply to API routes
  if (!pathname.startsWith("/api/")) {
    return next();
  }

  // Inject Supabase client with user's JWT token (enables RLS)
  const authHeader = context.request.headers.get("authorization") ?? "";
  context.locals.supabase = createClient<Database>(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  // Allow OPTIONS (CORS preflight) without rate limiting
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": import.meta.env.CORS_ORIGIN ?? "http://localhost:4321",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  cleanupIfNeeded();

  // Rate limiting — identyfikacja po user ID z JWT lub fallback na IP
  const jwtSub = authHeader ? extractSubFromJwt(authHeader) : null;
  const clientId = jwtSub ? `user:${jwtSub}` : `ip:${context.clientAddress ?? "unknown"}`;
  const rateKey = `${clientId}:${method === "GET" ? "read" : "write"}`;
  const limit = getRateLimit(method);
  const rate = checkRateLimit(rateKey, limit);

  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Zbyt wiele żądań. Spróbuj ponownie za chwilę.",
        statusCode: 429,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Idempotency-Key — only for POST methods
  if (method === "POST") {
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (idempotencyKey) {
      const cacheKey = `${clientId}:${idempotencyKey}`;
      const cached = idempotencyCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        return new Response(cached.body, {
          status: cached.status,
          headers: { ...cached.headers, "X-Idempotency-Replayed": "true" },
        });
      }

      // Execute request and cache response
      const response = await next();
      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => { responseHeaders[k] = v; });

      // Cachuj tylko odpowiedzi sukcesu — błędy (4xx/5xx) nie powinny być powtarzane.
      // Nawet z fałszywym JWT atakujący potrzebuje dokładnego klucza idempotentności,
      // a oryginalne żądanie musiało przejść weryfikację tokenu Supabase.
      if (response.status >= 200 && response.status < 300) {
        // Ewikacja najstarszego wpisu gdy cache osiągnął limit
        if (idempotencyCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = idempotencyCache.keys().next().value;
          if (oldestKey !== undefined) idempotencyCache.delete(oldestKey);
        }

        idempotencyCache.set(cacheKey, {
          status: response.status,
          body: responseBody,
          headers: responseHeaders,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }

      return new Response(responseBody, {
        status: response.status,
        headers: {
          ...responseHeaders,
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      });
    }
  }

  // Normal request — add rate limit headers to response
  const response = await next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(rate.remaining));

  return response;
});

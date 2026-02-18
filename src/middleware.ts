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
    import.meta.env.SUPABASE_KEY,
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
        "Access-Control-Allow-Origin": import.meta.env.CORS_ORIGIN ?? "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  cleanupIfNeeded();

  // Rate limiting — identify by Supabase user or fallback to IP
  const clientId = authHeader ? `auth:${authHeader.slice(-16)}` : `ip:${context.clientAddress ?? "unknown"}`;
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

      idempotencyCache.set(cacheKey, {
        status: response.status,
        body: responseBody,
        headers: responseHeaders,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      });

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

/**
 * Astro middleware: Supabase client injection + rate limiting + idempotency-key.
 * Dotyczy wyłącznie endpointów /api/*.
 *
 * Zawiera też jednorazowe uruchomienie schedulera czyszczenia anulowanych zleceń.
 */
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./db/database.types";
import { getCorsOrigin } from "./lib/api-helpers";
import { initSentry } from "./lib/sentry";
import { startCleanupScheduler } from "./lib/services/cleanup.service";

// Pomocnicza funkcja do odczytu zmiennych środowiskowych
// Astro import.meta.env nie zawsze czyta z process.env na wszystkich platformach
function getEnv(key: string): string {
  return import.meta.env[key] ?? process.env[key] ?? "";
}

// Inicjalizacja Sentry — no-op gdy brak PUBLIC_SENTRY_DSN (async, fire-and-forget)
initSentry().catch(() => {});

// ---------------------------------------------------------------------------
// Jednorazowe uruchomienie schedulera czyszczenia anulowanych zleceń (co 1h)
// Moduł middleware jest importowany raz przy starcie serwera — bezpieczne.
// ---------------------------------------------------------------------------
startCleanupScheduler();

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

/**
 * Dekodujemy JWT bez weryfikacji podpisu — używane TYLKO do rate-limitingu.
 * Auth jest weryfikowany server-side przez Supabase.
 * Ryzyko: atakujący może sfabrykować JWT z cudzym sub → wyczerpanie
 * rate limitu ofiary (429).
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function extractSubFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.sub !== "string") return null;
    // Walidacja formatu UUID — odrzucamy sfabrykowane wartości
    if (!UUID_PATTERN.test(payload.sub)) return null;
    return payload.sub;
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

  // Dla nie-API routes — stosuj tylko kompresję gzip (bez rate limiting, auth, itp.)
  if (!pathname.startsWith("/api/")) {
    const pageResponse = await next();
    return maybeCompress(context.request, pageResponse);
  }

  // Inject Supabase client with user's JWT token (enables RLS)
  const authHeader = context.request.headers.get("authorization") ?? "";
  context.locals.supabase = createClient<Database>(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  // Body size limit — ochrona przed memory exhaustion (1MB)
  const contentLength = context.request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    return new Response(
      JSON.stringify({
        error: "Payload Too Large",
        message: "Rozmiar żądania przekracza limit 1MB.",
        statusCode: 413,
      }),
      {
        status: 413,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(),
        },
      }
    );
  }

  // Allow OPTIONS (CORS preflight) without rate limiting
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": getCorsOrigin(),
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

  return maybeCompress(context.request, response);
});

// ---------------------------------------------------------------------------
// Kompresja gzip (OPT-1) — dla odpowiedzi API i stron HTML > 1KB
// Używa wbudowanego CompressionStream (Node 22+)
// ---------------------------------------------------------------------------

/** Typy Content-Type, które NIE powinny być kompresowane (binarne). */
const SKIP_COMPRESSION_TYPES = new Set([
  "application/pdf",
  "application/octet-stream",
  "message/rfc822",
]);

/** Typy Content-Type kwalifikujące się do kompresji (tekstowe). */
const COMPRESSIBLE_PREFIXES = [
  "application/json",
  "text/html",
  "text/plain",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/xml",
  "text/xml",
];

/** Minimalny rozmiar body do kompresji (1KB). */
const MIN_COMPRESS_SIZE = 1024;

/**
 * Opakowuje odpowiedź w gzip jeśli spełnione warunki:
 * 1. Klient akceptuje gzip (Accept-Encoding)
 * 2. Content-Type jest tekstowy/JSON (nie binarny)
 * 3. Body > 1KB
 * 4. Odpowiedź nie jest już skompresowana
 */
async function maybeCompress(request: Request, response: Response): Promise<Response> {
  // Sprawdź czy klient akceptuje gzip
  const acceptEncoding = request.headers.get("accept-encoding") ?? "";
  if (!acceptEncoding.includes("gzip")) {
    return response;
  }

  // Nie kompresuj jeśli już skompresowane
  if (response.headers.get("content-encoding")) {
    return response;
  }

  // Sprawdź Content-Type — kompresuj tylko tekstowe/JSON
  const contentType = response.headers.get("content-type") ?? "";
  const baseContentType = contentType.split(";")[0].trim().toLowerCase();

  if (SKIP_COMPRESSION_TYPES.has(baseContentType)) {
    return response;
  }

  const isCompressible = COMPRESSIBLE_PREFIXES.some((prefix) =>
    baseContentType.startsWith(prefix)
  );
  if (!isCompressible) {
    return response;
  }

  // Sprawdź rozmiar — nie kompresuj małych odpowiedzi
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) < MIN_COMPRESS_SIZE) {
    return response;
  }

  // Jeśli brak Content-Length, czytamy body i sprawdzamy rozmiar
  if (!contentLength) {
    const body = await response.arrayBuffer();
    if (body.byteLength < MIN_COMPRESS_SIZE) {
      // Za małe — zwróć oryginał (z Vary header)
      const headers = new Headers(response.headers);
      headers.append("Vary", "Accept-Encoding");
      return new Response(body, { status: response.status, headers });
    }

    // Kompresuj body
    const stream = new Blob([body]).stream().pipeThrough(new CompressionStream("gzip"));
    const headers = new Headers(response.headers);
    headers.set("Content-Encoding", "gzip");
    headers.delete("Content-Length");
    headers.append("Vary", "Accept-Encoding");
    return new Response(stream, { status: response.status, headers });
  }

  // Content-Length znany i >= MIN_COMPRESS_SIZE — kompresuj stream
  if (!response.body) {
    return response;
  }

  const compressedStream = response.body.pipeThrough(new CompressionStream("gzip"));
  const headers = new Headers(response.headers);
  headers.set("Content-Encoding", "gzip");
  headers.delete("Content-Length");
  headers.append("Vary", "Accept-Encoding");
  return new Response(compressedStream, { status: response.status, headers });
}

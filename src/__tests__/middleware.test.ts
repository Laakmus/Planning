/**
 * Testy middleware.ts — rate limiting, idempotency-key, JWT parsing, CORS, cleanup.
 *
 * Stub `astro:middleware` jest podłączony przez alias w vitest.config.ts.
 * `@supabase/supabase-js` jest mockowany przez vi.mock.
 * Stan wewnętrznych Map utrzymuje się między testami w ramach describe — dlatego
 * każdy test używa unikalnych kluczy (IP / idempotency-key) aby uniknąć kolizji,
 * LUB reimportuje moduł przez loadMiddleware() aby dostać czysty stan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js
// ---------------------------------------------------------------------------

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// Helpery
// ---------------------------------------------------------------------------

/** Tworzy minimalny obiekt kontekstu Astro. */
function makeContext(overrides?: Record<string, unknown>) {
  const url = (overrides?.url as URL) ?? new URL("http://localhost:4321/api/v1/orders");
  const method = (overrides?.method as string) ?? "GET";
  const headers = (overrides?.headers as Headers) ?? new Headers();
  return {
    request: new Request(url.toString(), { method, headers }),
    url,
    locals: {} as Record<string, unknown>,
    clientAddress: (overrides?.clientAddress as string) ?? "127.0.0.1",
    ...overrides,
  };
}

/**
 * Tworzy mock `next()` zwracający nową odpowiedź przy każdym wywołaniu.
 * Ważne: Response body może być consumed tylko raz — dlatego factory, nie instancja.
 */
function makeNext(responseFactory?: () => Response) {
  const factory =
    responseFactory ??
    (() =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
  return vi.fn(async () => factory());
}

/** Tworzy prawidłowy JWT (bez podpisu — middleware nie waliduje). */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

// ---------------------------------------------------------------------------
// Reimport modułu — świeże Maps i zmienne (czysty stan)
// ---------------------------------------------------------------------------

async function loadMiddleware() {
  vi.resetModules();
  // Ponownie rejestrujemy mock supabase po resetModules
  vi.doMock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({ from: vi.fn() })),
  }));

  const mod = await import("../middleware");
  // defineMiddleware (stub) zwraca surową funkcję — onRequest to async (ctx, next).
  // Używamy `as unknown as ...` bo Astro AstroSharedContext ma dużo pól których nie potrzebujemy.
  return mod.onRequest as unknown as (
    ctx: ReturnType<typeof makeContext>,
    next: ReturnType<typeof makeNext>
  ) => Promise<Response>;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("middleware — rate limiting", () => {
  let onRequest: Awaited<ReturnType<typeof loadMiddleware>>;

  beforeEach(async () => {
    onRequest = await loadMiddleware();
  });

  it("creates a new bucket on first request", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });

  it("increments count on subsequent requests", async () => {
    const next = makeNext();
    await onRequest(makeContext(), next);
    const res2 = await onRequest(makeContext(), next);
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("998");
  });

  it("resets bucket after window expires", async () => {
    const next = makeNext();
    const baseNow = Date.now();
    await onRequest(makeContext(), next); // count=1

    // Przesuwamy czas o 61s (po 60s okno wygasa)
    vi.spyOn(Date, "now").mockReturnValue(baseNow + 61_000);
    const res = await onRequest(makeContext(), next);
    // Po resecie remaining = 999 (nowy bucket, count=1)
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
    vi.restoreAllMocks();
  });

  it("evicts oldest bucket when map has many entries", async () => {
    // Testujemy pośrednio — żądania z wielu IP przechodzą bez błędu
    const next = makeNext();
    for (let i = 0; i < 10; i++) {
      await onRequest(makeContext({ clientAddress: `10.0.0.${i}` }), next);
    }
    const res = await onRequest(makeContext({ clientAddress: "10.0.0.99" }), next);
    expect(res.status).toBe(200);
  });

  it("identifies client by JWT sub when Authorization header present", async () => {
    const next = makeNext();
    const jwt = makeJwt({ sub: "user-123" });
    const headers = new Headers({ Authorization: `Bearer ${jwt}` });
    // Dwa żądania z tym samym JWT ale różnych IP — dzielą bucket
    await onRequest(makeContext({ clientAddress: "10.0.0.1", headers }), next);
    const res2 = await onRequest(makeContext({ clientAddress: "10.0.0.99", headers }), next);
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("998");
  });

  it("falls back to IP when no Authorization header", async () => {
    const next = makeNext();
    // Dwa różne IP bez JWT — osobne buckety
    await onRequest(makeContext({ clientAddress: "192.168.1.1" }), next);
    const res = await onRequest(makeContext({ clientAddress: "192.168.1.2" }), next);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });

  it("uses read limit (1000) for GET requests", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext({ method: "GET" }), next);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("1000");
  });

  it("uses write limit (100) for POST requests — reflected in remaining", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext({ method: "POST" }), next);
    // POST bez Idempotency-Key → normalna ścieżka z rate limit headers
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
  });

  it("returns 429 when rate limit exceeded", async () => {
    const next = makeNext();
    // Wysyłamy 101 POST-ów (write limit = 100)
    for (let i = 0; i < 100; i++) {
      await onRequest(makeContext({ method: "POST" }), next);
    }
    const res = await onRequest(makeContext({ method: "POST" }), next);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too Many Requests");
  });

  it("includes Retry-After header on 429", async () => {
    const next = makeNext();
    for (let i = 0; i < 100; i++) {
      await onRequest(makeContext({ method: "POST" }), next);
    }
    const res = await onRequest(makeContext({ method: "POST" }), next);
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("includes X-RateLimit-Remaining header on successful response", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext(), next);
    expect(res.headers.has("X-RateLimit-Remaining")).toBe(true);
    expect(Number(res.headers.get("X-RateLimit-Remaining"))).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Idempotency-Key
// ---------------------------------------------------------------------------

describe("middleware — idempotency-key", () => {
  let onRequest: Awaited<ReturnType<typeof loadMiddleware>>;

  beforeEach(async () => {
    onRequest = await loadMiddleware();
  });

  it("replays cached response with X-Idempotency-Replayed header", async () => {
    const next = makeNext(() =>
      new Response(JSON.stringify({ id: 1 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    const mkHeaders = () => new Headers({ "Idempotency-Key": "key-001" });

    // Pierwsze żądanie — trafia do next()
    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    expect(next).toHaveBeenCalledTimes(1);

    // Drugie żądanie — replay z cache
    const res2 = await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    expect(next).toHaveBeenCalledTimes(1); // next NIE wywołany ponownie
    expect(res2.headers.get("X-Idempotency-Replayed")).toBe("true");
    const body = await res2.json();
    expect(body.id).toBe(1);
  });

  it("does not replay after TTL expires", async () => {
    const next = makeNext(() =>
      new Response(JSON.stringify({ id: 2 }), { status: 200 })
    );
    const mkHeaders = () => new Headers({ "Idempotency-Key": "key-ttl" });

    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);

    // Przesuwamy czas o 25h (TTL = 24h)
    const baseNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(baseNow + 25 * 60 * 60 * 1000);
    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    expect(next).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("does not cache 4xx responses", async () => {
    const next = makeNext(() =>
      new Response(JSON.stringify({ error: "bad" }), { status: 400 })
    );
    const mkHeaders = () => new Headers({ "Idempotency-Key": "key-4xx" });

    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("does not cache 500 responses", async () => {
    const next = makeNext(() =>
      new Response(JSON.stringify({ error: "server" }), { status: 500 })
    );
    const mkHeaders = () => new Headers({ "Idempotency-Key": "key-500" });

    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    await onRequest(makeContext({ method: "POST", headers: mkHeaders() }), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("handles cache eviction without crashing", async () => {
    const next = makeNext(() => new Response("{}", { status: 200 }));
    for (let i = 0; i < 10; i++) {
      const headers = new Headers({ "Idempotency-Key": `evict-${i}` });
      await onRequest(makeContext({ method: "POST", headers }), next);
    }
    const headers = new Headers({ "Idempotency-Key": "evict-final" });
    const res = await onRequest(makeContext({ method: "POST", headers }), next);
    expect(res.status).toBe(200);
  });

  it("ignores Idempotency-Key on GET requests", async () => {
    const next = makeNext();
    const headers1 = new Headers({ "Idempotency-Key": "key-get" });
    await onRequest(makeContext({ method: "GET", headers: headers1 }), next);
    expect(next).toHaveBeenCalledOnce();

    const headers2 = new Headers({ "Idempotency-Key": "key-get" });
    await onRequest(makeContext({ method: "GET", headers: headers2 }), next);
    // GET nigdy nie trafia do idempotency cache — next() wywołany za każdym razem
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("passes through normally when POST has no Idempotency-Key", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext({ method: "POST" }), next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it("scopes cache per client identity (user/IP)", async () => {
    const next = makeNext(() =>
      new Response(JSON.stringify({ data: "first" }), { status: 200 })
    );
    const key = "shared-key";

    // Użytkownik A
    const jwtA = makeJwt({ sub: "user-A" });
    const headersA = new Headers({ "Idempotency-Key": key, Authorization: `Bearer ${jwtA}` });
    await onRequest(makeContext({ method: "POST", headers: headersA }), next);

    // Użytkownik B z tym samym kluczem — nie powinien dostać replay z cache A
    const nextB = makeNext(() =>
      new Response(JSON.stringify({ data: "second" }), { status: 200 })
    );
    const jwtB = makeJwt({ sub: "user-B" });
    const headersB = new Headers({ "Idempotency-Key": key, Authorization: `Bearer ${jwtB}` });
    const res = await onRequest(makeContext({ method: "POST", headers: headersB }), nextB);
    expect(nextB).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.data).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// JWT parsing — testowane pośrednio przez identyfikację klienta w rate limiting
// ---------------------------------------------------------------------------

describe("middleware — JWT parsing", () => {
  let onRequest: Awaited<ReturnType<typeof loadMiddleware>>;

  beforeEach(async () => {
    onRequest = await loadMiddleware();
  });

  it("extracts sub from valid JWT — same user shares bucket across IPs", async () => {
    const next = makeNext();
    const jwt = makeJwt({ sub: "abc-123" });
    const headers = new Headers({ Authorization: `Bearer ${jwt}` });
    await onRequest(makeContext({ clientAddress: "10.0.0.1", headers }), next);
    await onRequest(makeContext({ clientAddress: "10.0.0.50", headers }), next);
    const res = await onRequest(makeContext({ clientAddress: "10.0.0.99", headers }), next);
    // 3 żądania z tego samego usera → remaining = 997
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("997");
  });

  it("returns null for malformed token (not 3 parts) — falls back to IP", async () => {
    const next = makeNext();
    const headers = new Headers({ Authorization: "Bearer not-a-jwt" });
    await onRequest(makeContext({ clientAddress: "1.1.1.1", headers }), next);
    // Inny IP z tym samym złym JWT = osobny bucket = remaining 999
    const res = await onRequest(
      makeContext({ clientAddress: "2.2.2.2", headers: new Headers({ Authorization: "Bearer not-a-jwt" }) }),
      next
    );
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });

  it("returns null for invalid base64 payload — falls back to IP", async () => {
    const next = makeNext();
    const headers = new Headers({ Authorization: "Bearer aaa.!!!invalid!!!.ccc" });
    const res = await onRequest(makeContext({ clientAddress: "3.3.3.3", headers }), next);
    // Fallback na IP — nowy bucket
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });

  it("returns null when sub is missing from payload — falls back to IP", async () => {
    const next = makeNext();
    const header = btoa(JSON.stringify({ alg: "HS256" }));
    const body = btoa(JSON.stringify({ name: "test" }));
    const token = `${header}.${body}.sig`;
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    const res = await onRequest(makeContext({ clientAddress: "5.5.5.5", headers }), next);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });

  it("returns null when sub is not a string — falls back to IP", async () => {
    const next = makeNext();
    const header = btoa(JSON.stringify({ alg: "HS256" }));
    const body = btoa(JSON.stringify({ sub: 12345 }));
    const token = `${header}.${body}.sig`;
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    const res = await onRequest(makeContext({ clientAddress: "6.6.6.6", headers }), next);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });
});

// ---------------------------------------------------------------------------
// CORS (OPTIONS preflight)
// ---------------------------------------------------------------------------

describe("middleware — CORS", () => {
  let onRequest: Awaited<ReturnType<typeof loadMiddleware>>;

  beforeEach(async () => {
    onRequest = await loadMiddleware();
  });

  it("responds 204 to OPTIONS with correct CORS headers", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext({ method: "OPTIONS" }), next);
    expect(res.status).toBe(204);
    expect(next).not.toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Idempotency-Key");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("uses default origin http://localhost:4321 when CORS_ORIGIN not set", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext({ method: "OPTIONS" }), next);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:4321");
  });

  it("does not apply rate limiting to OPTIONS requests", async () => {
    const next = makeNext();
    // Kilka OPTIONS z tego samego IP
    for (let i = 0; i < 5; i++) {
      await onRequest(makeContext({ method: "OPTIONS" }), next);
    }
    // Normalny GET z tego samego IP powinien mieć pełny limit
    const res = await onRequest(makeContext({ method: "GET" }), next);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });
});

// ---------------------------------------------------------------------------
// Periodic cleanup
// ---------------------------------------------------------------------------

describe("middleware — periodic cleanup", () => {
  let onRequest: Awaited<ReturnType<typeof loadMiddleware>>;

  beforeEach(async () => {
    onRequest = await loadMiddleware();
  });

  it("runs cleanup and removes expired rate buckets after interval", async () => {
    const next = makeNext();
    const baseNow = Date.now();
    // Tworzymy bucket
    await onRequest(makeContext({ clientAddress: "cleanup-1" }), next);

    // Przesuwamy czas o 6 minut (> 5 min interval, > 60s bucket window)
    vi.spyOn(Date, "now").mockReturnValue(baseNow + 6 * 60 * 1000);
    // To żądanie uruchomi cleanup — stary bucket (cleanup-1, expired) zostanie usunięty
    const res = await onRequest(makeContext({ clientAddress: "cleanup-2" }), next);
    expect(res.status).toBe(200);
    vi.restoreAllMocks();
  });

  it("runs cleanup and removes expired idempotency entries after interval", async () => {
    const next = makeNext(() => new Response("{}", { status: 200 }));
    const baseNow = Date.now();
    const headers = new Headers({ "Idempotency-Key": "cleanup-idem" });
    await onRequest(makeContext({ method: "POST", headers }), next);

    // Przesuwamy czas o 25h (> 24h TTL, > 5 min interval)
    vi.spyOn(Date, "now").mockReturnValue(baseNow + 25 * 60 * 60 * 1000);

    // GET uruchomi cleanup — wpis idempotentności wygaśnie
    await onRequest(makeContext({ method: "GET" }), makeNext());

    // POST z tym samym kluczem — next() powinien być wywołany (nie replay)
    const next2 = makeNext(() => new Response("{}", { status: 200 }));
    const headers2 = new Headers({ "Idempotency-Key": "cleanup-idem" });
    await onRequest(makeContext({ method: "POST", headers: headers2 }), next2);
    expect(next2).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

describe("middleware — integration", () => {
  let onRequest: Awaited<ReturnType<typeof loadMiddleware>>;

  beforeEach(async () => {
    onRequest = await loadMiddleware();
  });

  it("bypasses middleware for non-API routes", async () => {
    const next = makeNext();
    const ctx = makeContext({ url: new URL("http://localhost:4321/orders") });
    const res = await onRequest(ctx, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    // Brak supabase injection i rate limit headers
    expect(ctx.locals.supabase).toBeUndefined();
  });

  it("injects supabase client into context.locals for API routes", async () => {
    const next = makeNext();
    const ctx = makeContext();
    await onRequest(ctx, next);
    expect(ctx.locals.supabase).toBeDefined();
  });

  it("sets X-RateLimit-Limit and X-RateLimit-Remaining on normal GET", async () => {
    const next = makeNext();
    const res = await onRequest(makeContext(), next);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("1000");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("999");
  });

  it("maintains separate read and write buckets for same client", async () => {
    const next = makeNext();
    // GET — read bucket
    const resGet = await onRequest(makeContext({ clientAddress: "same-ip", method: "GET" }), next);
    expect(resGet.headers.get("X-RateLimit-Remaining")).toBe("999");

    // POST — write bucket (osobny od read)
    const resPost = await onRequest(makeContext({ clientAddress: "same-ip", method: "POST" }), next);
    expect(resPost.headers.get("X-RateLimit-Remaining")).toBe("99");
  });

  it("full POST flow with idempotency: rate limit → next → cache → replay", async () => {
    const originalBody = JSON.stringify({ orderId: 42 });
    const next = makeNext(() =>
      new Response(originalBody, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    // Pierwsze żądanie
    const headers1 = new Headers({ "Idempotency-Key": "full-flow" });
    const res1 = await onRequest(makeContext({ method: "POST", headers: headers1 }), next);
    expect(res1.status).toBe(201);
    expect(next).toHaveBeenCalledTimes(1);

    // Drugie żądanie — replay z cache
    const headers2 = new Headers({ "Idempotency-Key": "full-flow" });
    const res2 = await onRequest(makeContext({ method: "POST", headers: headers2 }), next);
    expect(res2.status).toBe(201);
    expect(res2.headers.get("X-Idempotency-Replayed")).toBe("true");
    expect(next).toHaveBeenCalledTimes(1);
    const body = await res2.json();
    expect(body.orderId).toBe(42);
  });
});

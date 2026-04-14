/**
 * In-memory rate limiter dla endpointu POST /api/v1/auth/login.
 *
 * Limit: 10 prób / 15 min na IP. Sliding window oparty na liście timestampów.
 * Stan przechowywany w lokalnej `Map` — bez DB, bez TTL pers. (reset przy restarcie procesu).
 * Zgodnie z planem `.ai/auth-migration-plan.md` §7 — akceptowalne dla intranetu.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minut
const MAX_ATTEMPTS = 10;
const MAX_BUCKETS = 10_000; // Ochrona przed niekontrolowanym wzrostem mapy

/** Kolejka timestampów (ms) udanych/prób logowania per IP. */
const buckets = new Map<string, number[]>();

/** Usuwa przeterminowane wpisy z kolejki. */
function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  // Zakładamy chronologiczne dodawanie — odrzucamy prefix starszy niż cutoff
  let idx = 0;
  while (idx < timestamps.length && timestamps[idx] <= cutoff) {
    idx++;
  }
  return idx === 0 ? timestamps : timestamps.slice(idx);
}

/**
 * Sprawdza, czy dany klient (po IP) może wykonać kolejną próbę logowania.
 * Jeżeli tak — rejestruje próbę i zwraca `{ allowed: true }`.
 * Jeżeli nie — zwraca `{ allowed: false, retryAfterSec }`.
 *
 * @param ip — adres IP klienta (z nagłówka `x-forwarded-for` lub `context.clientAddress`)
 */
export function checkLoginRateLimit(
  ip: string
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const key = ip.trim() || "unknown";

  // Ewikacja najstarszego wpisu, gdy mapa osiągnęła twardy limit
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }

  const existing = buckets.get(key) ?? [];
  const pruned = prune(existing, now);

  if (pruned.length >= MAX_ATTEMPTS) {
    // Najstarszy wpis decyduje o momencie, w którym zwolni się slot
    const oldestTs = pruned[0];
    const retryAfterMs = Math.max(0, oldestTs + WINDOW_MS - now);
    // Zapisujemy przyciętą kolejkę, żeby nie akumulować śmieci
    buckets.set(key, pruned);
    return {
      allowed: false,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
    };
  }

  pruned.push(now);
  buckets.set(key, pruned);
  return { allowed: true };
}

/** Czyści stan rate limitera — do użycia w testach. */
export function __resetLoginRateLimit(): void {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// Rate limiter dla POST /api/v1/auth/activate
// ---------------------------------------------------------------------------
// Osobna Mapa, żeby brute-force na aktywacji nie blokował loginów i odwrotnie.
// Limit: 20 / 15 min / IP — token 32B SHA-256 jest computationally bezpieczny,
// ten limit to defense-in-depth (ochrona przed enumeration i DoS).

const ACTIVATE_WINDOW_MS = 15 * 60 * 1000;
const ACTIVATE_MAX_ATTEMPTS = 20;

const activateBuckets = new Map<string, number[]>();

export function checkActivateRateLimit(
  ip: string
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const key = ip.trim() || "unknown";

  if (!activateBuckets.has(key) && activateBuckets.size >= MAX_BUCKETS) {
    const oldest = activateBuckets.keys().next().value;
    if (oldest !== undefined) activateBuckets.delete(oldest);
  }

  const existing = activateBuckets.get(key) ?? [];
  const cutoff = now - ACTIVATE_WINDOW_MS;
  let idx = 0;
  while (idx < existing.length && existing[idx] <= cutoff) idx++;
  const pruned = idx === 0 ? existing : existing.slice(idx);

  if (pruned.length >= ACTIVATE_MAX_ATTEMPTS) {
    const oldestTs = pruned[0];
    const retryAfterMs = Math.max(0, oldestTs + ACTIVATE_WINDOW_MS - now);
    activateBuckets.set(key, pruned);
    return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  pruned.push(now);
  activateBuckets.set(key, pruned);
  return { allowed: true };
}

export function __resetActivateRateLimit(): void {
  activateBuckets.clear();
}

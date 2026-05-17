/**
 * In-memory store dla parametrów OAuth state + PKCE code_verifier.
 *
 * AUTH-MIG Faza B3 — Microsoft Graph OAuth2 Authorization Code + PKCE.
 *
 * Dlaczego in-memory (a nie DB / cookie)?
 *   - state + code_verifier żyją bardzo krótko (do 5 min między /start a /callback),
 *   - jednorazowy odczyt (consume) chroni przed replay-attack,
 *   - cookie HTTP — wymaga sameSite/secure i komplikuje cross-domain redirect,
 *   - DB — przesada dla efemerycznych danych (dodatkowa migracja, latency).
 *
 * Ograniczenie: NIE skalowalne horyzontalnie (każda instancja serwera ma własną mapę).
 * Dla single-node SSR Astro w Planning App to akceptowalne. Przy przejściu na multi-node
 * (load balancer) trzeba zmigrować do Redis lub `oauth_states` table z TTL.
 */

import { createHash, randomBytes } from "node:crypto";

/** Maksymalny czas życia rekordu state (5 min). Po tym czasie cleanup go usuwa. */
const STATE_TTL_MS = 5 * 60 * 1000;

/** Interwał cleanupu wygasłych rekordów (1 min). */
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface OAuthStateRecord {
  userId: string;
  codeVerifier: string;
  createdAt: number;
}

/** Wewnętrzna mapa state → rekord. Klucz `state` jest jednorazowy (consume usuwa). */
const stateStore = new Map<string, OAuthStateRecord>();

/**
 * Cyklicznie czyści wygasłe rekordy (TTL 5 min) — chroni przed wyciekiem pamięci
 * gdy user rozpoczął /start, ale nigdy nie wrócił do /callback.
 *
 * `unref()` pozwala Node.js zakończyć proces nawet gdy ten interval jest aktywny.
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [state, record] of stateStore.entries()) {
    if (now - record.createdAt > STATE_TTL_MS) {
      stateStore.delete(state);
    }
  }
}, CLEANUP_INTERVAL_MS);
// Astro/Node: pozwól procesowi zakończyć się mimo aktywnego interval
cleanupInterval.unref?.();

/**
 * Buduje base64url (RFC 4648 §5) — base64 bez paddingu, z bezpiecznym alfabetem URL.
 * Używane dla `code_verifier` i `code_challenge` zgodnie z PKCE (RFC 7636 §4.2).
 */
function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generuje nową parę PKCE + state i zapisuje rekord w mapie pod kluczem `state`.
 *
 * - `state` — 32 bajty hex (64 znaki) → odporne na bruteforce, jednorazowe użycie
 * - `codeVerifier` — 64 bajty base64url (≈86 znaków, mieści się w 43-128 wg RFC 7636 §4.1)
 * - `codeChallenge` — base64url(SHA-256(codeVerifier)) wg PKCE S256
 *
 * @param userId — UUID użytkownika z user_profiles (do powiązania callbacku z sesją)
 */
export function createOAuthState(userId: string): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
} {
  const state = randomBytes(32).toString("hex");
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );

  stateStore.set(state, {
    userId,
    codeVerifier,
    createdAt: Date.now(),
  });

  return { state, codeVerifier, codeChallenge };
}

/**
 * Pobiera i USUWA rekord state z mapy (one-time use → ochrona przed replay).
 * Zwraca null gdy state nie istnieje (nigdy nie powstał) lub wygasł.
 *
 * @param state — wartość parametru `state` z callbacku Microsoftu
 */
export function consumeOAuthState(state: string): {
  userId: string;
  codeVerifier: string;
} | null {
  const record = stateStore.get(state);
  if (!record) return null;

  // Usuwamy NIEZALEŻNIE od wygaśnięcia — state jest jednorazowy
  stateStore.delete(state);

  if (Date.now() - record.createdAt > STATE_TTL_MS) {
    return null;
  }

  return { userId: record.userId, codeVerifier: record.codeVerifier };
}

/**
 * Helper dla testów — czyści pełną mapę state.
 * Nie używać w produkcji.
 */
export function __resetOAuthStateStore(): void {
  stateStore.clear();
}

/**
 * Helper dla testów — zwraca aktualny rozmiar mapy.
 */
export function __getOAuthStateStoreSize(): number {
  return stateStore.size;
}

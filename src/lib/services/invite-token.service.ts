/**
 * Serwis invite tokenów dla aktywacji konta (flow admin → invite link).
 *
 * - Generuje jednorazowy token (32 bajty hex) + SHA-256 hash (do zapisu w DB).
 * - Token plaintext NIGDY nie trafia do DB — zapisujemy wyłącznie hash.
 * - TTL = 7 dni (zgodnie z `.ai/auth-migration-plan.md` §2).
 * - Buduje URL aktywacyjny `${baseUrl}/activate?token=...`.
 */

import { createHash, randomBytes } from "crypto";

/** Czas życia invite tokenu w dniach. */
export const TOKEN_TTL_DAYS = 7;

/** Długość tokenu w bajtach (hex → 64 znaki). */
const TOKEN_BYTES = 32;

/**
 * Generuje nowy invite token.
 *
 * @returns Obiekt z plaintext tokenem (pokazywany adminowi jeden raz), jego hashem (do DB)
 *          oraz datą wygaśnięcia.
 */
export function generateInviteToken(): {
  plainToken: string;
  hash: string;
  expiresAt: Date;
} {
  const plainToken = randomBytes(TOKEN_BYTES).toString("hex");
  const hash = hashInviteToken(plainToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { plainToken, hash, expiresAt };
}

/**
 * Liczy SHA-256 hex z plaintext tokenu. Używany zarówno przy zapisie (generateInviteToken),
 * jak i przy weryfikacji w `/api/v1/auth/activate`.
 *
 * @param plain — plaintext token z linku aktywacyjnego
 * @returns Hex-encoded SHA-256 (64 znaki)
 */
export function hashInviteToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/**
 * Buduje URL aktywacyjny dla invite linka.
 *
 * @param plainToken — plaintext token (NIE hash!)
 * @param publicBaseUrl — bazowy URL aplikacji (np. `http://localhost:4321`)
 */
export function buildActivateUrl(plainToken: string, publicBaseUrl: string): string {
  const base = publicBaseUrl.replace(/\/+$/, ""); // obetnij trailing slash
  const encoded = encodeURIComponent(plainToken);
  return `${base}/activate?token=${encoded}`;
}

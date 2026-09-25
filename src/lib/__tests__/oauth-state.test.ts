/**
 * Testy store state + PKCE (oauth-state.ts) — tabela ms_oauth_states.
 *
 * Pokrycie:
 * - createOAuthState zwraca unikalne state, codeVerifier, codeChallenge
 * - codeChallenge = base64url(sha256(codeVerifier))
 * - consumeOAuthState zwraca dane przy pierwszym wywołaniu, null przy drugim (one-time)
 * - consumeOAuthState(unknownState) zwraca null
 * - TTL: po 5 minutach state przepada, wygasłe rekordy są sprzątane przy create
 * - błąd DB przy insert jest propagowany
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import { createOAuthState, consumeOAuthState } from "../oauth-state";

// ---------------------------------------------------------------------------
// Helpery
// ---------------------------------------------------------------------------

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface Row {
  state: string;
  user_id: string;
  code_verifier: string;
  created_at: string;
}

/**
 * Minimalny fake klienta Supabase dla tabeli ms_oauth_states:
 * insert, delete().lt(), delete().eq().select().maybeSingle().
 */
function makeFakeAdmin(opts: { insertError?: Error } = {}) {
  const rows = new Map<string, Row>();

  const client = {
    from: (table: string) => {
      if (table !== "ms_oauth_states") throw new Error(`unexpected table ${table}`);
      return {
        insert: async (row: Row) => {
          if (opts.insertError) return { error: opts.insertError };
          rows.set(row.state, { ...row });
          return { error: null };
        },
        delete: () => ({
          lt: async (_col: string, cutoff: string) => {
            for (const [k, r] of rows) {
              if (r.created_at < cutoff) rows.delete(k);
            }
            return { error: null };
          },
          eq: (_col: string, state: string) => ({
            select: () => ({
              maybeSingle: async () => {
                const row = rows.get(state) ?? null;
                rows.delete(state);
                return { data: row, error: null };
              },
            }),
          }),
        }),
      };
    },
  };

  return { admin: client as unknown as SupabaseClient<Database>, rows };
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// createOAuthState
// ---------------------------------------------------------------------------

describe("createOAuthState", () => {
  it("returns state, codeVerifier and codeChallenge as non-empty strings", async () => {
    const { admin } = makeFakeAdmin();
    const result = await createOAuthState(admin, "user-uuid-1");

    expect(result.state.length).toBeGreaterThan(0);
    expect(result.codeVerifier.length).toBeGreaterThan(0);
    expect(result.codeChallenge.length).toBeGreaterThan(0);
  });

  it("returns unique state and codeVerifier on each call", async () => {
    const { admin } = makeFakeAdmin();
    const a = await createOAuthState(admin, "user-1");
    const b = await createOAuthState(admin, "user-1");

    expect(a.state).not.toBe(b.state);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });

  it("codeChallenge equals base64url(sha256(codeVerifier)) (PKCE S256)", async () => {
    const { admin } = makeFakeAdmin();
    const { codeVerifier, codeChallenge } = await createOAuthState(admin, "user-uuid-1");

    expect(codeChallenge).toBe(base64url(createHash("sha256").update(codeVerifier).digest()));
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("state has 64 hex chars (32 random bytes)", async () => {
    const { admin } = makeFakeAdmin();
    const { state } = await createOAuthState(admin, "user-uuid-1");

    expect(state).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stores row with user_id and code_verifier", async () => {
    const { admin, rows } = makeFakeAdmin();
    const { state, codeVerifier } = await createOAuthState(admin, "user-7");

    expect(rows.get(state)).toMatchObject({ user_id: "user-7", code_verifier: codeVerifier });
  });

  it("removes expired rows when creating a new state", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const { admin, rows } = makeFakeAdmin();
    const old = await createOAuthState(admin, "user-1");

    vi.setSystemTime(now + 5 * 60 * 1000 + 1000);
    await createOAuthState(admin, "user-2");

    expect(rows.has(old.state)).toBe(false);
    expect(rows.size).toBe(1);
  });

  it("throws when DB insert fails", async () => {
    const { admin } = makeFakeAdmin({ insertError: new Error("db down") });

    await expect(createOAuthState(admin, "user-1")).rejects.toThrow("db down");
  });
});

// ---------------------------------------------------------------------------
// consumeOAuthState
// ---------------------------------------------------------------------------

describe("consumeOAuthState", () => {
  it("returns userId and codeVerifier on first call", async () => {
    const { admin } = makeFakeAdmin();
    const { state, codeVerifier } = await createOAuthState(admin, "user-uuid-42");

    const result = await consumeOAuthState(admin, state);

    expect(result).toEqual({ userId: "user-uuid-42", codeVerifier });
  });

  it("returns null on second call (one-time use, replay protection)", async () => {
    const { admin, rows } = makeFakeAdmin();
    const { state } = await createOAuthState(admin, "user-uuid-1");

    expect(await consumeOAuthState(admin, state)).not.toBeNull();
    expect(await consumeOAuthState(admin, state)).toBeNull();
    expect(rows.size).toBe(0);
  });

  it("returns null for unknown state", async () => {
    const { admin } = makeFakeAdmin();

    expect(await consumeOAuthState(admin, "deadbeef".repeat(8))).toBeNull();
  });

  it("returns null when state has expired (TTL > 5 min)", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const { admin } = makeFakeAdmin();
    const { state } = await createOAuthState(admin, "user-uuid-1");

    vi.setSystemTime(now + 5 * 60 * 1000 + 1000);

    expect(await consumeOAuthState(admin, state)).toBeNull();
  });

  it("returns valid result within TTL (4 min 59 s)", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const { admin } = makeFakeAdmin();
    const { state } = await createOAuthState(admin, "user-uuid-1");

    vi.setSystemTime(now + 4 * 60 * 1000 + 59 * 1000);

    expect((await consumeOAuthState(admin, state))?.userId).toBe("user-uuid-1");
  });

  it("multiple distinct states do not interfere with each other", async () => {
    const { admin, rows } = makeFakeAdmin();
    const a = await createOAuthState(admin, "user-A");
    const b = await createOAuthState(admin, "user-B");

    expect((await consumeOAuthState(admin, a.state))?.userId).toBe("user-A");
    expect(rows.size).toBe(1);
    expect((await consumeOAuthState(admin, b.state))?.userId).toBe("user-B");
    expect(rows.size).toBe(0);
  });
});

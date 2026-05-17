/**
 * Testy dla in-memory store state + PKCE (oauth-state.ts).
 *
 * Pokrycie:
 * - createOAuthState zwraca unikalne state, codeVerifier, codeChallenge
 * - codeChallenge = base64url(sha256(codeVerifier))
 * - consumeOAuthState zwraca dane przy pierwszym wywołaniu, null przy drugim (one-time)
 * - consumeOAuthState(unknownState) zwraca null
 * - TTL: po 5 minutach state przepada
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

import {
  createOAuthState,
  consumeOAuthState,
  __resetOAuthStateStore,
  __getOAuthStateStoreSize,
} from "../oauth-state";

// ---------------------------------------------------------------------------
// Helper — replikacja base64url do weryfikacji codeChallenge
// ---------------------------------------------------------------------------

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  __resetOAuthStateStore();
});

afterEach(() => {
  __resetOAuthStateStore();
});

// ---------------------------------------------------------------------------
// createOAuthState
// ---------------------------------------------------------------------------

describe("createOAuthState", () => {
  it("returns state, codeVerifier and codeChallenge as non-empty strings", () => {
    // Arrange & Act
    const result = createOAuthState("user-uuid-1");

    // Assert — wszystkie trzy pola obecne i niepuste
    expect(typeof result.state).toBe("string");
    expect(result.state.length).toBeGreaterThan(0);
    expect(typeof result.codeVerifier).toBe("string");
    expect(result.codeVerifier.length).toBeGreaterThan(0);
    expect(typeof result.codeChallenge).toBe("string");
    expect(result.codeChallenge.length).toBeGreaterThan(0);
  });

  it("returns unique state on each call", () => {
    // Arrange & Act — generujemy 3 razy
    const a = createOAuthState("user-uuid-1");
    const b = createOAuthState("user-uuid-1");
    const c = createOAuthState("user-uuid-1");

    // Assert — żadne dwa state nie są takie same
    expect(a.state).not.toBe(b.state);
    expect(b.state).not.toBe(c.state);
    expect(a.state).not.toBe(c.state);
  });

  it("returns unique codeVerifier on each call", () => {
    // Arrange & Act
    const a = createOAuthState("user-1");
    const b = createOAuthState("user-2");

    // Assert
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });

  it("codeChallenge equals base64url(sha256(codeVerifier)) (PKCE S256)", () => {
    // Arrange & Act
    const { codeVerifier, codeChallenge } = createOAuthState("user-uuid-1");

    // Recompute oczekiwany challenge i porównaj
    const expected = base64url(createHash("sha256").update(codeVerifier).digest());

    // Assert
    expect(codeChallenge).toBe(expected);
  });

  it("state has 64 hex chars (32 random bytes)", () => {
    // Arrange & Act
    const { state } = createOAuthState("user-uuid-1");

    // Assert
    expect(state).toMatch(/^[a-f0-9]{64}$/);
  });

  it("codeChallenge uses base64url alphabet only (no +, /, =)", () => {
    // Arrange & Act
    const { codeChallenge } = createOAuthState("user-uuid-1");

    // Assert
    expect(codeChallenge).not.toMatch(/[+/=]/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("stores record in internal map (size grows)", () => {
    // Arrange & Act
    expect(__getOAuthStateStoreSize()).toBe(0);
    createOAuthState("user-1");
    expect(__getOAuthStateStoreSize()).toBe(1);
    createOAuthState("user-2");
    expect(__getOAuthStateStoreSize()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// consumeOAuthState
// ---------------------------------------------------------------------------

describe("consumeOAuthState", () => {
  it("returns userId and codeVerifier on first call", () => {
    // Arrange
    const { state, codeVerifier } = createOAuthState("user-uuid-42");

    // Act
    const result = consumeOAuthState(state);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-uuid-42");
    expect(result?.codeVerifier).toBe(codeVerifier);
  });

  it("returns null on second call (one-time use, replay protection)", () => {
    // Arrange
    const { state } = createOAuthState("user-uuid-1");

    // Act — pierwsze wywołanie
    const first = consumeOAuthState(state);
    // Drugie wywołanie po consume powinno zwrócić null
    const second = consumeOAuthState(state);

    // Assert
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("removes the record from the store after consumption", () => {
    // Arrange
    const { state } = createOAuthState("user-uuid-1");
    expect(__getOAuthStateStoreSize()).toBe(1);

    // Act
    consumeOAuthState(state);

    // Assert
    expect(__getOAuthStateStoreSize()).toBe(0);
  });

  it("returns null for unknown state (never created)", () => {
    // Arrange — nic nie tworzymy
    const unknownState = "deadbeef".repeat(8); // 64 znaki hex jak prawdziwy state

    // Act
    const result = consumeOAuthState(unknownState);

    // Assert
    expect(result).toBeNull();
  });

  it("returns null when state has expired (TTL > 5 min)", () => {
    // Arrange — fake timers do symulacji upływu czasu
    vi.useFakeTimers();
    const realDateNow = Date.now();
    vi.setSystemTime(realDateNow);

    const { state } = createOAuthState("user-uuid-1");

    // Act — przesuwamy zegar o 5min + 1s (powyżej TTL_MS = 5*60*1000)
    vi.setSystemTime(realDateNow + 5 * 60 * 1000 + 1000);
    const result = consumeOAuthState(state);

    // Assert
    expect(result).toBeNull();

    // Cleanup
    vi.useRealTimers();
  });

  it("returns valid result when called within TTL (4 min 59 s)", () => {
    // Arrange
    vi.useFakeTimers();
    const realDateNow = Date.now();
    vi.setSystemTime(realDateNow);

    const { state } = createOAuthState("user-uuid-1");

    // Act — pozostajemy w obrębie TTL (4 min 59 s)
    vi.setSystemTime(realDateNow + 4 * 60 * 1000 + 59 * 1000);
    const result = consumeOAuthState(state);

    // Assert — nadal valid
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-uuid-1");

    // Cleanup
    vi.useRealTimers();
  });

  it("multiple distinct states do not interfere with each other", () => {
    // Arrange
    const a = createOAuthState("user-A");
    const b = createOAuthState("user-B");

    // Act — consume A
    const resultA = consumeOAuthState(a.state);

    // Assert — A poszedł, ale B nadal istnieje
    expect(resultA?.userId).toBe("user-A");
    expect(__getOAuthStateStoreSize()).toBe(1);

    const resultB = consumeOAuthState(b.state);
    expect(resultB?.userId).toBe("user-B");
    expect(__getOAuthStateStoreSize()).toBe(0);
  });
});

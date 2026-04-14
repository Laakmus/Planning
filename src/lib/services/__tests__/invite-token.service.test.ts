/**
 * Testy invite-token.service — generowanie i weryfikacja tokenów aktywacyjnych.
 */

import { createHash } from "crypto";

import { describe, expect, it } from "vitest";

import {
  buildActivateUrl,
  generateInviteToken,
  hashInviteToken,
  TOKEN_TTL_DAYS,
} from "../invite-token.service";

describe("generateInviteToken", () => {
  it("zwraca 64-znakowy plainToken w hex (32 bajty)", () => {
    const { plainToken } = generateInviteToken();
    expect(plainToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("zwraca 64-znakowy hash SHA-256 w hex", () => {
    const { hash } = generateInviteToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hash jest zgodny z SHA-256(plainToken)", () => {
    const { plainToken, hash } = generateInviteToken();
    const expected = createHash("sha256").update(plainToken, "utf8").digest("hex");
    expect(hash).toBe(expected);
  });

  it("ustawia expiresAt na ~7 dni w przyszłość (tolerancja 1s)", () => {
    const before = Date.now();
    const { expiresAt } = generateInviteToken();
    const after = Date.now();
    const ttlMs = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttlMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + ttlMs + 1000);
  });

  it("kolejne wywołania generują różne tokeny", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a.plainToken).not.toBe(b.plainToken);
    expect(a.hash).not.toBe(b.hash);
  });

  it("TOKEN_TTL_DAYS wynosi 7 (zgodnie z auth-migration-plan.md)", () => {
    expect(TOKEN_TTL_DAYS).toBe(7);
  });
});

describe("hashInviteToken", () => {
  it("jest deterministyczny — dwa hashe tego samego plain są identyczne", () => {
    expect(hashInviteToken("abc")).toBe(hashInviteToken("abc"));
  });

  it("zwraca znany wektor SHA-256 dla 'test'", () => {
    // sha256("test") = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    expect(hashInviteToken("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    );
  });
});

describe("buildActivateUrl", () => {
  it("buduje URL z encoded tokenem", () => {
    const url = buildActivateUrl("abc123", "http://localhost:4321");
    expect(url).toBe("http://localhost:4321/activate?token=abc123");
  });

  it("trimuje trailing slash z baseUrl", () => {
    const url = buildActivateUrl("abc", "http://localhost:4321/");
    expect(url).toBe("http://localhost:4321/activate?token=abc");
  });

  it("encoduje znaki specjalne w tokenie", () => {
    const url = buildActivateUrl("a+b=c&d", "http://x");
    expect(url).toBe("http://x/activate?token=a%2Bb%3Dc%26d");
  });
});

/**
 * Testy rate-limit — sliding window per IP dla /auth/login i /auth/activate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetActivateRateLimit,
  __resetLoginRateLimit,
  checkActivateRateLimit,
  checkLoginRateLimit,
} from "../rate-limit";

describe("checkLoginRateLimit — 10 prób / 15 min / IP", () => {
  beforeEach(() => {
    __resetLoginRateLimit();
  });

  it("przepuszcza pierwsze 10 prób z tego samego IP", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkLoginRateLimit("1.1.1.1").allowed).toBe(true);
    }
  });

  it("blokuje 11. próbę z retryAfterSec > 0", () => {
    for (let i = 0; i < 10; i++) checkLoginRateLimit("1.1.1.1");
    const result = checkLoginRateLimit("1.1.1.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(15 * 60);
  });

  it("różne IP mają osobne buckety", () => {
    for (let i = 0; i < 10; i++) checkLoginRateLimit("1.1.1.1");
    expect(checkLoginRateLimit("1.1.1.1").allowed).toBe(false);
    expect(checkLoginRateLimit("2.2.2.2").allowed).toBe(true);
  });

  it("slot się zwalnia po upłynięciu okna (15 min)", () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-14T10:00:00Z");
    vi.setSystemTime(start);

    for (let i = 0; i < 10; i++) checkLoginRateLimit("1.1.1.1");
    expect(checkLoginRateLimit("1.1.1.1").allowed).toBe(false);

    // Po 15:01 — pierwsza próba już poza oknem
    vi.setSystemTime(new Date(start.getTime() + 15 * 60 * 1000 + 1000));
    expect(checkLoginRateLimit("1.1.1.1").allowed).toBe(true);

    vi.useRealTimers();
  });

  it("pusty string IP traktowany jako 'unknown'", () => {
    for (let i = 0; i < 10; i++) checkLoginRateLimit("");
    expect(checkLoginRateLimit("").allowed).toBe(false);
    expect(checkLoginRateLimit("unknown").allowed).toBe(false);
  });
});

describe("checkActivateRateLimit — 20 prób / 15 min / IP (osobny bucket)", () => {
  beforeEach(() => {
    __resetActivateRateLimit();
    __resetLoginRateLimit();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("przepuszcza pierwsze 20 prób", () => {
    for (let i = 0; i < 20; i++) {
      expect(checkActivateRateLimit("3.3.3.3").allowed).toBe(true);
    }
  });

  it("blokuje 21. próbę", () => {
    for (let i = 0; i < 20; i++) checkActivateRateLimit("3.3.3.3");
    expect(checkActivateRateLimit("3.3.3.3").allowed).toBe(false);
  });

  it("bucket aktywacji niezależny od bucket loginu", () => {
    for (let i = 0; i < 10; i++) checkLoginRateLimit("4.4.4.4");
    expect(checkLoginRateLimit("4.4.4.4").allowed).toBe(false);
    // Activate bucket nietknięty
    expect(checkActivateRateLimit("4.4.4.4").allowed).toBe(true);
  });
});

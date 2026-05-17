/**
 * Testy preferencji `EmailOpenMode` — heurystyka + persystencja w localStorage.
 *
 * Pokrycie:
 *   - get/set localStorage (round-trip + invalid value → null)
 *   - heurystyka osobiste konta MS (@outlook.com, @hotmail.com, @live.com, @msn.com → "web")
 *   - heurystyka konta firmowego (np. @odylion.com → "desktop")
 *   - brak msEmail → "web"
 *   - resolveEmailOpenMode: localStorage > heurystyka
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  getDefaultEmailOpenMode,
  getEmailOpenMode,
  resolveEmailOpenMode,
  setEmailOpenMode,
} from "../email-open-mode";

const STORAGE_KEY = "planning:email-open-mode";

beforeEach(() => {
  // Wyczyść localStorage między testami (jsdom)
  localStorage.clear();
});

describe("getEmailOpenMode / setEmailOpenMode — persystencja localStorage", () => {
  it("returns null when nothing stored", () => {
    expect(getEmailOpenMode()).toBeNull();
  });

  it("returns the stored value after set", () => {
    setEmailOpenMode("desktop");
    expect(getEmailOpenMode()).toBe("desktop");
  });

  it("supports all three modes (web/desktop/ask)", () => {
    setEmailOpenMode("web");
    expect(getEmailOpenMode()).toBe("web");
    setEmailOpenMode("ask");
    expect(getEmailOpenMode()).toBe("ask");
    setEmailOpenMode("desktop");
    expect(getEmailOpenMode()).toBe("desktop");
  });

  it("returns null when stored value is invalid (corrupted)", () => {
    // Symulujemy ręcznie zapisaną nieprawidłową wartość
    localStorage.setItem(STORAGE_KEY, "garbage");
    expect(getEmailOpenMode()).toBeNull();
  });
});

describe("getDefaultEmailOpenMode — heurystyka po typie konta MS", () => {
  it("returns 'web' for personal Microsoft accounts (@outlook.com)", () => {
    expect(getDefaultEmailOpenMode("user@outlook.com")).toBe("web");
  });

  it("returns 'web' for @hotmail.com", () => {
    expect(getDefaultEmailOpenMode("user@hotmail.com")).toBe("web");
  });

  it("returns 'web' for @live.com", () => {
    expect(getDefaultEmailOpenMode("user@live.com")).toBe("web");
  });

  it("returns 'web' for @msn.com", () => {
    expect(getDefaultEmailOpenMode("user@msn.com")).toBe("web");
  });

  it("returns 'desktop' for corporate domains (e.g. @odylion.com)", () => {
    expect(getDefaultEmailOpenMode("user@odylion.com")).toBe("desktop");
  });

  it("returns 'desktop' for other corporate domains", () => {
    expect(getDefaultEmailOpenMode("admin@example.com")).toBe("desktop");
    expect(getDefaultEmailOpenMode("foo@bar.io")).toBe("desktop");
  });

  it("returns 'web' when msEmail is null (no connection)", () => {
    expect(getDefaultEmailOpenMode(null)).toBe("web");
  });

  it("is case-insensitive for the domain match", () => {
    expect(getDefaultEmailOpenMode("User@OUTLOOK.COM")).toBe("web");
    expect(getDefaultEmailOpenMode("Foo@Hotmail.COM")).toBe("web");
  });
});

describe("resolveEmailOpenMode — localStorage > heurystyka", () => {
  it("returns stored value when present (overrides heuristics)", () => {
    setEmailOpenMode("desktop");
    // Mimo, że heurystyka dla @outlook.com to "web" — preferencja usera wygrywa
    expect(resolveEmailOpenMode("user@outlook.com")).toBe("desktop");
  });

  it("returns heuristic value when nothing stored — personal account", () => {
    expect(resolveEmailOpenMode("user@hotmail.com")).toBe("web");
  });

  it("returns heuristic value when nothing stored — corporate account", () => {
    expect(resolveEmailOpenMode("user@company.pl")).toBe("desktop");
  });

  it("returns 'web' when nothing stored and no msEmail", () => {
    expect(resolveEmailOpenMode(null)).toBe("web");
  });
});

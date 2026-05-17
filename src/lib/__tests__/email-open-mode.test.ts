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

describe("getDefaultEmailOpenMode — zawsze 'web' (bezpieczny default)", () => {
  // Po decyzji UX: default ZAWSZE "web", niezależnie od typu konta MS.
  // Powód: Outlook Web działa od razu dla każdego, Outlook Desktop wymaga
  // konfiguracji przeglądarki ("Always open .eml") — to świadomy wybór usera.
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

  it("returns 'web' for corporate domains (e.g. @odylion.com)", () => {
    expect(getDefaultEmailOpenMode("user@odylion.com")).toBe("web");
  });

  it("returns 'web' for any corporate domain", () => {
    expect(getDefaultEmailOpenMode("admin@example.com")).toBe("web");
    expect(getDefaultEmailOpenMode("foo@bar.io")).toBe("web");
  });

  it("returns 'web' when msEmail is null (no connection)", () => {
    expect(getDefaultEmailOpenMode(null)).toBe("web");
  });

  it("is case-insensitive for the domain match", () => {
    expect(getDefaultEmailOpenMode("User@OUTLOOK.COM")).toBe("web");
    expect(getDefaultEmailOpenMode("Foo@Hotmail.COM")).toBe("web");
  });
});

describe("resolveEmailOpenMode — localStorage > default", () => {
  it("returns stored value when present (overrides default)", () => {
    setEmailOpenMode("desktop");
    expect(resolveEmailOpenMode("user@outlook.com")).toBe("desktop");
  });

  it("returns 'web' default when nothing stored — personal account", () => {
    expect(resolveEmailOpenMode("user@hotmail.com")).toBe("web");
  });

  it("returns 'web' default when nothing stored — corporate account", () => {
    expect(resolveEmailOpenMode("user@company.pl")).toBe("web");
  });

  it("returns 'web' when nothing stored and no msEmail", () => {
    expect(resolveEmailOpenMode(null)).toBe("web");
  });
});

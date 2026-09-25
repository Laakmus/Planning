/**
 * Testy getEnv (lib/env.ts) oraz fabryk klientów Supabase (lib/supabase-admin.ts).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string) => ({ url, key })),
}));

import { getEnv } from "../env";
import {
  createAdminSupabaseClient,
  createAnonSupabaseClient,
  tryCreateAdminSupabaseClient,
} from "../supabase-admin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getEnv", () => {
  it("zwraca wartość ustawionej zmiennej", () => {
    vi.stubEnv("PLANNING_TEST_VAR", "abc");
    expect(getEnv("PLANNING_TEST_VAR")).toBe("abc");
  });

  it("zwraca undefined dla nieustawionej zmiennej", () => {
    expect(getEnv("PLANNING_TEST_MISSING_VAR")).toBeUndefined();
  });

  it("traktuje pusty string jak brak wartości", () => {
    vi.stubEnv("PLANNING_TEST_EMPTY", "");
    expect(getEnv("PLANNING_TEST_EMPTY")).toBeUndefined();
  });
});

describe("supabase-admin", () => {
  it("createAdminSupabaseClient używa SUPABASE_URL i SERVICE_ROLE_KEY", () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    expect(createAdminSupabaseClient()).toMatchObject({ url: "http://db.test", key: "svc" });
  });

  it("createAdminSupabaseClient rzuca przy braku konfiguracji", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => createAdminSupabaseClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("tryCreateAdminSupabaseClient zwraca null przy braku konfiguracji", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(tryCreateAdminSupabaseClient()).toBeNull();
  });

  it("createAnonSupabaseClient używa SUPABASE_ANON_KEY", () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    expect(createAnonSupabaseClient()).toMatchObject({ key: "anon" });
  });
});

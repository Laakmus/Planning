/**
 * Testy requireAdmin — guard dla endpointów /admin/*.
 * Zwraca `AdminContext | Response` (bez throw).
 */

import type { APIContext } from "astro";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock `getCurrentUser` z auth.service — kontrolujemy zachowanie per test
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/services/auth.service", () => ({
  getCurrentUser: (supabase: unknown) => mockGetCurrentUser(supabase),
}));

import { requireAdmin } from "../requireAdmin";

function makeContext(supabase: unknown): APIContext {
  return {
    locals: { supabase },
  } as unknown as APIContext;
}

describe("requireAdmin", () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset();
  });

  it("zwraca AdminContext dla zalogowanego ADMIN", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "admin-uuid-1",
      email: "admin@test.pl",
      username: "admin",
      fullName: "Admin",
      phone: null,
      role: "ADMIN",
      locationId: null,
      isActive: true,
    });

    const result = await requireAdmin(makeContext({}));
    expect(result).toEqual({ userId: "admin-uuid-1", role: "ADMIN" });
  });

  it("zwraca 500 gdy brak klienta Supabase w locals", async () => {
    const result = await requireAdmin(makeContext(undefined));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);
  });

  it("zwraca 401 gdy getCurrentUser zwraca null (brak sesji)", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await requireAdmin(makeContext({}));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("zwraca 403 dla roli PLANNER", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-uuid-2",
      email: "planner@test.pl",
      username: "planner",
      fullName: null,
      phone: null,
      role: "PLANNER",
      locationId: null,
      isActive: true,
    });

    const result = await requireAdmin(makeContext({}));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("zwraca 403 dla roli READ_ONLY", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-uuid-3",
      email: "ro@test.pl",
      username: "ro",
      fullName: null,
      phone: null,
      role: "READ_ONLY",
      locationId: null,
      isActive: true,
    });

    const result = await requireAdmin(makeContext({}));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });
});

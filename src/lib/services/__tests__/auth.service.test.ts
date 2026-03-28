/**
 * Tests for getCurrentUser (src/lib/services/auth.service.ts).
 *
 * Covers:
 * - Returns mapped AuthMeDto when session + user_profiles record are valid
 * - Returns null when supabase.auth.getUser() returns an error
 * - Returns null when supabase.auth.getUser() returns no user
 * - Returns null when user_profiles query returns no record (maybeSingle = null)
 * - Returns null when user_profiles query returns an error
 * - Correctly maps snake_case DB row to camelCase AuthMeDto
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { getCurrentUser } from "../auth.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockedSupabase = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

/**
 * Builds a minimal Supabase mock.
 *
 * @param authUser  - value returned by auth.getUser() as `data.user`
 * @param authError - error returned by auth.getUser()
 * @param profile   - value returned by the user_profiles query as `data`
 * @param profileError - error returned by the user_profiles query
 */
function buildSupabaseMock(
  authUser: object | null,
  authError: object | null,
  profile: object | null,
  profileError: object | null,
): SupabaseClient<Database> {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: profileError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },
    from,
  } as unknown as SupabaseClient<Database>;
}

const VALID_USER = { id: "user-uuid-1" };
const VALID_PROFILE = {
  id: "user-uuid-1",
  email: "jan@example.com",
  full_name: "Jan Kowalski",
  phone: "+48123456789",
  role: "PLANNER",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getCurrentUser — happy path", () => {
  it("returns AuthMeDto when session and profile are valid", async () => {
    const supabase = buildSupabaseMock(VALID_USER, null, VALID_PROFILE, null);

    const result = await getCurrentUser(supabase);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      id: "user-uuid-1",
      email: "jan@example.com",
      fullName: "Jan Kowalski",
      phone: "+48123456789",
      role: "PLANNER",
      locationId: null,
    });
  });

  it("maps null full_name and phone correctly", async () => {
    const profile = { ...VALID_PROFILE, full_name: null, phone: null };
    const supabase = buildSupabaseMock(VALID_USER, null, profile, null);

    const result = await getCurrentUser(supabase);

    expect(result?.fullName).toBeNull();
    expect(result?.phone).toBeNull();
  });

  it("maps all supported roles correctly", async () => {
    const roles = ["ADMIN", "PLANNER", "READ_ONLY"] as const;

    for (const role of roles) {
      const supabase = buildSupabaseMock(
        VALID_USER,
        null,
        { ...VALID_PROFILE, role },
        null,
      );
      const result = await getCurrentUser(supabase);
      expect(result?.role).toBe(role);
    }
  });
});

describe("getCurrentUser — auth.getUser failures", () => {
  it("returns null when auth.getUser returns an error", async () => {
    const supabase = buildSupabaseMock(
      null,
      { message: "JWT expired", status: 401 },
      null,
      null,
    );

    const result = await getCurrentUser(supabase);
    expect(result).toBeNull();
  });

  it("returns null when auth.getUser returns no user (no active session)", async () => {
    const supabase = buildSupabaseMock(null, null, null, null);

    const result = await getCurrentUser(supabase);
    expect(result).toBeNull();
  });
});

describe("getCurrentUser — user_profiles query failures", () => {
  it("returns null when user_profiles record does not exist (maybeSingle = null)", async () => {
    const supabase = buildSupabaseMock(VALID_USER, null, null, null);

    const result = await getCurrentUser(supabase);
    expect(result).toBeNull();
  });

  it("returns null when user_profiles query returns an error", async () => {
    const supabase = buildSupabaseMock(
      VALID_USER,
      null,
      null,
      { message: "DB error", code: "PGRST116" },
    );

    const result = await getCurrentUser(supabase);
    expect(result).toBeNull();
  });
});

describe("getCurrentUser — query construction", () => {
  it("queries user_profiles with the authenticated user id", async () => {
    const supabase = buildSupabaseMock(VALID_USER, null, VALID_PROFILE, null);

    await getCurrentUser(supabase);

    expect(supabase.from).toHaveBeenCalledWith("user_profiles");

    // Verify .eq was called with "id" and the user's UUID
    const selectResult = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    const eqMock = selectResult.select.mock.results[0].value.eq as ReturnType<typeof vi.fn>;
    expect(eqMock).toHaveBeenCalledWith("id", "user-uuid-1");
  });
});

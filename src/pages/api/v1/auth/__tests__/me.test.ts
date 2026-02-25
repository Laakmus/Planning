/**
 * Tests for GET /api/v1/auth/me (src/pages/api/v1/auth/me.ts).
 *
 * Strategy: import the GET handler directly and call it with mocked `locals`.
 * This tests the route handler in isolation — no real HTTP, no real Supabase.
 *
 * We mock the imported helpers so we can control auth outcomes without
 * coupling the test to the Supabase client implementation.
 *
 * Covers:
 * - Returns 500 when locals.supabase is missing (misconfigured server)
 * - Returns 401 when getAuthenticatedUser returns a 401 Response
 * - Returns 200 + AuthMeDto when authentication succeeds
 * - Response body is valid JSON and matches AuthMeDto shape
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthMeDto } from "@/types";

// ---------------------------------------------------------------------------
// Mock api-helpers.
//
// me.ts imports via relative path "../../../../lib/api-helpers".
// vitest.config.ts defines alias @/ → ./src/, so both paths resolve to the
// same physical file. vi.mock with the alias works because vitest normalises
// module ids after alias resolution before deduplication.
// ---------------------------------------------------------------------------

// vitest resolves aliases before module deduplication, so mocking "@/lib/api-helpers"
// covers both the alias form and the relative path used inside me.ts.
vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
}));

// Static imports are hoisted AFTER vi.mock by vitest's transform.
import { GET } from "../me";
import * as apiHelpers from "@/lib/api-helpers";

// Typed accessors — cast to Mocked<T> compatible interface
const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocals(supabase?: object) {
  return { supabase } as unknown as Parameters<typeof GET>[0]["locals"];
}

function makeContext(locals: ReturnType<typeof makeLocals>): Parameters<typeof GET>[0] {
  return {
    locals,
    request: new Request("http://localhost:4321/api/v1/auth/me"),
    params: {},
    url: new URL("http://localhost:4321/api/v1/auth/me"),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as Parameters<typeof GET>[0]["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: "/api/v1/auth/me",
    originPathname: "/api/v1/auth/me",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as Parameters<typeof GET>[0];
}

const MOCK_PROFILE: AuthMeDto = {
  id: "user-uuid-1",
  email: "jan@example.com",
  fullName: "Jan Kowalski",
  phone: null,
  role: "PLANNER",
};

function make401Response() {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: "Brak sesji lub nieważny token. Zaloguj się ponownie.",
      statusCode: 401,
    }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

function make200Response(profile: AuthMeDto) {
  return new Response(JSON.stringify(profile), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function make500Response() {
  return new Response(
    JSON.stringify({
      error: "Internal Server Error",
      message: "Konfiguracja serwera: brak klienta Supabase.",
      statusCode: 500,
    }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: errorResponse and jsonResponse return real-ish Response objects
  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string) =>
      new Response(JSON.stringify({ error, message, statusCode }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }),
  );
  mockJsonResponse.mockImplementation(
    (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/auth/me — missing supabase client", () => {
  it("returns 500 when locals.supabase is undefined", async () => {
    const expected = make500Response();
    mockErrorResponse.mockReturnValueOnce(expected);

    const locals = makeLocals(undefined);
    const ctx = makeContext(locals);

    const response = await GET(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String),
    );
    expect(response.status).toBe(500);
  });
});

describe("GET /api/v1/auth/me — unauthorized", () => {
  it("returns 401 when getAuthenticatedUser returns a 401 Response", async () => {
    const unauthorizedResponse = make401Response();
    mockGetAuthenticatedUser.mockResolvedValue(unauthorizedResponse);

    const ctx = makeContext(makeLocals({ from: vi.fn() }));
    const response = await GET(ctx);

    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.statusCode).toBe(401);
  });

  it("does NOT call jsonResponse when auth fails", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(make401Response());

    const ctx = makeContext(makeLocals({ from: vi.fn() }));
    await GET(ctx);

    expect(mockJsonResponse).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/auth/me — success", () => {
  it("returns 200 with AuthMeDto when authentication succeeds", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);

    const expected = make200Response(MOCK_PROFILE);
    mockJsonResponse.mockReturnValueOnce(expected);

    const ctx = makeContext(makeLocals({ from: vi.fn() }));
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(MOCK_PROFILE);
  });

  it("calls jsonResponse with the user profile and status 200", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    mockJsonResponse.mockReturnValueOnce(make200Response(MOCK_PROFILE));

    const ctx = makeContext(makeLocals({ from: vi.fn() }));
    await GET(ctx);

    expect(mockJsonResponse).toHaveBeenCalledWith(MOCK_PROFILE, 200);
  });

  it("passes the supabase client from locals to getAuthenticatedUser", async () => {
    const fakeSupabase = { from: vi.fn() };
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    mockJsonResponse.mockReturnValueOnce(make200Response(MOCK_PROFILE));

    const ctx = makeContext(makeLocals(fakeSupabase));
    await GET(ctx);

    expect(mockGetAuthenticatedUser).toHaveBeenCalledWith(fakeSupabase);
  });
});

describe("GET /api/v1/auth/me — response shape", () => {
  it("returned profile contains all required AuthMeDto fields", async () => {
    const fullProfile: AuthMeDto = {
      id: "abc-123",
      email: "admin@example.com",
      fullName: "Admin User",
      phone: "+48100200300",
      role: "ADMIN",
    };
    mockGetAuthenticatedUser.mockResolvedValue(fullProfile);
    mockJsonResponse.mockReturnValueOnce(make200Response(fullProfile));

    const ctx = makeContext(makeLocals({ from: vi.fn() }));
    const response = await GET(ctx);
    const body = (await response.json()) as AuthMeDto;

    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("email");
    expect(body).toHaveProperty("fullName");
    expect(body).toHaveProperty("phone");
    expect(body).toHaveProperty("role");
    expect(["ADMIN", "PLANNER", "READ_ONLY"]).toContain(body.role);
  });
});

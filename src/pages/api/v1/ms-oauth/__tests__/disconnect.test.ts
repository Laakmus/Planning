/**
 * Testy dla POST /api/v1/ms-oauth/disconnect.
 *
 * Pokrycie:
 * - 401 brak auth
 * - 403 READ_ONLY (requireWriteAccess)
 * - 204 happy path (deleteTokens wywołane z user.id)
 * - 500 gdy deleteTokens rzuca
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
  requireWriteAccess: vi.fn(),
}));

vi.mock("@/lib/services/ms-graph.service", () => ({
  deleteTokens: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

import { POST } from "../disconnect";
import * as apiHelpers from "@/lib/api-helpers";
import * as msGraph from "@/lib/services/ms-graph.service";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockDeleteTokens = vi.mocked(msGraph.deleteTokens);

const MOCK_USER = {
  id: "user-uuid-1",
  email: "u@test.pl",
  fullName: "User",
  phone: null,
  role: "PLANNER" as const,
  username: "u",
  isActive: true,
  locationId: null,
};

type AnyAPIContext = Parameters<typeof POST>[0];

function makeContext(): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request("http://localhost:4321/api/v1/ms-oauth/disconnect", {
      method: "POST",
    }),
    params: {},
    url: new URL("http://localhost:4321/api/v1/ms-oauth/disconnect"),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as AnyAPIContext["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: "/api/v1/ms-oauth/disconnect",
    originPathname: "/api/v1/ms-oauth/disconnect",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

beforeEach(() => {
  // createAdminSupabaseClient wymaga konfiguracji (createClient jest zamockowany)
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.clearAllMocks();

  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string) =>
      new Response(JSON.stringify({ error, message, statusCode }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      })
  );

  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockDeleteTokens.mockResolvedValue(undefined);
});

describe("POST /api/v1/ms-oauth/disconnect", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(401);
    expect(mockDeleteTokens).not.toHaveBeenCalled();
  });

  it("returns 403 for READ_ONLY user (requireWriteAccess fails)", async () => {
    // Arrange
    mockRequireWriteAccess.mockReturnValue(
      new Response(null, { status: 403 }) as never
    );

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(403);
    expect(mockDeleteTokens).not.toHaveBeenCalled();
  });

  it("returns 204 on happy path and calls deleteTokens with user id", async () => {
    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(204);
    expect(mockDeleteTokens).toHaveBeenCalledWith(expect.anything(), MOCK_USER.id);
  });

  it("returns 500 when deleteTokens throws", async () => {
    // Arrange
    mockDeleteTokens.mockRejectedValue(new Error("DB error"));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
  });
});

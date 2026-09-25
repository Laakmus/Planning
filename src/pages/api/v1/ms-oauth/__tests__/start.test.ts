/**
 * Testy dla GET /api/v1/ms-oauth/start.
 *
 * Pokrycie:
 * - 401 gdy brak autentykacji
 * - 302 z poprawnym Location (MS authorize URL) gdy zalogowany
 * - state + codeVerifier zostały zapisane w store (po stronie createOAuthState)
 * - 500 gdy createOAuthState rzuca
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
  COMMON_HEADERS: { "Cache-Control": "no-store" },
}));

vi.mock("@/lib/oauth-state", () => ({
  createOAuthState: vi.fn(),
}));

vi.mock("@/lib/services/ms-graph.service", () => ({
  buildAuthorizationUrl: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));

import { GET } from "../start";
import * as apiHelpers from "@/lib/api-helpers";
import * as oauthState from "@/lib/oauth-state";
import * as msGraphService from "@/lib/services/ms-graph.service";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockCreateOAuthState = vi.mocked(oauthState.createOAuthState);
const mockBuildAuthorizationUrl = vi.mocked(msGraphService.buildAuthorizationUrl);

const MOCK_USER = {
  id: "user-uuid-1",
  email: "planner@test.pl",
  fullName: "Planner",
  phone: null,
  role: "PLANNER" as const,
  username: "planner",
  isActive: true,
  locationId: null,
};

type AnyAPIContext = Parameters<typeof GET>[0];

function makeContext(): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request("http://localhost:4321/api/v1/ms-oauth/start"),
    params: {},
    url: new URL("http://localhost:4321/api/v1/ms-oauth/start"),
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
    routePattern: "/api/v1/ms-oauth/start",
    originPathname: "/api/v1/ms-oauth/start",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string, details?: unknown) =>
      new Response(JSON.stringify({ error, message, statusCode, details }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      })
  );

  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockCreateOAuthState.mockResolvedValue({
    state: "state-abc",
    codeVerifier: "verifier-xyz",
    codeChallenge: "challenge-123",
  });
  mockBuildAuthorizationUrl.mockReturnValue("https://login.microsoftonline.com/test/authorize?x=1");
});

describe("GET /api/v1/ms-oauth/start", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(401);
    expect(mockCreateOAuthState).not.toHaveBeenCalled();
  });

  it("returns 200 JSON with authorizeUrl", async () => {
    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      authorizeUrl: "https://login.microsoftonline.com/test/authorize?x=1",
    });
  });

  it("calls createOAuthState with authenticated user id", async () => {
    // Act
    await GET(makeContext());

    // Assert
    expect(mockCreateOAuthState).toHaveBeenCalledWith(expect.anything(), MOCK_USER.id);
  });

  it("passes state, codeChallenge and userId to buildAuthorizationUrl", async () => {
    // Act
    await GET(makeContext());

    // Assert
    expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(
      "state-abc",
      "challenge-123",
      MOCK_USER.id
    );
  });

  it("returns 500 when createOAuthState throws", async () => {
    // Arrange
    mockCreateOAuthState.mockRejectedValue(new Error("boom"));

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
    expect(response.status).toBe(500);
  });

  it("allows READ_ONLY user to start OAuth flow", async () => {
    // Arrange — READ_ONLY MUSI móc podłączać własne konto MS (każda rola)
    mockGetAuth.mockResolvedValue({ ...MOCK_USER, role: "READ_ONLY" });

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(200);
  });
});

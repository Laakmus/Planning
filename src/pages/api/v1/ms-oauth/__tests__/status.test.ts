/**
 * Testy dla GET /api/v1/ms-oauth/status.
 *
 * Pokrycie:
 * - 401 brak auth
 * - 200 connected:false gdy brak rekordu w DB
 * - 200 connected:true gdy rekord istnieje (z msEmail, expiresAt, connectedAt)
 * - 500 gdy SELECT zwróci błąd
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
}));

// Mock createClient — wraca admin client z .from chainem
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from "../status";
import * as apiHelpers from "@/lib/api-helpers";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);

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

type AnyAPIContext = Parameters<typeof GET>[0];

function makeContext(): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request("http://localhost:4321/api/v1/ms-oauth/status"),
    params: {},
    url: new URL("http://localhost:4321/api/v1/ms-oauth/status"),
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
    routePattern: "/api/v1/ms-oauth/status",
    originPathname: "/api/v1/ms-oauth/status",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string) =>
      new Response(JSON.stringify({ error, message, statusCode }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      })
  );
  mockJsonResponse.mockImplementation(
    (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      })
  );

  mockGetAuth.mockResolvedValue(MOCK_USER);
});

describe("GET /api/v1/ms-oauth/status", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(401);
  });

  it("returns 200 with connected:false when no row exists", async () => {
    // Arrange
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(200);
    expect(mockJsonResponse).toHaveBeenCalledWith({
      connected: false,
      msEmail: null,
      expiresAt: null,
      connectedAt: null,
    });
  });

  it("returns 200 with connected:true and metadata when row exists", async () => {
    // Arrange
    const created = "2026-04-01T10:00:00Z";
    const expires = "2026-05-01T10:00:00Z";
    mockMaybeSingle.mockResolvedValue({
      data: {
        ms_email: "u@contoso.com",
        expires_at: expires,
        created_at: created,
      },
      error: null,
    });

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(200);
    expect(mockJsonResponse).toHaveBeenCalledWith({
      connected: true,
      msEmail: "u@contoso.com",
      expiresAt: expires,
      connectedAt: created,
    });
  });

  it("returns 500 when SELECT returns error", async () => {
    // Arrange
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    // Act
    const response = await GET(makeContext());

    // Assert
    expect(response.status).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
  });

  it("queries ms_oauth_tokens with user.id filter", async () => {
    // Arrange
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Act
    await GET(makeContext());

    // Assert
    expect(mockFrom).toHaveBeenCalledWith("ms_oauth_tokens");
    expect(mockEq).toHaveBeenCalledWith("user_id", MOCK_USER.id);
  });
});

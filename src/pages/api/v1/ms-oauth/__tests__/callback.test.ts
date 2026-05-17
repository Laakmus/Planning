/**
 * Testy dla GET /api/v1/ms-oauth/callback.
 *
 * Pokrycie:
 * - error variant (Microsoft odpowiedział z error_description) → 302 z ?ms_error=1
 * - invalid state (consumeOAuthState zwraca null) → 400
 * - happy path (success) → 302 do /settings/email?ms_connected=1 + saveTokens called
 * - exchangeCodeForTokens fail → 302 z ?ms_error=1 (graceful)
 * - schema fail (brak code i error) → 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  COMMON_HEADERS: { "Cache-Control": "no-store" },
  errorResponse: vi.fn(),
  logError: vi.fn(),
  parseQueryParams: vi.fn(),
}));

vi.mock("@/lib/oauth-state", () => ({
  consumeOAuthState: vi.fn(),
}));

vi.mock("@/lib/services/ms-graph.service", () => ({
  exchangeCodeForTokens: vi.fn(),
  getMsUser: vi.fn(),
  saveTokens: vi.fn(),
}));

vi.mock("@/lib/validators/ms-oauth.validator", () => ({
  oauthCallbackQuerySchema: {
    safeParse: vi.fn(),
  },
}));

// Mock createClient (Supabase admin client)
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn(), rpc: vi.fn() })),
}));

import { GET } from "../callback";
import * as apiHelpers from "@/lib/api-helpers";
import * as oauthState from "@/lib/oauth-state";
import * as msGraph from "@/lib/services/ms-graph.service";
import * as validator from "@/lib/validators/ms-oauth.validator";

const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockParseQueryParams = vi.mocked(apiHelpers.parseQueryParams);
const mockConsumeOAuthState = vi.mocked(oauthState.consumeOAuthState);
const mockExchange = vi.mocked(msGraph.exchangeCodeForTokens);
const mockGetMsUser = vi.mocked(msGraph.getMsUser);
const mockSaveTokens = vi.mocked(msGraph.saveTokens);
const mockSchema = validator.oauthCallbackQuerySchema as unknown as {
  safeParse: ReturnType<typeof vi.fn>;
};

type AnyAPIContext = Parameters<typeof GET>[0];

function makeContext(query = ""): AnyAPIContext {
  const url = `http://localhost:4321/api/v1/ms-oauth/callback${query}`;
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request(url),
    params: {},
    url: new URL(url),
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
    routePattern: "/api/v1/ms-oauth/callback",
    originPathname: "/api/v1/ms-oauth/callback",
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

  mockParseQueryParams.mockReturnValue({});
});

describe("GET /api/v1/ms-oauth/callback", () => {
  it("returns 400 when query schema validation fails (missing code AND error)", async () => {
    // Arrange
    mockSchema.safeParse.mockReturnValue({ success: false, error: {} });

    // Act
    const response = await GET(makeContext("?invalid=1"));

    // Assert
    expect(response.status).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
  });

  it("returns 302 with ms_error=1 when Microsoft returned error (user denied consent)", async () => {
    // Arrange
    mockSchema.safeParse.mockReturnValue({
      success: true,
      data: {
        error: "access_denied",
        error_description: "User denied consent",
        state: "some-state",
      },
    });

    // Act
    const response = await GET(makeContext("?error=access_denied"));

    // Assert
    expect(response.status).toBe(302);
    const location = response.headers.get("Location") || "";
    expect(location).toContain("/settings/email?");
    expect(location).toContain("ms_error=1");
    expect(location).toContain("ms_error_description=");
    // Nie powinno być zapisu tokenów
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  it("returns 400 when consumeOAuthState returns null (invalid/expired state)", async () => {
    // Arrange
    mockSchema.safeParse.mockReturnValue({
      success: true,
      data: { code: "abc", state: "unknown" },
    });
    mockConsumeOAuthState.mockReturnValue(null);

    // Act
    const response = await GET(makeContext("?code=abc&state=unknown"));

    // Assert
    expect(response.status).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.stringMatching(/wygasła|nieprawidłowa/i),
      undefined
    );
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("happy path: exchanges code, fetches /me, saves tokens, redirects with ms_connected=1", async () => {
    // Arrange
    mockSchema.safeParse.mockReturnValue({
      success: true,
      data: { code: "the-code", state: "the-state" },
    });
    mockConsumeOAuthState.mockReturnValue({
      userId: "user-1",
      codeVerifier: "verifier-1",
    });
    mockExchange.mockResolvedValue({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "x",
    });
    mockGetMsUser.mockResolvedValue({
      id: "ms-1",
      mail: "u@c.com",
      userPrincipalName: "u@c.com",
      displayName: "User",
    });
    mockSaveTokens.mockResolvedValue(undefined);

    // Act
    const response = await GET(makeContext("?code=the-code&state=the-state"));

    // Assert
    expect(response.status).toBe(302);
    expect(response.headers.get("Location") || "").toContain(
      "/settings/email?ms_connected=1"
    );

    expect(mockExchange).toHaveBeenCalledWith("the-code", "verifier-1");
    expect(mockGetMsUser).toHaveBeenCalledWith("AT");
    expect(mockSaveTokens).toHaveBeenCalledOnce();
    const [, userId, tokens, msUser] = mockSaveTokens.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(tokens.access_token).toBe("AT");
    expect(msUser.id).toBe("ms-1");
  });

  it("returns 302 with ms_error=1 when exchange throws", async () => {
    // Arrange
    mockSchema.safeParse.mockReturnValue({
      success: true,
      data: { code: "bad-code", state: "the-state" },
    });
    mockConsumeOAuthState.mockReturnValue({
      userId: "user-1",
      codeVerifier: "verifier-1",
    });
    mockExchange.mockRejectedValue(new Error("Microsoft rejected"));

    // Act
    const response = await GET(makeContext("?code=bad-code&state=the-state"));

    // Assert
    expect(response.status).toBe(302);
    const location = response.headers.get("Location") || "";
    expect(location).toContain("ms_error=1");
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  it("returns 302 with ms_error=1 when saveTokens throws", async () => {
    // Arrange
    mockSchema.safeParse.mockReturnValue({
      success: true,
      data: { code: "the-code", state: "the-state" },
    });
    mockConsumeOAuthState.mockReturnValue({
      userId: "user-1",
      codeVerifier: "verifier-1",
    });
    mockExchange.mockResolvedValue({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "x",
    });
    mockGetMsUser.mockResolvedValue({
      id: "ms-1",
      mail: "u@c.com",
      userPrincipalName: "u@c.com",
      displayName: "User",
    });
    mockSaveTokens.mockRejectedValue(new Error("DB error"));

    // Act
    const response = await GET(makeContext("?code=the-code&state=the-state"));

    // Assert
    expect(response.status).toBe(302);
    expect(response.headers.get("Location") || "").toContain("ms_error=1");
  });
});

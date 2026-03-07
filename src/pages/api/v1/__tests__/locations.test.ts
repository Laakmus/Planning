/**
 * Testy GET /api/v1/locations — lista lokalizacji (słownik, autocomplete).
 *
 * Pokrywa:
 * - 200 OK — happy path z danymi
 * - 401 Unauthorized — brak autentykacji
 * - 500 Internal Server Error — serwis rzuca wyjątek
 * - Przekazanie parametru search do serwisu
 * - Przekazanie companyId (valid UUID) do serwisu
 * - Ignorowanie nieprawidłowego companyId (nie-UUID)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/helpers/api-context";

// ---------------------------------------------------------------------------
// Mocki
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  parseQueryParams: vi.fn(),
  isValidUUID: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/services/dictionary.service", () => ({
  getLocations: vi.fn(),
}));

import { GET } from "../locations";
import * as apiHelpers from "@/lib/api-helpers";
import { getLocations } from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockParseQueryParams = vi.mocked(apiHelpers.parseQueryParams);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetLocations = vi.mocked(getLocations);

// Przykładowe dane
const MOCK_LOCATIONS = [
  { id: "loc1", name: "Magazyn Główny", companyId: "c1" },
  { id: "loc2", name: "Oddział Północ", companyId: "c1" },
];

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

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
// Testy
// ---------------------------------------------------------------------------

describe("GET /api/v1/locations", () => {
  it("returns 401 when user is not authenticated", async () => {
    // Arrange
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/locations" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(401);
    expect(mockGetLocations).not.toHaveBeenCalled();
  });

  it("returns 200 with locations list (no params)", async () => {
    // Arrange — auth OK, brak search i companyId
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({});
    mockGetLocations.mockResolvedValue(MOCK_LOCATIONS as any);

    const ctx = makeApiContext({ url: "/api/v1/locations" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    expect(mockGetLocations).toHaveBeenCalledWith(ctx.locals.supabase, {
      search: undefined,
      companyId: undefined,
    });
    const body = await response.json();
    expect(body).toEqual(MOCK_LOCATIONS);
  });

  it("passes search param to getLocations service", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({ search: "Magazyn" });
    mockGetLocations.mockResolvedValue(MOCK_LOCATIONS as any);

    const ctx = makeApiContext({ url: "/api/v1/locations?search=Magazyn" });

    // Act
    await GET(ctx);

    // Assert
    expect(mockGetLocations).toHaveBeenCalledWith(ctx.locals.supabase, {
      search: "Magazyn",
      companyId: undefined,
    });
  });

  it("passes valid companyId (UUID) to getLocations service", async () => {
    // Arrange — companyId to poprawny UUID
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({ companyId: VALID_UUID });
    mockIsValidUUID.mockReturnValue(true);
    mockGetLocations.mockResolvedValue(MOCK_LOCATIONS as any);

    const ctx = makeApiContext({
      url: `/api/v1/locations?companyId=${VALID_UUID}`,
    });

    // Act
    await GET(ctx);

    // Assert — companyId przekazany
    expect(mockIsValidUUID).toHaveBeenCalledWith(VALID_UUID);
    expect(mockGetLocations).toHaveBeenCalledWith(ctx.locals.supabase, {
      search: undefined,
      companyId: VALID_UUID,
    });
  });

  it("ignores invalid companyId (not a UUID)", async () => {
    // Arrange — companyId to nie UUID
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({ companyId: "not-a-uuid" });
    mockIsValidUUID.mockReturnValue(false);
    mockGetLocations.mockResolvedValue(MOCK_LOCATIONS as any);

    const ctx = makeApiContext({ url: "/api/v1/locations?companyId=not-a-uuid" });

    // Act
    await GET(ctx);

    // Assert — companyId ignorowany (undefined)
    expect(mockGetLocations).toHaveBeenCalledWith(ctx.locals.supabase, {
      search: undefined,
      companyId: undefined,
    });
  });

  it("passes both search and valid companyId to getLocations", async () => {
    // Arrange — oba parametry
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({ search: "Oddział", companyId: VALID_UUID });
    mockIsValidUUID.mockReturnValue(true);
    mockGetLocations.mockResolvedValue(MOCK_LOCATIONS as any);

    const ctx = makeApiContext({
      url: `/api/v1/locations?search=Oddział&companyId=${VALID_UUID}`,
    });

    // Act
    await GET(ctx);

    // Assert
    expect(mockGetLocations).toHaveBeenCalledWith(ctx.locals.supabase, {
      search: "Oddział",
      companyId: VALID_UUID,
    });
  });

  it("returns 500 when getLocations throws an error", async () => {
    // Arrange — serwis rzuca wyjątek
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({});
    mockGetLocations.mockRejectedValue(new Error("DB timeout"));

    const ctx = makeApiContext({ url: "/api/v1/locations" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania listy lokalizacji.",
    );
  });
});

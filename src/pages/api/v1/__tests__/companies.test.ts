/**
 * Testy GET /api/v1/companies — lista firm (słownik, autocomplete).
 *
 * Pokrywa:
 * - 200 OK — happy path z danymi
 * - 401 Unauthorized — brak autentykacji
 * - 500 Internal Server Error — serwis rzuca wyjątek
 * - Przekazanie parametru search do serwisu
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
  logError: vi.fn(),
}));

vi.mock("@/lib/services/dictionary.service", () => ({
  getCompanies: vi.fn(),
}));

import { GET } from "../companies";
import * as apiHelpers from "@/lib/api-helpers";
import { getCompanies } from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockParseQueryParams = vi.mocked(apiHelpers.parseQueryParams);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetCompanies = vi.mocked(getCompanies);

// Przykładowe dane
const MOCK_COMPANIES = [
  { id: "c1", name: "Firma Transportowa ABC" },
  { id: "c2", name: "Spedycja XYZ" },
];

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

describe("GET /api/v1/companies", () => {
  it("returns 401 when user is not authenticated", async () => {
    // Arrange — getAuthenticatedUser zwraca Response 401
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/companies" });

    // Act
    const response = await GET(ctx);

    // Assert — zwrócona odpowiedź 401, serwis NIE wywołany
    expect(response.status).toBe(401);
    expect(mockGetCompanies).not.toHaveBeenCalled();
  });

  it("returns 200 with companies list (no search param)", async () => {
    // Arrange — auth OK, brak search
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({});
    mockGetCompanies.mockResolvedValue(MOCK_COMPANIES as any);

    const ctx = makeApiContext({ url: "/api/v1/companies" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    expect(mockGetCompanies).toHaveBeenCalledWith(ctx.locals.supabase, undefined);
    const body = await response.json();
    expect(body).toEqual(MOCK_COMPANIES);
  });

  it("passes search param to getCompanies service", async () => {
    // Arrange — auth OK, search = "ABC"
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({ search: "ABC" });
    mockGetCompanies.mockResolvedValue(MOCK_COMPANIES as any);

    const ctx = makeApiContext({ url: "/api/v1/companies?search=ABC" });

    // Act
    await GET(ctx);

    // Assert — search przekazany do serwisu
    expect(mockGetCompanies).toHaveBeenCalledWith(ctx.locals.supabase, "ABC");
  });

  it("returns 500 when getCompanies throws an error", async () => {
    // Arrange — auth OK, serwis rzuca wyjątek
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({});
    mockGetCompanies.mockRejectedValue(new Error("DB connection failed"));

    const ctx = makeApiContext({ url: "/api/v1/companies" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania listy firm.",
    );
  });
});

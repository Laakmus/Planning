/**
 * Testy GET /api/v1/products — lista produktów (słownik, autocomplete).
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
  getProducts: vi.fn(),
}));

import { GET } from "../products";
import * as apiHelpers from "@/lib/api-helpers";
import { getProducts } from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockParseQueryParams = vi.mocked(apiHelpers.parseQueryParams);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetProducts = vi.mocked(getProducts);

// Przykładowe dane
const MOCK_PRODUCTS = [
  { id: "p1", name: "Złom stalowy" },
  { id: "p2", name: "Odpady komunalne" },
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

describe("GET /api/v1/products", () => {
  it("returns 401 when user is not authenticated", async () => {
    // Arrange
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/products" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(401);
    expect(mockGetProducts).not.toHaveBeenCalled();
  });

  it("returns 200 with products list (no search param)", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({});
    mockGetProducts.mockResolvedValue(MOCK_PRODUCTS as any);

    const ctx = makeApiContext({ url: "/api/v1/products" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    expect(mockGetProducts).toHaveBeenCalledWith(ctx.locals.supabase, undefined);
    const body = await response.json();
    expect(body).toEqual(MOCK_PRODUCTS);
  });

  it("passes search param to getProducts service", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({ search: "złom" });
    mockGetProducts.mockResolvedValue(MOCK_PRODUCTS as any);

    const ctx = makeApiContext({ url: "/api/v1/products?search=złom" });

    // Act
    await GET(ctx);

    // Assert
    expect(mockGetProducts).toHaveBeenCalledWith(ctx.locals.supabase, "złom");
  });

  it("returns 500 when getProducts throws an error", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockParseQueryParams.mockReturnValue({});
    mockGetProducts.mockRejectedValue(new Error("DB connection failed"));

    const ctx = makeApiContext({ url: "/api/v1/products" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania listy produktów.",
    );
  });
});

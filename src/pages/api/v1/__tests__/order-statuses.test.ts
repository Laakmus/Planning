/**
 * Testy GET /api/v1/order-statuses — lista statusów zleceń.
 *
 * Pokrywa:
 * - 200 OK — happy path z danymi
 * - 401 Unauthorized — brak autentykacji
 * - 500 Internal Server Error — serwis rzuca wyjątek
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
  logError: vi.fn(),
}));

vi.mock("@/lib/services/dictionary.service", () => ({
  getOrderStatuses: vi.fn(),
}));

import { GET } from "../order-statuses";
import * as apiHelpers from "@/lib/api-helpers";
import { getOrderStatuses } from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetOrderStatuses = vi.mocked(getOrderStatuses);

// Przykładowe dane
const MOCK_ORDER_STATUSES = [
  { code: "nowe", name: "Nowe" },
  { code: "w_realizacji", name: "W realizacji" },
  { code: "wysłane", name: "Wysłane" },
  { code: "anulowane", name: "Anulowane" },
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

describe("GET /api/v1/order-statuses", () => {
  it("returns 401 when user is not authenticated", async () => {
    // Arrange
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/order-statuses" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(401);
    expect(mockGetOrderStatuses).not.toHaveBeenCalled();
  });

  it("returns 200 with order statuses list", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetOrderStatuses.mockResolvedValue(MOCK_ORDER_STATUSES as any);

    const ctx = makeApiContext({ url: "/api/v1/order-statuses" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    expect(mockGetOrderStatuses).toHaveBeenCalledWith(ctx.locals.supabase);
    const body = await response.json();
    expect(body).toEqual(MOCK_ORDER_STATUSES);
  });

  it("returns 500 when getOrderStatuses throws an error", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetOrderStatuses.mockRejectedValue(new Error("Query failed"));

    const ctx = makeApiContext({ url: "/api/v1/order-statuses" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania statusów zleceń.",
    );
  });
});

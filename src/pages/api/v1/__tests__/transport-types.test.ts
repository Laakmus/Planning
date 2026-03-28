/**
 * Testy GET /api/v1/transport-types — lista typów transportu.
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
  getTransportTypes: vi.fn(),
}));

import { GET } from "../transport-types";
import * as apiHelpers from "@/lib/api-helpers";
import { getTransportTypes } from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetTransportTypes = vi.mocked(getTransportTypes);

// Przykładowe dane
const MOCK_TRANSPORT_TYPES = [
  { code: "PL", name: "Krajowy" },
  { code: "EXP", name: "Eksport" },
  { code: "EXP_K", name: "Eksport kabotażowy" },
  { code: "IMP", name: "Import" },
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

describe("GET /api/v1/transport-types", () => {
  it("returns 401 when user is not authenticated", async () => {
    // Arrange
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/transport-types" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(401);
    expect(mockGetTransportTypes).not.toHaveBeenCalled();
  });

  it("returns 200 with transport types list", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetTransportTypes.mockResolvedValue(MOCK_TRANSPORT_TYPES as any);

    const ctx = makeApiContext({ url: "/api/v1/transport-types" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    expect(mockGetTransportTypes).toHaveBeenCalledWith(ctx.locals.supabase);
    const body = await response.json();
    expect(body).toEqual(MOCK_TRANSPORT_TYPES);
  });

  it("returns 500 when getTransportTypes throws an error", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetTransportTypes.mockRejectedValue(new Error("DB error"));

    const ctx = makeApiContext({ url: "/api/v1/transport-types" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania typów transportu.",
    );
  });
});

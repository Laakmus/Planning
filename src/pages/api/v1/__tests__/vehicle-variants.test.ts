/**
 * Testy GET /api/v1/vehicle-variants — lista wariantów pojazdów.
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
  getVehicleVariants: vi.fn(),
}));

import { GET } from "../vehicle-variants";
import * as apiHelpers from "@/lib/api-helpers";
import { getVehicleVariants } from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetVehicleVariants = vi.mocked(getVehicleVariants);

// Przykładowe dane
const MOCK_VEHICLE_VARIANTS = [
  { code: "SOLO", type: "Solo", volumeM3: 33 },
  { code: "MEGA", type: "Mega", volumeM3: 100 },
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

describe("GET /api/v1/vehicle-variants", () => {
  it("returns 401 when user is not authenticated", async () => {
    // Arrange
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/vehicle-variants" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(401);
    expect(mockGetVehicleVariants).not.toHaveBeenCalled();
  });

  it("returns 200 with vehicle variants list", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetVehicleVariants.mockResolvedValue(MOCK_VEHICLE_VARIANTS as any);

    const ctx = makeApiContext({ url: "/api/v1/vehicle-variants" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    expect(mockGetVehicleVariants).toHaveBeenCalledWith(ctx.locals.supabase);
    const body = await response.json();
    expect(body).toEqual(MOCK_VEHICLE_VARIANTS);
  });

  it("returns 500 when getVehicleVariants throws an error", async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetVehicleVariants.mockRejectedValue(new Error("Service unavailable"));

    const ctx = makeApiContext({ url: "/api/v1/vehicle-variants" });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania wariantów pojazdów.",
    );
  });
});

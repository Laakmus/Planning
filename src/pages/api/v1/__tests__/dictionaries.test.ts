/**
 * Testy GET /api/v1/dictionaries — combined dictionaries endpoint.
 *
 * Pokrywa:
 * - 200 OK — happy path, zwraca wszystkie 6 słowników
 * - 401 Unauthorized — brak autentykacji
 * - 500 Internal Server Error — jeden ze słowników rzuca wyjątek
 * - Cache-Control header
 * - Struktura odpowiedzi (klucze)
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
  getCompanies: vi.fn(),
  getLocations: vi.fn(),
  getProducts: vi.fn(),
  getTransportTypes: vi.fn(),
  getOrderStatuses: vi.fn(),
  getVehicleVariants: vi.fn(),
}));

import { GET } from "../dictionaries";
import * as apiHelpers from "@/lib/api-helpers";
import * as dictService from "@/lib/services/dictionary.service";

const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetCompanies = vi.mocked(dictService.getCompanies);
const mockGetLocations = vi.mocked(dictService.getLocations);
const mockGetProducts = vi.mocked(dictService.getProducts);
const mockGetTransportTypes = vi.mocked(dictService.getTransportTypes);
const mockGetOrderStatuses = vi.mocked(dictService.getOrderStatuses);
const mockGetVehicleVariants = vi.mocked(dictService.getVehicleVariants);

// Przykładowe dane
const MOCK_COMPANIES = [{ id: "c1", name: "Firma ABC" }];
const MOCK_LOCATIONS = [{ id: "l1", name: "Magazyn Wrocław" }];
const MOCK_PRODUCTS = [{ id: "p1", name: "Karton" }];
const MOCK_TRANSPORT_TYPES = [{ code: "PL", name: "Krajowy" }];
const MOCK_ORDER_STATUSES = [{ code: "nowe", name: "Nowe" }];
const MOCK_VEHICLE_VARIANTS = [{ code: "TIR", name: "TIR 24t" }];

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

describe("GET /api/v1/dictionaries", () => {
  it("returns 401 when user is not authenticated", async () => {
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );
    mockGetAuthenticatedUser.mockResolvedValue(unauthResponse);

    const ctx = makeApiContext({ url: "/api/v1/dictionaries" });
    const response = await GET(ctx);

    expect(response.status).toBe(401);
    expect(mockGetCompanies).not.toHaveBeenCalled();
    expect(mockGetLocations).not.toHaveBeenCalled();
  });

  it("returns 200 with all 6 dictionaries", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetCompanies.mockResolvedValue({ items: MOCK_COMPANIES as any });
    mockGetLocations.mockResolvedValue({ items: MOCK_LOCATIONS as any });
    mockGetProducts.mockResolvedValue({ items: MOCK_PRODUCTS as any });
    mockGetTransportTypes.mockResolvedValue({ items: MOCK_TRANSPORT_TYPES as any });
    mockGetOrderStatuses.mockResolvedValue({ items: MOCK_ORDER_STATUSES as any });
    mockGetVehicleVariants.mockResolvedValue({ items: MOCK_VEHICLE_VARIANTS as any });

    const ctx = makeApiContext({ url: "/api/v1/dictionaries" });
    const response = await GET(ctx);

    expect(response.status).toBe(200);

    // Sprawdź że jsonResponse zostało wywołane z prawidłową strukturą
    expect(mockJsonResponse).toHaveBeenCalledWith(
      {
        companies: MOCK_COMPANIES,
        locations: MOCK_LOCATIONS,
        products: MOCK_PRODUCTS,
        transportTypes: MOCK_TRANSPORT_TYPES,
        orderStatuses: MOCK_ORDER_STATUSES,
        vehicleVariants: MOCK_VEHICLE_VARIANTS,
      },
      200,
      { "Cache-Control": "private, max-age=3600" },
    );
  });

  it("calls all 6 dictionary services in parallel", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetCompanies.mockResolvedValue({ items: [] });
    mockGetLocations.mockResolvedValue({ items: [] });
    mockGetProducts.mockResolvedValue({ items: [] });
    mockGetTransportTypes.mockResolvedValue({ items: [] });
    mockGetOrderStatuses.mockResolvedValue({ items: [] });
    mockGetVehicleVariants.mockResolvedValue({ items: [] });

    const ctx = makeApiContext({ url: "/api/v1/dictionaries" });
    await GET(ctx);

    // Wszystkie 6 serwisów powinny być wywołane
    expect(mockGetCompanies).toHaveBeenCalledWith(ctx.locals.supabase);
    expect(mockGetLocations).toHaveBeenCalledWith(ctx.locals.supabase);
    expect(mockGetProducts).toHaveBeenCalledWith(ctx.locals.supabase);
    expect(mockGetTransportTypes).toHaveBeenCalledWith(ctx.locals.supabase);
    expect(mockGetOrderStatuses).toHaveBeenCalledWith(ctx.locals.supabase);
    expect(mockGetVehicleVariants).toHaveBeenCalledWith(ctx.locals.supabase);
  });

  it("returns 500 when any dictionary service throws", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "u1" } as any);
    mockGetCompanies.mockResolvedValue({ items: [] });
    mockGetLocations.mockRejectedValue(new Error("DB timeout"));
    mockGetProducts.mockResolvedValue({ items: [] });
    mockGetTransportTypes.mockResolvedValue({ items: [] });
    mockGetOrderStatuses.mockResolvedValue({ items: [] });
    mockGetVehicleVariants.mockResolvedValue({ items: [] });

    const ctx = makeApiContext({ url: "/api/v1/dictionaries" });
    const response = await GET(ctx);

    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalledWith(
      "[GET /api/v1/dictionaries]",
      expect.any(Error),
    );
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      "Błąd pobierania słowników.",
    );
  });
});

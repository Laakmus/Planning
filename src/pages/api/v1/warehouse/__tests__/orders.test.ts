/**
 * Testy dla GET /api/v1/warehouse/orders (src/pages/api/v1/warehouse/orders.ts).
 *
 * Strategia: importujemy handler GET bezpośrednio i wywolujemy z mockowanymi `locals`.
 * Mockujemy api-helpers (auth) i warehouse.service (logika serwisowa).
 *
 * Pokrycie:
 * - Happy path: poprawne parametry, domyslne wartosci, locationId z profilu
 * - Auth: brak tokenu (401), poprawny token (200)
 * - Logika 3-scierkowa locationId: query param, profil, brak obu (403)
 * - Walidacja: niepoprawny UUID, week/year poza zakresem
 * - Edge cases: lokalizacja nie-INTERNAL (400), pusty tydzien (200)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthMeDto, WarehouseWeekResponseDto } from "@/types";

// ---------------------------------------------------------------------------
// Mocki
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/services/warehouse.service", () => ({
  getCurrentISOWeek: vi.fn(),
  getWarehouseWeekOrders: vi.fn(),
}));

// Statyczne importy (po vi.mock — vitest hoistuje mocki)
import { GET } from "../orders";
import * as apiHelpers from "@/lib/api-helpers";
import * as warehouseService from "@/lib/services/warehouse.service";

// Typowane accessory
const mockGetAuthenticatedUser = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockGetCurrentISOWeek = vi.mocked(warehouseService.getCurrentISOWeek);
const mockGetWarehouseWeekOrders = vi.mocked(warehouseService.getWarehouseWeekOrders);

// ---------------------------------------------------------------------------
// Helpery
// ---------------------------------------------------------------------------

const LOCATION_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const OTHER_LOCATION_UUID = "f1e2d3c4-b5a6-7890-abcd-ef0987654321";

/** Tworzy minimalny obiekt locals z mockowanym supabase. */
function makeSupabaseMock(overrides?: {
  locationSelect?: any;
}) {
  const locationSelect = overrides?.locationSelect ?? {
    data: { id: LOCATION_UUID, companies: { type: "INTERNAL" } },
    error: null,
  };

  // Budujemy chainable query builder
  const maybeSingleFn = vi.fn().mockResolvedValue(locationSelect);
  const eqChain = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const selectChain = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: eqChain,
      maybeSingle: vi.fn().mockResolvedValue(locationSelect),
    }),
  });
  const fromFn = vi.fn().mockReturnValue({ select: selectChain });

  return { from: fromFn, _selectChain: selectChain, _maybeSingleFn: maybeSingleFn };
}

function makeLocals(supabase?: object) {
  return { supabase } as unknown as Parameters<typeof GET>[0]["locals"];
}

function makeContext(
  locals: ReturnType<typeof makeLocals>,
  queryString = ""
): Parameters<typeof GET>[0] {
  const url = `http://localhost:4321/api/v1/warehouse/orders${queryString ? "?" + queryString : ""}`;
  return {
    locals,
    request: new Request(url),
    params: {},
    url: new URL(url),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as Parameters<typeof GET>[0]["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: "/api/v1/warehouse/orders",
    originPathname: "/api/v1/warehouse/orders",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as Parameters<typeof GET>[0];
}

const MOCK_PROFILE: AuthMeDto = {
  id: "user-uuid-1",
  email: "jan@example.com",
  fullName: "Jan Kowalski",
  phone: null,
  role: "PLANNER",
  username: "testuser",
  isActive: true,
  locationId: LOCATION_UUID,
};

const MOCK_PROFILE_NO_LOCATION: AuthMeDto = {
  ...MOCK_PROFILE,
  locationId: null,
};

/** Minimalna poprawna odpowiedz serwisu magazynowego. */
const MOCK_WAREHOUSE_RESPONSE: WarehouseWeekResponseDto = {
  week: 12,
  year: 2026,
  weekStart: "2026-03-16",
  weekEnd: "2026-03-20",
  locationName: "Oddz. Warszawa",
  days: [
    { date: "2026-03-16", dayName: "Poniedzialek", entries: [] },
    { date: "2026-03-17", dayName: "Wtorek", entries: [] },
    { date: "2026-03-18", dayName: "Sroda", entries: [] },
    { date: "2026-03-19", dayName: "Czwartek", entries: [] },
    { date: "2026-03-20", dayName: "Piatek", entries: [] },
  ],
  noDateEntries: [],
  summary: {
    loadingCount: 0,
    loadingTotalTons: 0,
    unloadingCount: 0,
    unloadingTotalTons: 0,
  },
};

function make401Response() {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: "Brak sesji lub niewazny token.",
      statusCode: 401,
    }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Domyslne implementacje mockow
  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string, details?: any) =>
      new Response(JSON.stringify({ error, message, statusCode, details }), {
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

  // Domyslnie: biezacy tydzien = 10/2026
  mockGetCurrentISOWeek.mockReturnValue({ week: 10, year: 2026 });

  // Domyslnie: serwis zwraca poprawna odpowiedz
  mockGetWarehouseWeekOrders.mockResolvedValue(MOCK_WAREHOUSE_RESPONSE);
});

// ---------------------------------------------------------------------------
// Testy — Happy path
// ---------------------------------------------------------------------------

describe("GET /api/v1/warehouse/orders — happy path", () => {
  it("zwraca 200 z week=12&year=2026&locationId=<uuid>", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(
      makeLocals(supabase),
      `week=12&year=2026&locationId=${LOCATION_UUID}`
    );
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      supabase,
      LOCATION_UUID,
      12,
      2026,
      expect.any(String)
    );
  });

  it("zwraca 200 z week=12&year=2026 (bez locationId, user ma profil)", async () => {
    // User ma locationId w profilu — endpoint powinien go uzyc
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    // Powinien uzyc locationId z profilu
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      supabase,
      LOCATION_UUID,
      12,
      2026,
      expect.any(String)
    );
  });

  it("zwraca 200 bez parametrow week/year — uzywa biezacego tygodnia", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    mockGetCurrentISOWeek.mockReturnValue({ week: 10, year: 2026 });
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "");
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    // Powinien uzyc week=10, year=2026 z getCurrentISOWeek
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      supabase,
      LOCATION_UUID,
      10,
      2026,
      expect.any(String)
    );
  });

  it("odpowiedz ma poprawna strukture WarehouseWeekResponseDto", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);
    const body = await response.json();

    // Sprawdzamy ze mockJsonResponse zostal wywolany z danymi serwisu
    expect(mockJsonResponse).toHaveBeenCalledWith(MOCK_WAREHOUSE_RESPONSE, 200);
    expect(body).toHaveProperty("week");
    expect(body).toHaveProperty("year");
    expect(body).toHaveProperty("days");
    expect(body).toHaveProperty("noDateEntries");
    expect(body).toHaveProperty("summary");
  });
});

// ---------------------------------------------------------------------------
// Testy — Auth i access control
// ---------------------------------------------------------------------------

describe("GET /api/v1/warehouse/orders — auth", () => {
  it("zwraca 500 gdy brak locals.supabase", async () => {
    const ctx = makeContext(makeLocals(undefined), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
  });

  it("zwraca 401 gdy getAuthenticatedUser zwraca 401 Response", async () => {
    const unauthorizedResponse = make401Response();
    mockGetAuthenticatedUser.mockResolvedValue(unauthorizedResponse);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(401);
  });

  it("nie wywoluje serwisu magazynowego gdy auth sie nie powiedzie", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(make401Response());
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    await GET(ctx);

    expect(mockGetWarehouseWeekOrders).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Testy — Logika 3-sciezkowa locationId
// ---------------------------------------------------------------------------

describe("GET /api/v1/warehouse/orders — locationId resolution", () => {
  it("query param locationId ma priorytet nad profilem", async () => {
    // User ma inny locationId w profilu niz w query
    const profileWithDifferentLocation: AuthMeDto = {
      ...MOCK_PROFILE,
      locationId: OTHER_LOCATION_UUID,
    };
    mockGetAuthenticatedUser.mockResolvedValue(profileWithDifferentLocation);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(
      makeLocals(supabase),
      `week=12&year=2026&locationId=${LOCATION_UUID}`
    );
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    // Powinien uzyc locationId z query, nie z profilu
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      supabase,
      LOCATION_UUID,
      12,
      2026,
      expect.any(String)
    );
  });

  it("uzywa locationId z profilu gdy brak query param", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      supabase,
      LOCATION_UUID,
      12,
      2026,
      expect.any(String)
    );
  });

  it("zwraca 403 gdy brak query param i user nie ma locationId w profilu", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE_NO_LOCATION);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(403);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      403,
      "Forbidden",
      expect.stringContaining("oddzia")
    );
  });

  it("zwraca 403 gdy brak query param, brak locationId w profilu, brak week/year", async () => {
    // Scenariusz: zadnych parametrow + user bez locationId
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE_NO_LOCATION);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "");
    const response = await GET(ctx);

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Testy — Walidacja parametrow
// ---------------------------------------------------------------------------

describe("GET /api/v1/warehouse/orders — validation", () => {
  it("zwraca 400 gdy locationId nie jest UUID", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(
      makeLocals(supabase),
      "week=12&year=2026&locationId=not-a-uuid"
    );
    const response = await GET(ctx);

    expect(response.status).toBe(400);
  });

  it("zwraca 400 gdy week=0 (ponizej minimum)", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=0&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(400);
  });

  it("zwraca 400 gdy week=54 (powyzej maksimum)", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=54&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(400);
  });

  it("zwraca 400 gdy year=abc (nie-numeryczny)", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=abc");
    const response = await GET(ctx);

    expect(response.status).toBe(400);
  });

  it("zwraca 400 gdy locationId nie-UUID bez week/year", async () => {
    // Testuje sciezke walidacji locationId gdy brak week/year
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "locationId=invalid-uuid");
    const response = await GET(ctx);

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Testy — Edge cases
// ---------------------------------------------------------------------------

describe("GET /api/v1/warehouse/orders — edge cases", () => {
  it("zwraca 400 gdy locationId nie nalezy do firmy INTERNAL", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE_NO_LOCATION);

    // Supabase zwraca null — lokalizacja nie istnieje lub nie jest INTERNAL
    const supabase = makeSupabaseMock({
      locationSelect: { data: null, error: null },
    });

    const ctx = makeContext(
      makeLocals(supabase),
      `week=12&year=2026&locationId=${LOCATION_UUID}`
    );
    const response = await GET(ctx);

    expect(response.status).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.stringContaining("lokalizacja")
    );
  });

  it("zwraca 200 z pustymi dniami gdy brak operacji w tygodniu", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);

    // Serwis zwraca odpowiedz z pustymi entries we wszystkich dniach
    const emptyResponse: WarehouseWeekResponseDto = {
      ...MOCK_WAREHOUSE_RESPONSE,
      days: MOCK_WAREHOUSE_RESPONSE.days.map((d) => ({ ...d, entries: [] })),
      noDateEntries: [],
      summary: {
        loadingCount: 0,
        loadingTotalTons: 0,
        unloadingCount: 0,
        unloadingTotalTons: 0,
      },
    };
    mockGetWarehouseWeekOrders.mockResolvedValue(emptyResponse);
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    expect(mockJsonResponse).toHaveBeenCalledWith(emptyResponse, 200);
  });

  it("zwraca 500 gdy serwis rzuci wyjatek", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE);
    mockGetWarehouseWeekOrders.mockRejectedValue(new Error("DB connection lost"));
    const supabase = makeSupabaseMock();

    const ctx = makeContext(makeLocals(supabase), "week=12&year=2026");
    const response = await GET(ctx);

    expect(response.status).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
  });

  it("poprawny locationId z query param i brak week/year — uzywa biezacego tygodnia", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(MOCK_PROFILE_NO_LOCATION);
    mockGetCurrentISOWeek.mockReturnValue({ week: 10, year: 2026 });
    const supabase = makeSupabaseMock();

    const ctx = makeContext(
      makeLocals(supabase),
      `locationId=${LOCATION_UUID}`
    );
    const response = await GET(ctx);

    expect(response.status).toBe(200);
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      supabase,
      LOCATION_UUID,
      10,
      2026,
      expect.any(String)
    );
  });
});

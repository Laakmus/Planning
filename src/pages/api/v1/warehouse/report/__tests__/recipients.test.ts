/**
 * Testy dla GET /api/v1/warehouse/report/recipients.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 400 brak locationId
 * - 400 nieprawidłowy UUID locationId
 * - 200 happy path (lista odbiorców)
 * - 200 pusta lista odbiorców
 * - 200 null data (fallback na pustą tablicę)
 * - 500 błąd zapytania do bazy
 * - 500 nieoczekiwany wyjątek
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  requireWriteAccess: vi.fn(() => null),
  isValidUUID: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
}));

import { GET } from "../recipients";
import * as apiHelpers from "@/lib/api-helpers";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-uuid-1",
  email: "test@test.pl",
  fullName: "Test User",
  phone: null,
  role: "PLANNER" as const,
  username: "testuser",
  isActive: true,
  locationId: null,
};

const LOCATION_ID = "123e4567-e89b-12d3-a456-426614174000";

const MOCK_RECIPIENTS = [
  { id: "r1", email: "jan@example.com", name: "Jan Kowalski" },
  { id: "r2", email: "anna@example.com", name: "Anna Nowak" },
];

type AnyAPIContext = Parameters<typeof GET>[0];

/**
 * Tworzy mock Supabase dla tabeli warehouse_report_recipients.
 */
function createSupabaseMock(opts?: {
  recipientsData?: typeof MOCK_RECIPIENTS | null;
  recipientsError?: unknown;
}) {
  const recipientsData = opts?.recipientsData ?? MOCK_RECIPIENTS;
  const recipientsError = opts?.recipientsError ?? null;

  const mockEq = vi.fn().mockResolvedValue({ data: recipientsData, error: recipientsError });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return { from: mockFrom, _mocks: { from: mockFrom, select: mockSelect, eq: mockEq } };
}

function makeContext(queryParams = "locationId=" + LOCATION_ID, overrides?: {
  supabase?: ReturnType<typeof createSupabaseMock>;
}): AnyAPIContext {
  const supabase = overrides?.supabase ?? createSupabaseMock();
  const urlStr = queryParams
    ? "http://localhost:4321/api/v1/warehouse/report/recipients?" + queryParams
    : "http://localhost:4321/api/v1/warehouse/report/recipients";

  return {
    locals: { supabase },
    request: new Request(urlStr, { method: "GET" }),
    params: {},
    url: new URL(urlStr),
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
    routePattern: "/api/v1/warehouse/report/recipients",
    originPathname: "/api/v1/warehouse/report/recipients",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

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
  mockIsValidUUID.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("GET /api/v1/warehouse/report/recipients", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await GET(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 400 when locationId is missing", async () => {
    const response = await GET(makeContext(""));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when locationId is not a valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const response = await GET(makeContext("locationId=not-valid"));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 200 with recipients list", async () => {
    const response = await GET(makeContext());

    expect(mockJsonResponse).toHaveBeenCalledWith({ recipients: MOCK_RECIPIENTS });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.recipients).toHaveLength(2);
    expect(json.recipients[0].email).toBe("jan@example.com");
  });

  it("returns 200 with empty list when no recipients", async () => {
    const supabase = createSupabaseMock({ recipientsData: [] });

    const response = await GET(makeContext(undefined, { supabase }));

    expect(mockJsonResponse).toHaveBeenCalledWith({ recipients: [] });
    expect(response.status).toBe(200);
  });

  it("returns 200 with empty list when data is null", async () => {
    // Tworzymy supabase mock zwracający null jako data
    const mockEqNull = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelectNull = vi.fn().mockReturnValue({ eq: mockEqNull });
    const mockFromNull = vi.fn().mockReturnValue({ select: mockSelectNull });
    const supabaseNull = { from: mockFromNull } as never;

    const ctx = makeContext(undefined, { supabase: supabaseNull });
    const response = await GET(ctx);

    // recipients ?? [] -> pusta tablica
    expect(mockJsonResponse).toHaveBeenCalledWith({ recipients: [] });
    expect(response.status).toBe(200);
  });

  it("returns 500 when Supabase query returns error", async () => {
    const supabase = createSupabaseMock({ recipientsError: { message: "DB connection failed" } });

    const response = await GET(makeContext(undefined, { supabase }));

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("returns 500 on unexpected exception", async () => {
    // Symuluj rzucenie wyjątku przez supabase.from()
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error("Unexpected crash");
      }),
    };

    const response = await GET(makeContext(undefined, { supabase: supabase as never }));

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

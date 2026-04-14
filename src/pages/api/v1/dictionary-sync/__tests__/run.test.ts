/**
 * Testy dla POST /api/v1/dictionary-sync/run — uruchomienie synchronizacji słowników.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 brak uprawnień zapisu (READ_ONLY)
 * - 400 nieprawidłowy JSON body
 * - 400 błąd walidacji Zod (puste resources, nieprawidłowa wartość)
 * - 200 sukces (happy path)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  requireWriteAccess: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  dictionarySyncSchema: {
    safeParse: vi.fn(),
  },
}));

import { POST } from "../run";
import * as apiHelpers from "@/lib/api-helpers";
import { dictionarySyncSchema } from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockSafeParse = vi.mocked(dictionarySyncSchema.safeParse);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-uuid-1",
  email: "planner@test.pl",
  fullName: "Planner User",
  phone: null,
  role: "PLANNER" as const,
  username: "testuser",
  isActive: true,
  locationId: null,
};

type AnyAPIContext = Parameters<typeof POST>[0];

function makeContext(): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request("http://localhost:4321/api/v1/dictionary-sync/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources: ["COMPANIES"] }),
    }),
    params: {},
    url: new URL("http://localhost:4321/api/v1/dictionary-sync/run"),
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
    routePattern: "/api/v1/dictionary-sync/run",
    originPathname: "/api/v1/dictionary-sync/run",
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
    (statusCode: number, error: string, message: string, details?: unknown) =>
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

  // Domyślne zachowanie — zalogowany z uprawnieniami zapisu
  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockParseJsonBody.mockResolvedValue({ resources: ["COMPANIES"] });
  mockSafeParse.mockReturnValue({
    success: true,
    data: { resources: ["COMPANIES"] },
  } as never);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/dictionary-sync/run", () => {
  it("returns 401 when not authenticated", async () => {
    // Niezalogowany użytkownik
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    // Użytkownik READ_ONLY — brak uprawnień zapisu
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const response = await POST(makeContext());
    expect(response.status).toBe(403);
  });

  it("returns 400 when JSON body is invalid", async () => {
    // Nieprawidłowy JSON — parseJsonBody rzuca wyjątek
    mockParseJsonBody.mockRejectedValue(new Error("Invalid JSON"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      "Nieprawidłowy lub pusty body JSON."
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails (empty resources)", async () => {
    // Puste resources — walidacja Zod nie przechodzi
    mockParseJsonBody.mockResolvedValue({ resources: [] });
    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ["resources"],
            message: "Array must contain at least 1 element(s)",
            code: "too_small",
          },
        ],
      },
    } as never);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      "Nieprawidłowe parametry synchronizacji.",
      { resources: ["Array must contain at least 1 element(s)"] }
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails (invalid resource value)", async () => {
    // Nieprawidłowa wartość resource — walidacja Zod nie przechodzi
    mockParseJsonBody.mockResolvedValue({ resources: ["INVALID"] });
    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ["resources", "0"],
            message: "Invalid enum value",
            code: "invalid_enum_value",
          },
        ],
      },
    } as never);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      "Nieprawidłowe parametry synchronizacji.",
      { "resources.0": ["Invalid enum value"] }
    );
    expect(response.status).toBe(400);
  });

  it("returns 200 with jobId and status STARTED on success", async () => {
    // Pomyślne uruchomienie synchronizacji
    const response = await POST(makeContext());

    expect(mockJsonResponse).toHaveBeenCalledWith(
      {
        jobId: expect.any(String),
        status: "STARTED",
      },
      200
    );
    expect(response.status).toBe(200);
  });

  it("returns 200 with all three resources", async () => {
    // Synchronizacja wszystkich trzech zasobów
    mockParseJsonBody.mockResolvedValue({
      resources: ["COMPANIES", "LOCATIONS", "PRODUCTS"],
    });
    mockSafeParse.mockReturnValue({
      success: true,
      data: { resources: ["COMPANIES", "LOCATIONS", "PRODUCTS"] },
    } as never);

    const response = await POST(makeContext());

    expect(mockJsonResponse).toHaveBeenCalledWith(
      {
        jobId: expect.any(String),
        status: "STARTED",
      },
      200
    );
    expect(response.status).toBe(200);
  });
});

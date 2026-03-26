/**
 * Testy dla POST /api/v1/admin/cleanup — czyszczenie anulowanych zleceń.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 brak roli ADMIN
 * - 200 sukces (happy path)
 * - 500 błąd serwera (cleanupCancelledOrders rzuca wyjątek)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  requireAdmin: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/services/cleanup.service", () => ({
  createServiceRoleClient: vi.fn(),
  cleanupCancelledOrders: vi.fn(),
}));

import { POST } from "../cleanup";
import * as apiHelpers from "@/lib/api-helpers";
import * as cleanupService from "@/lib/services/cleanup.service";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireAdmin = vi.mocked(apiHelpers.requireAdmin);
const mockCreateServiceRoleClient = vi.mocked(cleanupService.createServiceRoleClient);
const mockCleanupCancelledOrders = vi.mocked(cleanupService.cleanupCancelledOrders);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_ADMIN_USER = {
  id: "user-uuid-admin",
  email: "admin@test.pl",
  fullName: "Admin User",
  phone: null,
  role: "ADMIN" as const,
  locationId: null,
};

const MOCK_PLANNER_USER = {
  id: "user-uuid-planner",
  email: "planner@test.pl",
  fullName: "Planner User",
  phone: null,
  role: "PLANNER" as const,
  locationId: null,
};

type AnyAPIContext = Parameters<typeof POST>[0];

function makeContext(): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request("http://localhost:4321/api/v1/admin/cleanup", {
      method: "POST",
    }),
    params: {},
    url: new URL("http://localhost:4321/api/v1/admin/cleanup"),
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
    routePattern: "/api/v1/admin/cleanup",
    originPathname: "/api/v1/admin/cleanup",
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

  // Domyślne zachowanie — zalogowany admin
  mockGetAuth.mockResolvedValue(MOCK_ADMIN_USER);
  mockRequireAdmin.mockReturnValue(null as never);
  mockCreateServiceRoleClient.mockReturnValue({} as never);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/admin/cleanup", () => {
  it("returns 401 when not authenticated", async () => {
    // Niezalogowany użytkownik
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not ADMIN", async () => {
    // Użytkownik bez roli ADMIN
    mockGetAuth.mockResolvedValue(MOCK_PLANNER_USER);
    mockRequireAdmin.mockReturnValue(new Response(null, { status: 403 }) as never);

    const response = await POST(makeContext());
    expect(response.status).toBe(403);
  });

  it("returns 200 with deletedCount and deletedOrderIds on success", async () => {
    // Pomyślne czyszczenie — 2 zlecenia usunięte
    const fakeResult = {
      deletedCount: 2,
      deletedOrderIds: ["order-1", "order-2"],
    };
    mockCleanupCancelledOrders.mockResolvedValue(fakeResult);

    const response = await POST(makeContext());

    expect(mockCreateServiceRoleClient).toHaveBeenCalled();
    expect(mockCleanupCancelledOrders).toHaveBeenCalledWith(expect.anything());
    expect(mockJsonResponse).toHaveBeenCalledWith({
      deletedCount: 2,
      deletedOrderIds: ["order-1", "order-2"],
    });
    expect(response.status).toBe(200);
  });

  it("returns 200 with zero deletedCount when nothing to clean", async () => {
    // Brak anulowanych zleceń do usunięcia
    const fakeResult = {
      deletedCount: 0,
      deletedOrderIds: [],
    };
    mockCleanupCancelledOrders.mockResolvedValue(fakeResult);

    const response = await POST(makeContext());

    expect(mockJsonResponse).toHaveBeenCalledWith({
      deletedCount: 0,
      deletedOrderIds: [],
    });
    expect(response.status).toBe(200);
  });

  it("returns 500 when cleanupCancelledOrders throws", async () => {
    // Błąd serwera — wyjątek w serwisie cleanup
    mockCleanupCancelledOrders.mockRejectedValue(new Error("DB connection failed"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
    expect(response.status).toBe(500);
  });
});

/**
 * Testy dla POST /api/v1/orders/{orderId}/restore — przywrócenie zlecenia.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 200 sukces
 * - 404 nie znaleziono (restoreOrder zwraca null)
 * - 400 FORBIDDEN_RESTORE (status nie pozwala na przywrócenie)
 * - 410 GONE_24H (anulowane ponad 24h temu)
 * - 500 błąd serwera
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  requireWriteAccess: vi.fn(),
  isValidUUID: vi.fn(),
}));

vi.mock("@/lib/services/order-status.service", () => ({
  cancelOrder: vi.fn(),
  changeStatus: vi.fn(),
  restoreOrder: vi.fn(),
}));

import { POST } from "../restore";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderStatusService from "@/lib/services/order-status.service";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockRestoreOrder = vi.mocked(orderStatusService.restoreOrder);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-uuid-1",
  email: "test@test.pl",
  fullName: "Test User",
  phone: null,
  role: "PLANNER" as const,
  locationId: null,
};

const VALID_ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

type AnyAPIContext = Parameters<typeof POST>[0];

function makeContext(overrides?: {
  params?: Record<string, string>;
}): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/restore`, {
      method: "POST",
    }),
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/restore`),
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
    routePattern: "/api/v1/orders/[orderId]/restore",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/restore`,
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

  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockIsValidUUID.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/restore", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const response = await POST(makeContext());
    expect(response.status).toBe(403);
  });

  it("returns 400 when orderId is not a valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const response = await POST(makeContext({ params: { orderId: "invalid" } }));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 200 on successful restore", async () => {
    const fakeResult = { id: VALID_ORDER_ID, statusCode: "korekta" };
    mockRestoreOrder.mockResolvedValue(fakeResult);

    const response = await POST(makeContext());

    expect(mockRestoreOrder).toHaveBeenCalledWith(expect.anything(), MOCK_USER.id, VALID_ORDER_ID);
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 404 when restoreOrder returns null", async () => {
    mockRestoreOrder.mockResolvedValue(null);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 400 when restoreOrder throws FORBIDDEN_RESTORE", async () => {
    mockRestoreOrder.mockRejectedValue(new Error("FORBIDDEN_RESTORE"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 410 when restoreOrder throws GONE_24H", async () => {
    // Zlecenie anulowane ponad 24h temu — niedostępne do przywrócenia
    mockRestoreOrder.mockRejectedValue(new Error("GONE_24H"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(410, "Gone", expect.any(String));
    expect(response.status).toBe(410);
  });

  it("returns 500 on generic restoreOrder error", async () => {
    mockRestoreOrder.mockRejectedValue(new Error("Connection timeout"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

/**
 * Testy dla POST /api/v1/orders/{orderId}/duplicate — kopiowanie zlecenia.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 400 nieprawidłowy body JSON
 * - 400 Zod validation fail
 * - 201 sukces
 * - 404 nie znaleziono (duplicateOrder zwraca null)
 * - 422 FK_VALIDATION
 * - 500 błąd serwera
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  requireWriteAccess: vi.fn(),
  isValidUUID: vi.fn(),
  parseJsonBody: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/services/order.service", () => ({
  duplicateOrder: vi.fn(),
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  getOrderDetail: vi.fn(),
  updateOrder: vi.fn(),
  prepareEmailForOrder: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  duplicateOrderSchema: { safeParse: vi.fn() },
  createOrderSchema: { safeParse: vi.fn() },
  updateOrderSchema: { safeParse: vi.fn() },
  orderListQuerySchema: { safeParse: vi.fn() },
  changeStatusSchema: { safeParse: vi.fn() },
  prepareEmailSchema: { safeParse: vi.fn() },
}));

import { POST } from "../duplicate";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockDuplicateOrder = vi.mocked(orderService.duplicateOrder);
const mockDuplicateOrderSchema = vi.mocked(orderValidator.duplicateOrderSchema);

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
    request: new Request(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeStops: true, includeItems: true, resetStatusToDraft: true }),
    }),
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/duplicate`),
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
    routePattern: "/api/v1/orders/[orderId]/duplicate",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/duplicate`,
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
  mockParseJsonBody.mockResolvedValue({
    includeStops: true,
    includeItems: true,
    resetStatusToDraft: true,
  });

  // Domyślnie: schemat przechodzi
  mockDuplicateOrderSchema.safeParse.mockReturnValue({
    success: true,
    data: { includeStops: true, includeItems: true, resetStatusToDraft: true },
  } as unknown as ReturnType<typeof orderValidator.duplicateOrderSchema.safeParse>);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/duplicate", () => {
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

    const response = await POST(makeContext({ params: { orderId: "not-uuid" } }));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when JSON body parse fails", async () => {
    mockParseJsonBody.mockRejectedValue(new SyntaxError("Invalid JSON"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockDuplicateOrderSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["includeStops"], message: "Required" }],
      },
    } as unknown as ReturnType<typeof orderValidator.duplicateOrderSchema.safeParse>);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400, "Bad Request", expect.any(String), expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 201 with duplicated order on success", async () => {
    const fakeDuplicated = { id: "new-order-uuid", orderNo: "Z/2026/002", statusCode: "nowe", statusName: "Nowe", createdAt: "2026-03-07T10:00:00Z" };
    mockDuplicateOrder.mockResolvedValue(fakeDuplicated);

    const response = await POST(makeContext());

    expect(mockDuplicateOrder).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      VALID_ORDER_ID,
      expect.any(Object)
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeDuplicated, 201);
    expect(response.status).toBe(201);
  });

  it("returns 404 when duplicateOrder returns null", async () => {
    mockDuplicateOrder.mockResolvedValue(null);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 422 when duplicateOrder throws FK_VALIDATION", async () => {
    mockDuplicateOrder.mockRejectedValue(new Error("FK_VALIDATION"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(422, "Unprocessable Entity", expect.any(String));
    expect(response.status).toBe(422);
  });

  it("returns 500 on generic duplicateOrder error", async () => {
    mockDuplicateOrder.mockRejectedValue(new Error("Unexpected server error"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

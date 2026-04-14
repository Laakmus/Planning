/**
 * Testy dla GET/PUT/DELETE /api/v1/orders/{orderId}.
 *
 * Pokrywa:
 * GET:
 * - 401 niezalogowany
 * - 400 nieprawidłowy UUID
 * - 404 nie znaleziono
 * - 200 sukces
 *
 * PUT:
 * - 401, 403, 400 (UUID), 400 (body JSON), 400 (Zod)
 * - 200 sukces
 * - 409 LOCKED
 * - 400 FORBIDDEN_EDIT
 * - 400 STOPS_LIMIT
 * - 400 STOPS_ORDER
 * - 400 FK_VALIDATION
 * - 404 nie znaleziono
 * - 500 błąd serwera
 *
 * DELETE:
 * - 401, 403, 400 (UUID)
 * - 200 sukces
 * - 404 nie znaleziono
 * - 400 FORBIDDEN_TRANSITION
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
  parseQueryParams: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/services/order.service", () => ({
  getOrderDetail: vi.fn(),
  updateOrder: vi.fn(),
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  duplicateOrder: vi.fn(),
  prepareEmailForOrder: vi.fn(),
}));

vi.mock("@/lib/services/order-status.service", () => ({
  cancelOrder: vi.fn(),
  changeStatus: vi.fn(),
  restoreOrder: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  updateOrderSchema: { safeParse: vi.fn() },
  createOrderSchema: { safeParse: vi.fn() },
  orderListQuerySchema: { safeParse: vi.fn() },
  changeStatusSchema: { safeParse: vi.fn() },
  duplicateOrderSchema: { safeParse: vi.fn() },
  prepareEmailSchema: { safeParse: vi.fn() },
}));

import { GET, PUT, DELETE } from "../index";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderStatusService from "@/lib/services/order-status.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockGetOrderDetail = vi.mocked(orderService.getOrderDetail);
const mockUpdateOrder = vi.mocked(orderService.updateOrder);
const mockCancelOrder = vi.mocked(orderStatusService.cancelOrder);
const mockUpdateOrderSchema = vi.mocked(orderValidator.updateOrderSchema);

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

const VALID_ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeContext(overrides?: {
  params?: Record<string, string>;
  locals?: Record<string, unknown>;
  request?: Request;
}): Parameters<typeof GET>[0] {
  return {
    request: new Request(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}`),
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}`),
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
    routePattern: "/api/v1/orders/[orderId]",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
    ...overrides,
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    locals: { supabase: { from: vi.fn() }, ...overrides?.locals },
  } as unknown as Parameters<typeof GET>[0];
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

  // Domyślnie: schemat przechodzi walidację
  mockUpdateOrderSchema.safeParse.mockReturnValue({
    success: true,
    data: { transportTypeCode: "PL", stops: [], items: [] },
  } as unknown as ReturnType<typeof orderValidator.updateOrderSchema.safeParse>);
});

// ---------------------------------------------------------------------------
// GET /api/v1/orders/{orderId}
// ---------------------------------------------------------------------------

describe("GET /api/v1/orders/{orderId}", () => {
  it("returns 401 when getAuthenticatedUser returns a Response", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const ctx = makeContext();
    const response = await GET(ctx);
    expect(response.status).toBe(401);
  });

  it("returns 400 when orderId is not a valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const ctx = makeContext({ params: { orderId: "not-a-uuid" } });
    const response = await GET(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when orderId is missing", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const ctx = makeContext({ params: { orderId: "" } });
    const response = await GET(ctx);
    expect(response.status).toBe(400);
  });

  it("returns 404 when getOrderDetail returns null", async () => {
    mockGetOrderDetail.mockResolvedValue(null);

    const ctx = makeContext();
    const response = await GET(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 200 with order detail on success", async () => {
    const fakeOrder = { order: { id: VALID_ORDER_ID, orderNo: "Z/2026/001" } as any, stops: [], items: [] };
    mockGetOrderDetail.mockResolvedValue(fakeOrder);

    const ctx = makeContext();
    const response = await GET(ctx);

    expect(mockGetOrderDetail).toHaveBeenCalledWith(expect.anything(), VALID_ORDER_ID);
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeOrder, 200);
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/orders/{orderId}
// ---------------------------------------------------------------------------

describe("PUT /api/v1/orders/{orderId}", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const ctx = makeContext();
    const response = await PUT(ctx);
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const ctx = makeContext();
    const response = await PUT(ctx);
    expect(response.status).toBe(403);
  });

  it("returns 400 when orderId is not valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const ctx = makeContext({ params: { orderId: "invalid" } });
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when JSON body parse fails", async () => {
    mockParseJsonBody.mockRejectedValue(new SyntaxError("Bad JSON"));

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrderSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["transportTypeCode"], message: "Required" }],
      },
    } as unknown as ReturnType<typeof orderValidator.updateOrderSchema.safeParse>);

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400, "Bad Request", expect.any(String), expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 200 with updated order on success", async () => {
    mockParseJsonBody.mockResolvedValue({});
    const fakeResult = { id: VALID_ORDER_ID, orderNo: "Z/2026/001", statusCode: "nowe", updatedAt: "2026-03-07T10:00:00Z" };
    mockUpdateOrder.mockResolvedValue(fakeResult);

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockUpdateOrder).toHaveBeenCalledOnce();
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 404 when updateOrder returns null", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrder.mockResolvedValue(null);

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 409 when updateOrder throws LOCKED", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrder.mockRejectedValue(new Error("LOCKED"));

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(409, "Conflict", expect.any(String));
    expect(response.status).toBe(409);
  });

  it("returns 400 when updateOrder throws FORBIDDEN_EDIT", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrder.mockRejectedValue(new Error("FORBIDDEN_EDIT"));

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when updateOrder throws STOPS_LIMIT", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrder.mockRejectedValue(new Error("STOPS_LIMIT"));

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when updateOrder throws STOPS_ORDER", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrder.mockRejectedValue(new Error("STOPS_ORDER"));

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when updateOrder throws FK_VALIDATION", async () => {
    mockParseJsonBody.mockResolvedValue({});
    const err = Object.assign(new Error("FK_VALIDATION"), { details: { carrierId: "not found" } });
    mockUpdateOrder.mockRejectedValue(err);

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400, "Bad Request", expect.any(String), expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 500 on generic updateOrder error", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockUpdateOrder.mockRejectedValue(new Error("DB connection lost"));

    const ctx = makeContext();
    const response = await PUT(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/orders/{orderId}
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/orders/{orderId}", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const ctx = makeContext();
    const response = await DELETE(ctx);
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const ctx = makeContext();
    const response = await DELETE(ctx);
    expect(response.status).toBe(403);
  });

  it("returns 400 when orderId is not valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const ctx = makeContext({ params: { orderId: "not-valid" } });
    const response = await DELETE(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 200 and calls cancelOrder on success", async () => {
    const fakeResult = { id: VALID_ORDER_ID, statusCode: "anulowane" };
    mockCancelOrder.mockResolvedValue(fakeResult);

    const ctx = makeContext();
    const response = await DELETE(ctx);

    expect(mockCancelOrder).toHaveBeenCalledWith(expect.anything(), MOCK_USER.id, VALID_ORDER_ID);
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 404 when cancelOrder returns null", async () => {
    mockCancelOrder.mockResolvedValue(null);

    const ctx = makeContext();
    const response = await DELETE(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 400 when cancelOrder throws FORBIDDEN_TRANSITION", async () => {
    mockCancelOrder.mockRejectedValue(new Error("FORBIDDEN_TRANSITION"));

    const ctx = makeContext();
    const response = await DELETE(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 500 on generic cancelOrder error", async () => {
    mockCancelOrder.mockRejectedValue(new Error("Unknown error"));

    const ctx = makeContext();
    const response = await DELETE(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

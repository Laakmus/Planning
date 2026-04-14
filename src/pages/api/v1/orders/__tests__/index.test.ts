/**
 * Testy dla GET /api/v1/orders i POST /api/v1/orders.
 *
 * Strategia: importujemy handlery bezpośrednio i wywołujemy z zamockowanym kontekstem.
 * Wszystkie zewnętrzne zależności (api-helpers, order.service, validator) są mockowane.
 *
 * Pokrywa:
 * GET:
 * - 500 gdy brak supabase w locals
 * - 401 gdy nie zalogowany
 * - 400 gdy nieprawidłowe query params
 * - 200 sukces (wywołuje listOrders)
 * - 500 gdy listOrders rzuci wyjątek
 *
 * POST:
 * - 401 gdy nie zalogowany
 * - 403 gdy READ_ONLY (requireWriteAccess zwraca błąd)
 * - 400 gdy JSON parse fail
 * - 400 gdy Zod validation fail
 * - 201 sukces
 * - 400 FK_VALIDATION
 * - 400 STOPS_LIMIT
 * - 400 STOPS_ORDER
 * - 500 generyczny błąd
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocki muszą być przed importami statycznymi (vitest hoistuje vi.mock)
// ---------------------------------------------------------------------------

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
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  getOrderDetail: vi.fn(),
  updateOrder: vi.fn(),
  duplicateOrder: vi.fn(),
  prepareEmailForOrder: vi.fn(),
}));

// Mock schema — safeParse kontrolujemy manualnie w testach
vi.mock("@/lib/validators/order.validator", () => ({
  orderListQuerySchema: { safeParse: vi.fn() },
  createOrderSchema: { safeParse: vi.fn() },
  updateOrderSchema: { safeParse: vi.fn() },
  changeStatusSchema: { safeParse: vi.fn() },
  duplicateOrderSchema: { safeParse: vi.fn() },
  prepareEmailSchema: { safeParse: vi.fn() },
}));

import { GET, POST } from "../index";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockParseQueryParams = vi.mocked(apiHelpers.parseQueryParams);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockListOrders = vi.mocked(orderService.listOrders);
const mockCreateOrder = vi.mocked(orderService.createOrder);
const mockOrderListQuerySchema = vi.mocked(orderValidator.orderListQuerySchema);
const mockCreateOrderSchema = vi.mocked(orderValidator.createOrderSchema);

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

function makeContext(overrides?: {
  params?: Record<string, string>;
  locals?: Record<string, unknown>;
  request?: Request;
}): Parameters<typeof GET>[0] {
  return {
    request: new Request("http://localhost:4321/api/v1/orders"),
    params: {},
    url: new URL("http://localhost:4321/api/v1/orders"),
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
    routePattern: "/api/v1/orders",
    originPathname: "/api/v1/orders",
    isPrerendered: false,
    clientAddress: "127.0.0.1",
    ...overrides,
    locals: { supabase: { from: vi.fn() }, ...overrides?.locals },
  } as unknown as Parameters<typeof GET>[0];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Domyślne implementacje — zwracają prawdziwe Response dla łatwej asercji
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

  // Domyślnie: autoryzacja OK
  mockGetAuth.mockResolvedValue(MOCK_USER);
  // Domyślnie: write access OK (null = brak błędu)
  mockRequireWriteAccess.mockReturnValue(null as never);
  // Domyślnie: UUID prawidłowe
  vi.mocked(apiHelpers.isValidUUID).mockReturnValue(true);
  // Domyślnie: parseQueryParams zwraca pusty obiekt
  mockParseQueryParams.mockReturnValue({});
  // Domyślnie: schematy przechodzą walidację
  mockOrderListQuerySchema.safeParse.mockReturnValue({
    success: true,
    data: { view: "CURRENT", page: 1, pageSize: 50 },
  } as ReturnType<typeof orderValidator.orderListQuerySchema.safeParse>);
  mockCreateOrderSchema.safeParse.mockReturnValue({
    success: true,
    data: { transportTypeCode: "PL", stops: [], items: [] },
  } as unknown as ReturnType<typeof orderValidator.createOrderSchema.safeParse>);
});

// ---------------------------------------------------------------------------
// GET /api/v1/orders
// ---------------------------------------------------------------------------

describe("GET /api/v1/orders", () => {
  it("returns 500 when locals.supabase is undefined", async () => {
    const ctx = makeContext({ locals: { supabase: undefined } });
    const response = await GET(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
    expect(response.status).toBe(500);
  });

  it("returns 401 when getAuthenticatedUser returns a Response", async () => {
    const unauth = new Response(null, { status: 401 });
    mockGetAuth.mockResolvedValue(unauth);

    const ctx = makeContext();
    const response = await GET(ctx);
    expect(response.status).toBe(401);
  });

  it("returns 400 when orderListQuerySchema.safeParse fails", async () => {
    mockOrderListQuerySchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["page"], message: "Expected number, received nan" }],
      },
    } as unknown as ReturnType<typeof orderValidator.orderListQuerySchema.safeParse>);

    const ctx = makeContext();
    const response = await GET(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String),
      expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 200 and calls listOrders on success", async () => {
    const fakeResult = { items: [], totalItems: 0, totalPages: 0, page: 1, pageSize: 50 };
    mockListOrders.mockResolvedValue(fakeResult);

    const ctx = makeContext();
    const response = await GET(ctx);

    expect(mockListOrders).toHaveBeenCalledOnce();
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 500 when listOrders throws an error", async () => {
    mockListOrders.mockRejectedValue(new Error("DB error"));

    const ctx = makeContext();
    const response = await GET(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/orders
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders", () => {
  it("returns 401 when getAuthenticatedUser returns a Response", async () => {
    const unauth = new Response(null, { status: 401 });
    mockGetAuth.mockResolvedValue(unauth);

    const ctx = makeContext();
    const response = await POST(ctx);
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns an error response", async () => {
    const forbiddenResp = new Response(null, { status: 403 });
    mockRequireWriteAccess.mockReturnValue(forbiddenResp as never);

    const ctx = makeContext();
    const response = await POST(ctx);
    expect(response.status).toBe(403);
  });

  it("returns 400 when parseJsonBody throws (invalid JSON)", async () => {
    mockParseJsonBody.mockRejectedValue(new SyntaxError("Invalid JSON"));

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String)
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when createOrderSchema.safeParse fails", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockCreateOrderSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["transportTypeCode"], message: "Required" }],
      },
    } as unknown as ReturnType<typeof orderValidator.createOrderSchema.safeParse>);

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String),
      expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 201 and result on success", async () => {
    mockParseJsonBody.mockResolvedValue({});
    const fakeOrder = { id: "order-uuid-1", orderNo: "Z/2026/001", statusCode: "nowe", statusName: "Nowe", createdAt: "2026-03-07T10:00:00Z" };
    mockCreateOrder.mockResolvedValue(fakeOrder);

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockCreateOrder).toHaveBeenCalledOnce();
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeOrder, 201);
    expect(response.status).toBe(201);
  });

  it("returns 400 when createOrder throws FK_VALIDATION", async () => {
    mockParseJsonBody.mockResolvedValue({});
    const err = Object.assign(new Error("FK_VALIDATION"), { details: { carrierId: "not found" } });
    mockCreateOrder.mockRejectedValue(err);

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String),
      expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when createOrder throws STOPS_LIMIT", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockCreateOrder.mockRejectedValue(new Error("STOPS_LIMIT"));

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when createOrder throws STOPS_ORDER", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockCreateOrder.mockRejectedValue(new Error("STOPS_ORDER"));

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 500 on generic createOrder error", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockCreateOrder.mockRejectedValue(new Error("Unexpected DB failure"));

    const ctx = makeContext();
    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(
      500,
      "Internal Server Error",
      expect.any(String)
    );
    expect(response.status).toBe(500);
  });
});

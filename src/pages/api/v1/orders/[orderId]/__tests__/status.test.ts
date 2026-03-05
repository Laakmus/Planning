/**
 * Testy dla POST /api/v1/orders/{orderId}/status — zmiana statusu.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 400 nieprawidłowy body JSON
 * - 400 Zod validation fail (pola inne niż complaintReason)
 * - 422 gdy complaintReason powoduje błąd walidacji (isComplaintReason)
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
}));

vi.mock("@/lib/services/order-status.service", () => ({
  cancelOrder: vi.fn(),
  changeStatus: vi.fn(),
  restoreOrder: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  changeStatusSchema: { safeParse: vi.fn() },
  updateOrderSchema: { safeParse: vi.fn() },
  createOrderSchema: { safeParse: vi.fn() },
  orderListQuerySchema: { safeParse: vi.fn() },
  duplicateOrderSchema: { safeParse: vi.fn() },
  prepareEmailSchema: { safeParse: vi.fn() },
}));

import { POST } from "../status";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderStatusService from "@/lib/services/order-status.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockChangeStatus = vi.mocked(orderStatusService.changeStatus);
const mockChangeStatusSchema = vi.mocked(orderValidator.changeStatusSchema);

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

function makeContext(): Parameters<typeof POST>[0] {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatusCode: "zrealizowane" }),
    }),
    params: { orderId: VALID_ORDER_ID },
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/status`),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as Parameters<typeof POST>[0]["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: "/api/v1/orders/[orderId]/status",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/status`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as Parameters<typeof POST>[0];
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
  mockParseJsonBody.mockResolvedValue({ newStatusCode: "zrealizowane" });

  // Domyślnie: schema przechodzi
  mockChangeStatusSchema.safeParse.mockReturnValue({
    success: true,
    data: { newStatusCode: "zrealizowane" },
  } as unknown as ReturnType<typeof orderValidator.changeStatusSchema.safeParse>);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/status", () => {
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

    const ctx = makeContext();
    (ctx as Record<string, unknown>).params = { orderId: "invalid-uuid" };

    const response = await POST(ctx);
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when JSON body parse fails", async () => {
    mockParseJsonBody.mockRejectedValue(new SyntaxError("Bad JSON"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails on non-complaintReason field", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockChangeStatusSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["newStatusCode"], message: "Invalid enum value" }],
      },
    } as unknown as ReturnType<typeof orderValidator.changeStatusSchema.safeParse>);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400, "Bad Request", expect.any(String), expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 422 when Zod validation fails on complaintReason field", async () => {
    mockParseJsonBody.mockResolvedValue({});
    mockChangeStatusSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [
          { path: ["complaintReason"], message: "complaintReason jest wymagane dla statusu reklamacja" },
        ],
      },
    } as unknown as ReturnType<typeof orderValidator.changeStatusSchema.safeParse>);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      422, "Unprocessable Entity", expect.any(String), expect.any(Object)
    );
    expect(response.status).toBe(422);
  });

  it("returns 200 on success", async () => {
    const fakeResult = { id: VALID_ORDER_ID, statusCode: "zrealizowane" };
    mockChangeStatus.mockResolvedValue(fakeResult);

    const response = await POST(makeContext());

    expect(mockChangeStatus).toHaveBeenCalledOnce();
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 404 when changeStatus returns null", async () => {
    mockChangeStatus.mockResolvedValue(null);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 400 when changeStatus throws FORBIDDEN_TRANSITION", async () => {
    mockChangeStatus.mockRejectedValue(new Error("FORBIDDEN_TRANSITION"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 500 on generic changeStatus error", async () => {
    mockChangeStatus.mockRejectedValue(new Error("DB timeout"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

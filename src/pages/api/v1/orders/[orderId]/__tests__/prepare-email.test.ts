/**
 * Testy dla POST /api/v1/orders/{orderId}/prepare-email.
 *
 * Uwaga: prepare-email.ts używa request.text() zamiast parseJsonBody.
 * Dlatego mockujemy Request bezpośrednio z odpowiednim body.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 400 nieprawidłowy body JSON (text parse)
 * - 400 Zod validation fail
 * - 200 sukces (result.success = true)
 * - 422 błędy walidacji biznesowej (result.success = false)
 * - 404 nie znaleziono (result === null)
 * - 400 NOT_ALLOWED_STATUS
 * - 409 STATUS_CHANGED
 * - 500 błąd serwera
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  requireWriteAccess: vi.fn(),
  isValidUUID: vi.fn(),
  logError: vi.fn(),
  COMMON_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  },
}));

vi.mock("@/lib/services/order.service", () => ({
  prepareEmailForOrder: vi.fn(),
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  getOrderDetail: vi.fn(),
  updateOrder: vi.fn(),
  duplicateOrder: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  prepareEmailSchema: { safeParse: vi.fn() },
  createOrderSchema: { safeParse: vi.fn() },
  updateOrderSchema: { safeParse: vi.fn() },
  orderListQuerySchema: { safeParse: vi.fn() },
  changeStatusSchema: { safeParse: vi.fn() },
  duplicateOrderSchema: { safeParse: vi.fn() },
}));

import { POST } from "../prepare-email";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockPrepareEmailForOrder = vi.mocked(orderService.prepareEmailForOrder);
const mockPrepareEmailSchema = vi.mocked(orderValidator.prepareEmailSchema);

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

/**
 * Tworzy kontekst z kontrolowanym body requestu.
 * prepare-email.ts używa request.text() bezpośrednio — nie parseJsonBody.
 */
function makeContext(bodyText = '{"forceRegeneratePdf":false}', overrides?: {
  params?: Record<string, string>;
}): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    // Tworzymy Request z jawnym tekstem body — handler go odczyta przez .text()
    request: new Request(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/prepare-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
    }),
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/prepare-email`),
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
    routePattern: "/api/v1/orders/[orderId]/prepare-email",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/prepare-email`,
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

  // Domyślnie: schemat przechodzi
  mockPrepareEmailSchema.safeParse.mockReturnValue({
    success: true,
    data: { forceRegeneratePdf: false },
  } as unknown as ReturnType<typeof orderValidator.prepareEmailSchema.safeParse>);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/prepare-email", () => {
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

    const response = await POST(makeContext("{}", { params: { orderId: "not-valid" } }));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when body JSON is malformed", async () => {
    // Nieprawidłowy JSON — request.text() zadziała, ale JSON.parse() rzuci
    const response = await POST(makeContext("{invalid json}"));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails", async () => {
    mockPrepareEmailSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["forceRegeneratePdf"], message: "Expected boolean" }],
      },
    } as unknown as ReturnType<typeof orderValidator.prepareEmailSchema.safeParse>);

    const response = await POST(makeContext('{"forceRegeneratePdf":"yes"}'));

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400, "Bad Request", expect.any(String), expect.any(Object)
    );
    expect(response.status).toBe(400);
  });

  it("returns 200 with .eml blob on success when result.success = true", async () => {
    const emlContent = "MIME-Version: 1.0\r\nX-Unsent: 1\r\n\r\nmock-eml";
    mockPrepareEmailForOrder.mockResolvedValue({
      success: true,
      format: "eml",
      emlContent,
      orderNo: "Z/2026/001",
    });

    const response = await POST(makeContext());

    expect(mockPrepareEmailForOrder).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("message/rfc822");
    expect(response.headers.get("Content-Disposition")).toContain("zlecenie-");
    expect(response.headers.get("Content-Disposition")).toContain(".eml");
    const body = await response.text();
    expect(body).toContain("X-Unsent: 1");
  });

  it("returns 422 when result.success = false (business validation errors)", async () => {
    const validationErrors = ["Brak adresu email przewoźnika", "Brak daty załadunku"];
    mockPrepareEmailForOrder.mockResolvedValue({
      success: false,
      validationErrors,
    });

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(
      422,
      "Unprocessable Entity",
      expect.any(String),
      { missing: validationErrors }
    );
    expect(response.status).toBe(422);
  });

  it("returns 404 when prepareEmailForOrder returns null", async () => {
    mockPrepareEmailForOrder.mockResolvedValue(null);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 400 when prepareEmailForOrder throws NOT_ALLOWED_STATUS", async () => {
    mockPrepareEmailForOrder.mockRejectedValue(new Error("NOT_ALLOWED_STATUS"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 409 when prepareEmailForOrder throws STATUS_CHANGED", async () => {
    mockPrepareEmailForOrder.mockRejectedValue(new Error("STATUS_CHANGED"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(409, "Conflict", expect.any(String));
    expect(response.status).toBe(409);
  });

  it("returns 500 on generic prepareEmailForOrder error", async () => {
    mockPrepareEmailForOrder.mockRejectedValue(new Error("Unexpected error"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("handles empty body gracefully (uses default empty object)", async () => {
    // Puste body — handler powinien użyć {} jako body
    mockPrepareEmailForOrder.mockResolvedValue({
      success: true,
      format: "eml",
      emlContent: "mock-eml",
      orderNo: "Z/2026/001",
    });

    const response = await POST(makeContext(""));

    // Nie powinno rzucić 400 dla pustego body — handler to obsługuje
    expect(response.status).toBe(200);
  });
});

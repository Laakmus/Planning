/**
 * Testy dla PATCH /api/v1/orders/{orderId}/carrier-color.
 *
 * Pokrycie:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 400 nieprawidłowy JSON (parseJsonBody rzuca)
 * - 400 nieprawidłowy kolor (Zod fail)
 * - 404 updateCarrierCellColor zwraca null
 * - 200 ustawienie koloru "#48A111"
 * - 200 usunięcie koloru (null)
 * - 500 błąd serwera
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mockowanie modułów
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
  updateCarrierCellColor: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  carrierCellColorSchema: {
    safeParse: vi.fn(),
  },
}));

import { PATCH } from "../carrier-color";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockUpdateCarrierCellColor = vi.mocked(orderService.updateCarrierCellColor);
const mockCarrierCellColorSchema = orderValidator.carrierCellColorSchema as unknown as {
  safeParse: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER_PLANNER = {
  id: "user-uuid-1",
  email: "planner@test.pl",
  fullName: "Planner User",
  phone: null,
  role: "PLANNER" as const,
  locationId: null,
};

const VALID_ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

type AnyAPIContext = Parameters<typeof PATCH>[0];

function makeContext(overrides?: {
  params?: Record<string, string>;
  locals?: Record<string, unknown>;
}): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() }, ...overrides?.locals },
    request: new Request(
      `http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/carrier-color`,
      { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }
    ),
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/carrier-color`),
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
    routePattern: "/api/v1/orders/[orderId]/carrier-color",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/carrier-color`,
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

  // Domyślnie: zalogowany planner, UUID poprawny
  mockGetAuth.mockResolvedValue(MOCK_USER_PLANNER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockIsValidUUID.mockReturnValue(true);

  // Domyślnie: parseJsonBody zwraca body z kolorem
  mockParseJsonBody.mockResolvedValue({ color: "#48A111" });

  // Domyślnie: Zod przechodzi
  mockCarrierCellColorSchema.safeParse.mockReturnValue({
    success: true,
    data: { color: "#48A111" },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/orders/{orderId}/carrier-color
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/orders/{orderId}/carrier-color", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error (READ_ONLY)", async () => {
    // Arrange
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(response.status).toBe(403);
  });

  it("returns 400 when orderId is not a valid UUID", async () => {
    // Arrange
    mockIsValidUUID.mockReturnValue(false);

    // Act
    const ctx = makeContext({ params: { orderId: "not-uuid" } });
    const response = await PATCH(ctx);

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when parseJsonBody throws (invalid JSON)", async () => {
    // Arrange
    mockParseJsonBody.mockRejectedValue(new Error("Invalid JSON"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when color is invalid (Zod validation fails)", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ color: "#ZZZZZZ" });
    mockCarrierCellColorSchema.safeParse.mockReturnValue({
      success: false,
      error: { issues: [{ path: ["color"], message: "Invalid color" }] },
    });

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 404 when updateCarrierCellColor returns null", async () => {
    // Arrange
    mockUpdateCarrierCellColor.mockResolvedValue(null as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 200 when setting color '#48A111'", async () => {
    // Arrange
    const fakeResult = { orderId: VALID_ORDER_ID, carrierCellColor: "#48A111" };
    mockUpdateCarrierCellColor.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockUpdateCarrierCellColor).toHaveBeenCalledWith(
      expect.anything(), // supabase
      VALID_ORDER_ID,
      "#48A111"
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 200 when removing color (null)", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ color: null });
    mockCarrierCellColorSchema.safeParse.mockReturnValue({
      success: true,
      data: { color: null },
    });
    const fakeResult = { orderId: VALID_ORDER_ID, carrierCellColor: null };
    mockUpdateCarrierCellColor.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockUpdateCarrierCellColor).toHaveBeenCalledWith(
      expect.anything(),
      VALID_ORDER_ID,
      null
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 500 on generic updateCarrierCellColor error", async () => {
    // Arrange
    mockUpdateCarrierCellColor.mockRejectedValue(new Error("DB timeout"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("returns 200 with different allowed color '#FFEF5F'", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ color: "#FFEF5F" });
    mockCarrierCellColorSchema.safeParse.mockReturnValue({
      success: true,
      data: { color: "#FFEF5F" },
    });
    const fakeResult = { orderId: VALID_ORDER_ID, carrierCellColor: "#FFEF5F" };
    mockUpdateCarrierCellColor.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockUpdateCarrierCellColor).toHaveBeenCalledWith(
      expect.anything(),
      VALID_ORDER_ID,
      "#FFEF5F"
    );
    expect(response.status).toBe(200);
  });
});

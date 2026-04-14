/**
 * Testy dla PATCH /api/v1/orders/{orderId}/entry-fixed.
 *
 * Pokrycie:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 400 nieprawidłowy JSON (parseJsonBody rzuca)
 * - 400 nieprawidłowa wartość (Zod fail)
 * - 404 updateEntryFixed zwraca null
 * - 200 ustawienie true
 * - 200 ustawienie false
 * - 200 ustawienie null
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
  updateEntryFixed: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  entryFixedSchema: {
    safeParse: vi.fn(),
  },
}));

import { PATCH } from "../entry-fixed";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockParseJsonBody = vi.mocked(apiHelpers.parseJsonBody);
const mockUpdateEntryFixed = vi.mocked(orderService.updateEntryFixed);
const mockEntryFixedSchema = orderValidator.entryFixedSchema as unknown as {
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
  username: "testuser",
  isActive: true,
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
      `http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/entry-fixed`,
      { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }
    ),
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/entry-fixed`),
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
    routePattern: "/api/v1/orders/[orderId]/entry-fixed",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/entry-fixed`,
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

  // Domyślnie: parseJsonBody zwraca body
  mockParseJsonBody.mockResolvedValue({ isEntryFixed: true });

  // Domyślnie: Zod przechodzi
  mockEntryFixedSchema.safeParse.mockReturnValue({
    success: true,
    data: { isEntryFixed: true },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/orders/{orderId}/entry-fixed
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/orders/{orderId}/entry-fixed", () => {
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

  it("returns 400 when isEntryFixed value is invalid (Zod validation fails)", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ isEntryFixed: "maybe" });
    mockEntryFixedSchema.safeParse.mockReturnValue({
      success: false,
      error: { issues: [{ path: ["isEntryFixed"], message: "Invalid value" }] },
    });

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 404 when updateEntryFixed returns null", async () => {
    // Arrange
    mockUpdateEntryFixed.mockResolvedValue(null as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 200 when setting isEntryFixed to true", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ isEntryFixed: true });
    mockEntryFixedSchema.safeParse.mockReturnValue({
      success: true,
      data: { isEntryFixed: true },
    });
    const fakeResult = { orderId: VALID_ORDER_ID, isEntryFixed: true };
    mockUpdateEntryFixed.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockUpdateEntryFixed).toHaveBeenCalledWith(
      expect.anything(), // supabase
      VALID_ORDER_ID,
      MOCK_USER_PLANNER.id,
      true
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 200 when setting isEntryFixed to false", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ isEntryFixed: false });
    mockEntryFixedSchema.safeParse.mockReturnValue({
      success: true,
      data: { isEntryFixed: false },
    });
    const fakeResult = { orderId: VALID_ORDER_ID, isEntryFixed: false };
    mockUpdateEntryFixed.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockUpdateEntryFixed).toHaveBeenCalledWith(
      expect.anything(),
      VALID_ORDER_ID,
      MOCK_USER_PLANNER.id,
      false
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 200 when setting isEntryFixed to null", async () => {
    // Arrange
    mockParseJsonBody.mockResolvedValue({ isEntryFixed: null });
    mockEntryFixedSchema.safeParse.mockReturnValue({
      success: true,
      data: { isEntryFixed: null },
    });
    const fakeResult = { orderId: VALID_ORDER_ID, isEntryFixed: null };
    mockUpdateEntryFixed.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockUpdateEntryFixed).toHaveBeenCalledWith(
      expect.anything(),
      VALID_ORDER_ID,
      MOCK_USER_PLANNER.id,
      null
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 500 on generic updateEntryFixed error", async () => {
    // Arrange
    mockUpdateEntryFixed.mockRejectedValue(new Error("Connection refused"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

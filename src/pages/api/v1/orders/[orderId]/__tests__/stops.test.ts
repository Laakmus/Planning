/**
 * Testy dla PATCH /api/v1/orders/{orderId}/stops/{stopId}.
 *
 * Pokrycie:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy orderId UUID
 * - 400 nieprawidłowy stopId UUID
 * - 400 nieprawidłowy JSON (request.text() + JSON.parse)
 * - 400 Zod fail (patchStopSchema.safeParse)
 * - 400 pusty body (Object.keys === 0)
 * - 404 patchStop zwraca null
 * - 400 READONLY error
 * - 409 FORBIDDEN_EDIT error
 * - 409 LOCKED error
 * - 400 INVALID_ROUTE_ORDER error
 * - 200 happy path — patch dateLocal
 * - 200 happy path — patch kind
 * - 200 happy path — patch locationId
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
  patchStop: vi.fn(),
}));

vi.mock("@/lib/validators/order.validator", () => ({
  patchStopSchema: {
    safeParse: vi.fn(),
  },
}));

import { PATCH } from "../stops/[stopId]";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as orderValidator from "@/lib/validators/order.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockPatchStop = vi.mocked(orderService.patchStop);
const mockPatchStopSchema = orderValidator.patchStopSchema as unknown as {
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

const MOCK_USER_ADMIN = {
  id: "admin-uuid-1",
  email: "admin@test.pl",
  fullName: "Admin User",
  phone: null,
  role: "ADMIN" as const,
  username: "testuser",
  isActive: true,
  locationId: null,
};

const VALID_ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_STOP_ID = "223e4567-e89b-12d3-a456-426614174001";

type AnyAPIContext = Parameters<typeof PATCH>[0];

/**
 * Buduje kontekst Astro API z opcjonalnymi nadpisaniami.
 * Domyślnie: body JSON z { dateLocal: "2026-03-05T10:00:00" }.
 */
function makeContext(overrides?: {
  params?: Record<string, string>;
  locals?: Record<string, unknown>;
  body?: string;
}): AnyAPIContext {
  const bodyStr = overrides?.body ?? JSON.stringify({ dateLocal: "2026-03-05T10:00:00" });
  return {
    locals: { supabase: { from: vi.fn() }, ...overrides?.locals },
    request: new Request(
      `http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/stops/${VALID_STOP_ID}`,
      { method: "PATCH", body: bodyStr, headers: { "Content-Type": "application/json" } }
    ),
    params: { orderId: VALID_ORDER_ID, stopId: VALID_STOP_ID, ...overrides?.params },
    url: new URL(
      `http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/stops/${VALID_STOP_ID}`
    ),
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
    routePattern: "/api/v1/orders/[orderId]/stops/[stopId]",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/stops/${VALID_STOP_ID}`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Domyślne implementacje helperów
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

  // Domyślnie: zalogowany planner, UUID-y poprawne
  mockGetAuth.mockResolvedValue(MOCK_USER_PLANNER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockIsValidUUID.mockReturnValue(true);

  // Domyślnie: Zod przechodzi z jednym polem
  mockPatchStopSchema.safeParse.mockReturnValue({
    success: true,
    data: { dateLocal: "2026-03-05T10:00:00" },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/orders/{orderId}/stops/{stopId}
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/orders/{orderId}/stops/{stopId}", () => {
  // --- Autentykacja i autoryzacja ---

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

  // --- Walidacja UUID ---

  it("returns 400 when orderId is not a valid UUID", async () => {
    // Arrange — pierwsze wywołanie isValidUUID (orderId) → false
    mockIsValidUUID.mockReturnValueOnce(false);

    // Act
    const ctx = makeContext({ params: { orderId: "bad-uuid", stopId: VALID_STOP_ID } });
    const response = await PATCH(ctx);

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when stopId is not a valid UUID", async () => {
    // Arrange — orderId OK (true), stopId FAIL (false)
    mockIsValidUUID.mockReturnValueOnce(true).mockReturnValueOnce(false);

    // Act
    const ctx = makeContext({ params: { orderId: VALID_ORDER_ID, stopId: "not-a-uuid" } });
    const response = await PATCH(ctx);

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  // --- Walidacja body JSON ---

  it("returns 400 when request body is invalid JSON", async () => {
    // Arrange — body z nieprawidłowym JSON
    const ctx = makeContext({ body: "{invalid-json" });

    // Act
    const response = await PATCH(ctx);

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails (patchStopSchema.safeParse)", async () => {
    // Arrange
    mockPatchStopSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["kind"], message: "Invalid enum value" }],
      },
    });

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String),
      expect.objectContaining({ kind: expect.any(Array) })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails with multiple issues", async () => {
    // Arrange
    mockPatchStopSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [
          { path: ["kind"], message: "Invalid enum" },
          { path: ["kind"], message: "Too short" },
          { path: ["dateLocal"], message: "Required" },
        ],
      },
    });

    // Act
    const response = await PATCH(makeContext());

    // Assert — grupowanie błędów po ścieżce
    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String),
      expect.objectContaining({
        kind: ["Invalid enum", "Too short"],
        dateLocal: ["Required"],
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when body is empty (no fields after Zod parse)", async () => {
    // Arrange — Zod przechodzi ale data pusty obiekt
    mockPatchStopSchema.safeParse.mockReturnValue({
      success: true,
      data: {},
    });

    // Act
    const ctx = makeContext({ body: "{}" });
    const response = await PATCH(ctx);

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  // --- Błędy serwisowe ---

  it("returns 404 when patchStop returns null (order or stop not found)", async () => {
    // Arrange
    mockPatchStop.mockResolvedValue(null as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 400 when patchStop throws READONLY error", async () => {
    // Arrange
    mockPatchStop.mockRejectedValue(new Error("READONLY"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 409 when patchStop throws FORBIDDEN_EDIT error", async () => {
    // Arrange
    mockPatchStop.mockRejectedValue(new Error("FORBIDDEN_EDIT"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(409, "Conflict", expect.any(String));
    expect(response.status).toBe(409);
  });

  it("returns 409 when patchStop throws LOCKED error", async () => {
    // Arrange
    mockPatchStop.mockRejectedValue(new Error("LOCKED"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(409, "Conflict", expect.any(String));
    expect(response.status).toBe(409);
  });

  it("returns 400 when patchStop throws INVALID_ROUTE_ORDER error", async () => {
    // Arrange
    mockPatchStop.mockRejectedValue(new Error("INVALID_ROUTE_ORDER"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 500 on generic patchStop error", async () => {
    // Arrange
    mockPatchStop.mockRejectedValue(new Error("DB connection lost"));

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  // --- Happy path ---

  it("returns 200 when patching dateLocal", async () => {
    // Arrange
    const patchData = { dateLocal: "2026-03-05T10:00:00" };
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: patchData });
    const fakeResult = { stopId: VALID_STOP_ID, dateLocal: "2026-03-05T10:00:00" };
    mockPatchStop.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext({ body: JSON.stringify(patchData) }));

    // Assert
    expect(mockPatchStop).toHaveBeenCalledWith(
      expect.anything(), // supabase
      MOCK_USER_PLANNER.id,
      VALID_ORDER_ID,
      VALID_STOP_ID,
      patchData
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 200 when patching kind", async () => {
    // Arrange
    const patchData = { kind: "UNLOADING" };
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: patchData });
    const fakeResult = { stopId: VALID_STOP_ID, kind: "UNLOADING" };
    mockPatchStop.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext({ body: JSON.stringify(patchData) }));

    // Assert
    expect(mockPatchStop).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_PLANNER.id,
      VALID_ORDER_ID,
      VALID_STOP_ID,
      patchData
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 200 when patching locationId", async () => {
    // Arrange
    const locationUuid = "443e4567-e89b-12d3-a456-426614174002";
    const patchData = { locationId: locationUuid };
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: patchData });
    const fakeResult = { stopId: VALID_STOP_ID, locationId: locationUuid };
    mockPatchStop.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext({ body: JSON.stringify(patchData) }));

    // Assert
    expect(mockPatchStop).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_PLANNER.id,
      VALID_ORDER_ID,
      VALID_STOP_ID,
      patchData
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  // --- Dodatkowe scenariusze ---

  it("calls patchStop with admin user id when admin is authenticated", async () => {
    // Arrange
    mockGetAuth.mockResolvedValue(MOCK_USER_ADMIN);
    const patchData = { dateLocal: "2026-04-01T08:00:00" };
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: patchData });
    const fakeResult = { stopId: VALID_STOP_ID, dateLocal: "2026-04-01T08:00:00" };
    mockPatchStop.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext());

    // Assert
    expect(mockPatchStop).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_ADMIN.id,
      VALID_ORDER_ID,
      VALID_STOP_ID,
      expect.any(Object)
    );
    expect(response.status).toBe(200);
  });

  it("handles empty string body (no JSON parse error, Zod validates empty obj)", async () => {
    // Arrange — pusty string body → nie wchodzi do JSON.parse (text.trim() === '')
    // body = {} → Zod safeParse wywoływane z {}
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: {} });

    // Act
    const ctx = makeContext({ body: "" });
    const response = await PATCH(ctx);

    // Assert — pusty data → 400 "co najmniej jedno pole"
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("handles whitespace-only body (treated as empty)", async () => {
    // Arrange — body z samymi spacjami
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: {} });

    // Act
    const ctx = makeContext({ body: "   " });
    const response = await PATCH(ctx);

    // Assert
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 500 when patchStop throws non-Error object", async () => {
    // Arrange — rzuca coś co nie jest Error
    mockPatchStop.mockRejectedValue("string error");

    // Act
    const response = await PATCH(makeContext());

    // Assert — msg === "" bo nie jest instancją Error → wchodzi do 500
    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("returns 200 when patching multiple fields at once", async () => {
    // Arrange
    const patchData = { dateLocal: "2026-03-05T10:00:00", kind: "LOADING" };
    mockPatchStopSchema.safeParse.mockReturnValue({ success: true, data: patchData });
    const fakeResult = { stopId: VALID_STOP_ID, ...patchData };
    mockPatchStop.mockResolvedValue(fakeResult as never);

    // Act
    const response = await PATCH(makeContext({ body: JSON.stringify(patchData) }));

    // Assert
    expect(mockPatchStop).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_PLANNER.id,
      VALID_ORDER_ID,
      VALID_STOP_ID,
      patchData
    );
    expect(response.status).toBe(200);
  });

  it("validates orderId before stopId (order matters)", async () => {
    // Arrange — oba UUID-y nieprawidłowe, ale orderId sprawdzany pierwszy
    mockIsValidUUID.mockReturnValue(false);

    // Act
    const ctx = makeContext({ params: { orderId: "bad1", stopId: "bad2" } });
    const response = await PATCH(ctx);

    // Assert — błąd dotyczy orderId (pierwszy check)
    expect(mockErrorResponse).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
    // isValidUUID wywołane tylko raz (orderId), bo wychodzi wcześniej
    expect(mockIsValidUUID).toHaveBeenCalledTimes(1);
  });
});

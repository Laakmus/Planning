/**
 * Testy dla POST /api/v1/orders/{orderId}/lock i POST /api/v1/orders/{orderId}/unlock.
 *
 * Lock:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 200 sukces
 * - 404 nie znaleziono
 * - 409 LOCK_CONFLICT
 * - 500 błąd serwera
 *
 * Unlock:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 400 nieprawidłowy UUID
 * - 200 sukces (canUnlockOther = true dla ADMIN)
 * - 404 nie znaleziono
 * - 403 FORBIDDEN_UNLOCK
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
}));

vi.mock("@/lib/services/order-lock.service", () => ({
  lockOrder: vi.fn(),
  unlockOrder: vi.fn(),
}));

import { POST as LockPOST } from "../lock";
import { POST as UnlockPOST } from "../unlock";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderLockService from "@/lib/services/order-lock.service";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockLockOrder = vi.mocked(orderLockService.lockOrder);
const mockUnlockOrder = vi.mocked(orderLockService.unlockOrder);

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

type AnyAPIContext = Parameters<typeof LockPOST>[0];

function makeContext(overrides?: {
  params?: Record<string, string>;
  locals?: Record<string, unknown>;
}): AnyAPIContext {
  return {
    request: new Request(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/lock`, {
      method: "POST",
    }),
    url: new URL(`http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/lock`),
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
    routePattern: "/api/v1/orders/[orderId]/lock",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/lock`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
    ...overrides,
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    locals: { supabase: { from: vi.fn() }, ...overrides?.locals },
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

  mockGetAuth.mockResolvedValue(MOCK_USER_PLANNER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockIsValidUUID.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// POST /lock
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/lock", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await LockPOST(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const response = await LockPOST(makeContext());
    expect(response.status).toBe(403);
  });

  it("returns 400 when orderId is not a valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const ctx = makeContext({ params: { orderId: "bad-uuid" } });
    const response = await LockPOST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 200 on successful lock", async () => {
    const fakeResult = { id: VALID_ORDER_ID, lockedByUserId: MOCK_USER_PLANNER.id, lockedAt: "2026-03-07T10:00:00Z" };
    mockLockOrder.mockResolvedValue(fakeResult);

    const response = await LockPOST(makeContext());

    expect(mockLockOrder).toHaveBeenCalledWith(expect.anything(), MOCK_USER_PLANNER.id, VALID_ORDER_ID);
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("returns 404 when lockOrder returns null", async () => {
    mockLockOrder.mockResolvedValue(null);

    const response = await LockPOST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 409 when lockOrder throws LOCK_CONFLICT", async () => {
    mockLockOrder.mockRejectedValue(new Error("LOCK_CONFLICT"));

    const response = await LockPOST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(409, "Conflict", expect.any(String));
    expect(response.status).toBe(409);
  });

  it("returns 500 on generic lockOrder error", async () => {
    mockLockOrder.mockRejectedValue(new Error("DB error"));

    const response = await LockPOST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /unlock
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/unlock", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await UnlockPOST(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const response = await UnlockPOST(makeContext());
    expect(response.status).toBe(403);
  });

  it("returns 400 when orderId is not a valid UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const ctx = makeContext({ params: { orderId: "not-uuid" } });
    const response = await UnlockPOST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 200 on successful unlock for PLANNER (canUnlockOther = false)", async () => {
    mockGetAuth.mockResolvedValue(MOCK_USER_PLANNER);
    const fakeResult = { id: VALID_ORDER_ID, lockedByUserId: null, lockedAt: null };
    mockUnlockOrder.mockResolvedValue(fakeResult);

    const response = await UnlockPOST(makeContext());

    // PLANNER: canUnlockOther powinno być false
    expect(mockUnlockOrder).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_PLANNER.id,
      VALID_ORDER_ID,
      false // canUnlockOther
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(fakeResult, 200);
    expect(response.status).toBe(200);
  });

  it("passes canUnlockOther = true when user is ADMIN", async () => {
    mockGetAuth.mockResolvedValue(MOCK_USER_ADMIN);
    const fakeResult = { id: VALID_ORDER_ID, lockedByUserId: null, lockedAt: null };
    mockUnlockOrder.mockResolvedValue(fakeResult);

    const response = await UnlockPOST(makeContext());

    expect(mockUnlockOrder).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER_ADMIN.id,
      VALID_ORDER_ID,
      true // canUnlockOther — ADMIN może odblokować cudzą blokadę
    );
    expect(response.status).toBe(200);
  });

  it("returns 404 when unlockOrder returns null", async () => {
    mockUnlockOrder.mockResolvedValue(null);

    const response = await UnlockPOST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("returns 403 when unlockOrder throws FORBIDDEN_UNLOCK", async () => {
    mockUnlockOrder.mockRejectedValue(new Error("FORBIDDEN_UNLOCK"));

    const response = await UnlockPOST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(403, "Forbidden", expect.any(String));
    expect(response.status).toBe(403);
  });

  it("returns 500 on generic unlockOrder error", async () => {
    mockUnlockOrder.mockRejectedValue(new Error("Connection reset"));

    const response = await UnlockPOST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });
});

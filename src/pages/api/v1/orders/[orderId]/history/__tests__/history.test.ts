/**
 * Testy endpointów history/status i history/changes (CR-01).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { GET as getStatus } from "../status";
import { GET as getChanges } from "../changes";
import { makeApiContext } from "@/test/helpers/api-context";

// Mock auth
vi.mock("@/lib/services/auth.service", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "admin@test.pl",
    fullName: "Admin Test",
    role: "ADMIN",
  username: "testuser",
  isActive: true,
    locationId: null,
  }),
}));

// Mock history service
const mockGetStatusHistory = vi.fn();
const mockGetChangeLog = vi.fn();
vi.mock("@/lib/services/order-history.service", () => ({
  getStatusHistory: (...args: unknown[]) => mockGetStatusHistory(...args),
  getChangeLog: (...args: unknown[]) => mockGetChangeLog(...args),
}));

const VALID_ORDER_ID = "00000000-0000-0000-0000-000000000001";
const INVALID_UUID = "not-a-uuid";

function ctx(orderId: string) {
  return makeApiContext({
    url: `/api/v1/orders/${orderId}/history/status`,
    params: { orderId },
  });
}

// ---------------------------------------------------------------------------
// history/status
// ---------------------------------------------------------------------------

describe("GET /api/v1/orders/{orderId}/history/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zwraca 400 dla nieprawidłowego UUID", async () => {
    const res = await getStatus(ctx(INVALID_UUID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Bad Request");
  });

  it("zwraca 401 gdy użytkownik niezalogowany", async () => {
    const { getCurrentUser } = await import("@/lib/services/auth.service");
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await getStatus(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(401);
  });

  it("zwraca 404 gdy zlecenie nie istnieje", async () => {
    mockGetStatusHistory.mockResolvedValueOnce(null);
    const res = await getStatus(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(404);
  });

  it("zwraca 200 z pustą listą gdy brak historii", async () => {
    mockGetStatusHistory.mockResolvedValueOnce([]);
    const res = await getStatus(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("zwraca 200 z listą wpisów historii statusu", async () => {
    mockGetStatusHistory.mockResolvedValueOnce([
      {
        id: "h-1",
        orderId: VALID_ORDER_ID,
        oldStatusCode: "robocze",
        newStatusCode: "wysłane",
        changedAt: "2026-03-01T10:00:00Z",
        changedByUserId: "user-1",
        changedByUserName: "Admin Test",
      },
    ]);
    const res = await getStatus(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].oldStatusCode).toBe("robocze");
    expect(body.items[0].newStatusCode).toBe("wysłane");
    expect(body.items[0].changedByUserName).toBe("Admin Test");
  });

  it("zwraca 500 gdy serwis rzuca błąd", async () => {
    mockGetStatusHistory.mockRejectedValueOnce(new Error("DB error"));
    const res = await getStatus(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// history/changes
// ---------------------------------------------------------------------------

describe("GET /api/v1/orders/{orderId}/history/changes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zwraca 400 dla nieprawidłowego UUID", async () => {
    const res = await getChanges(ctx(INVALID_UUID));
    expect(res.status).toBe(400);
  });

  it("zwraca 404 gdy zlecenie nie istnieje", async () => {
    mockGetChangeLog.mockResolvedValueOnce(null);
    const res = await getChanges(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(404);
  });

  it("zwraca 200 z pustą listą gdy brak zmian", async () => {
    mockGetChangeLog.mockResolvedValueOnce([]);
    const res = await getChanges(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("zwraca 200 z listą zmian pól", async () => {
    mockGetChangeLog.mockResolvedValueOnce([
      {
        id: "c-1",
        orderId: VALID_ORDER_ID,
        fieldName: "price_amount",
        oldValue: "100",
        newValue: "200",
        changedAt: "2026-03-01T10:00:00Z",
        changedByUserId: "user-1",
        changedByUserName: "Admin Test",
      },
      {
        id: "c-2",
        orderId: VALID_ORDER_ID,
        fieldName: "carrier_company_id",
        oldValue: null,
        newValue: "comp-1",
        changedAt: "2026-03-01T11:00:00Z",
        changedByUserId: "user-1",
        changedByUserName: "Admin Test",
      },
    ]);
    const res = await getChanges(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].fieldName).toBe("price_amount");
    expect(body.items[0].oldValue).toBe("100");
    expect(body.items[0].newValue).toBe("200");
    expect(body.items[1].oldValue).toBeNull();
  });

  it("zwraca 500 gdy serwis rzuca błąd", async () => {
    mockGetChangeLog.mockRejectedValueOnce(new Error("DB error"));
    const res = await getChanges(ctx(VALID_ORDER_ID));
    expect(res.status).toBe(500);
  });
});

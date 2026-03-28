/**
 * Testy hooka useOrderHistory.
 * Sprawdza równoległe pobieranie historii statusów i logu zmian,
 * obsługę null orderId, błędów oraz mechanizm stale-prevention.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocki
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockApi = { get: mockGet };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ api: mockApi }),
}));

import { useOrderHistory } from "../useOrderHistory";
import type { StatusHistoryItemDto, ChangeLogItemDto, ListResponse } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORDER_ID = "order-uuid-history-test";

const MOCK_STATUS_HISTORY: StatusHistoryItemDto[] = [
  {
    id: 1,
    orderId: ORDER_ID,
    oldStatusCode: "robocze",
    newStatusCode: "wysłane",
    changedAt: "2026-03-02T09:00:00Z",
    changedByUserId: "user-uuid-1",
    changedByUserName: "Jan Kowalski",
  },
  {
    id: 2,
    orderId: ORDER_ID,
    oldStatusCode: "wysłane",
    newStatusCode: "zrealizowane",
    changedAt: "2026-03-03T14:30:00Z",
    changedByUserId: "user-uuid-1",
    changedByUserName: "Jan Kowalski",
  },
];

const MOCK_CHANGE_LOG: ChangeLogItemDto[] = [
  {
    id: 10,
    orderId: ORDER_ID,
    fieldName: "priceAmount",
    oldValue: "1500",
    newValue: "2000",
    changedAt: "2026-03-01T12:00:00Z",
    changedByUserId: "user-uuid-2",
    changedByUserName: "Anna Nowak",
  },
];

const MOCK_STATUS_RESPONSE: ListResponse<StatusHistoryItemDto> = {
  items: MOCK_STATUS_HISTORY,
};

const MOCK_CHANGES_RESPONSE: ListResponse<ChangeLogItemDto> = {
  items: MOCK_CHANGE_LOG,
};

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useOrderHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // orderId = null
  // -------------------------------------------------------------------------

  it("returns empty arrays when orderId is null", () => {
    const { result } = renderHook(() => useOrderHistory(null));

    expect(result.current.statusHistory).toEqual([]);
    expect(result.current.changeLog).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not call api.get when orderId is null", () => {
    renderHook(() => useOrderHistory(null));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("resets to empty arrays when orderId changes to null", async () => {
    mockGet
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    const { result, rerender } = renderHook(
      ({ id }) => useOrderHistory(id),
      { initialProps: { id: ORDER_ID as string | null } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statusHistory).toHaveLength(2);

    rerender({ id: null });

    expect(result.current.statusHistory).toEqual([]);
    expect(result.current.changeLog).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Stan podczas ładowania
  // -------------------------------------------------------------------------

  it("sets isLoading=true when orderId provided and fetch starts", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    expect(result.current.isLoading).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Równoległe pobieranie danych (Promise.all)
  // -------------------------------------------------------------------------

  it("calls both history endpoints in parallel", async () => {
    mockGet
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    const endpoints = mockGet.mock.calls.map(([url]) => url);
    expect(endpoints).toContain(`/api/v1/orders/${ORDER_ID}/history/status`);
    expect(endpoints).toContain(`/api/v1/orders/${ORDER_ID}/history/changes`);
  });

  it("sets statusHistory and changeLog on successful parallel fetch", async () => {
    mockGet
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.statusHistory).toEqual(MOCK_STATUS_HISTORY);
    expect(result.current.changeLog).toEqual(MOCK_CHANGE_LOG);
    expect(result.current.error).toBeNull();
  });

  it("handles empty history and change log", async () => {
    mockGet
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.statusHistory).toEqual([]);
    expect(result.current.changeLog).toEqual([]);
  });

  it("exposes refetch function", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    expect(typeof result.current.refetch).toBe("function");
  });

  // -------------------------------------------------------------------------
  // Obsługa błędów
  // -------------------------------------------------------------------------

  it("sets error when status history endpoint fails", async () => {
    mockGet
      .mockRejectedValueOnce(new Error("Status endpoint niedostępny"))
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Status endpoint niedostępny");
    expect(result.current.statusHistory).toEqual([]);
    expect(result.current.changeLog).toEqual([]);
  });

  it("sets error when changes endpoint fails", async () => {
    mockGet
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockRejectedValueOnce(new Error("Changes endpoint niedostępny"));

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Changes endpoint niedostępny");
  });

  it("sets fallback error on non-Error exception", async () => {
    mockGet
      .mockRejectedValueOnce("server error")
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Błąd pobierania historii zlecenia.");
  });

  it("clears error on successful refetch after failure", async () => {
    mockGet
      .mockRejectedValueOnce(new Error("Błąd sieci"))
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.statusHistory).toEqual(MOCK_STATUS_HISTORY);
  });

  // -------------------------------------------------------------------------
  // Refetch
  // -------------------------------------------------------------------------

  it("refetch calls both endpoints again", async () => {
    mockGet
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE)
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE);

    const { result } = renderHook(() => useOrderHistory(ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGet).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGet).toHaveBeenCalledTimes(4);
  });

  it("re-fetches when orderId changes", async () => {
    const OTHER_ID = "order-uuid-other-456";

    mockGet
      .mockResolvedValueOnce(MOCK_STATUS_RESPONSE)
      .mockResolvedValueOnce(MOCK_CHANGES_RESPONSE)
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] });

    const { rerender } = renderHook(
      ({ id }) => useOrderHistory(id),
      { initialProps: { id: ORDER_ID } }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    rerender({ id: OTHER_ID });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4));

    const endpointsAfterChange = mockGet.mock.calls
      .slice(2)
      .map(([url]) => url);
    expect(endpointsAfterChange).toContain(
      `/api/v1/orders/${OTHER_ID}/history/status`
    );
    expect(endpointsAfterChange).toContain(
      `/api/v1/orders/${OTHER_ID}/history/changes`
    );
  });

  // -------------------------------------------------------------------------
  // Mechanizm stale-prevention
  // -------------------------------------------------------------------------

  it("does not update state after unmount (stale prevention)", async () => {
    let resolveStatus!: (v: ListResponse<StatusHistoryItemDto>) => void;
    let resolveChanges!: (v: ListResponse<ChangeLogItemDto>) => void;

    mockGet
      .mockReturnValueOnce(
        new Promise<ListResponse<StatusHistoryItemDto>>((res) => { resolveStatus = res; })
      )
      .mockReturnValueOnce(
        new Promise<ListResponse<ChangeLogItemDto>>((res) => { resolveChanges = res; })
      );

    const { result, unmount } = renderHook(() => useOrderHistory(ORDER_ID));

    unmount();

    await act(async () => {
      resolveStatus(MOCK_STATUS_RESPONSE);
      resolveChanges(MOCK_CHANGES_RESPONSE);
    });

    // Po odmontowaniu stan nie powinien zostać zaktualizowany
    expect(result.current.statusHistory).toEqual([]);
    expect(result.current.changeLog).toEqual([]);
  });
});

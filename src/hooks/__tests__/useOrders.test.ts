/**
 * Testy hooka useOrders.
 * Sprawdza pobieranie listy zleceń, przeliczanie numeru tygodnia,
 * obsługę błędów oraz mechanizm stale-prevention.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocki — vi.hoisted() zapewnia dostępność zmiennych przed hoistingiem vi.mock()
// ---------------------------------------------------------------------------

const { mockGet, mockApi, mockWeekNumberToDateRange } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockWeekNumberToDateRange = vi.fn();
  return {
    mockGet,
    mockApi: { get: mockGet },
    mockWeekNumberToDateRange,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ api: mockApi }),
}));

vi.mock("@/lib/week-utils", () => ({
  weekNumberToDateRange: mockWeekNumberToDateRange,
}));

// Importy po zamockowaniu
import { useOrders } from "../useOrders";
import type { OrderListFilters } from "@/lib/view-models";
import type { OrderListResponseDto } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Domyślne filtry dla testów */
const DEFAULT_FILTERS: OrderListFilters = {
  view: "CURRENT",
  pageSize: 20,
  sortBy: "FIRST_LOADING_DATETIME",
  sortDirection: "ASC",
  transportType: undefined,
  status: undefined,
  carrierId: undefined,
  productId: undefined,
  loadingLocationId: undefined,
  loadingCompanyId: undefined,
  unloadingLocationId: undefined,
  unloadingCompanyId: undefined,
  search: undefined,
  weekNumber: undefined,
  dateFrom: undefined,
  dateTo: undefined,
};

/** Przykładowa odpowiedź listy zleceń */
const MOCK_RESPONSE: OrderListResponseDto = {
  items: [
    {
      id: "order-uuid-1",
      orderNo: "ZL/2026/001",
      statusCode: "robocze",
      statusName: "Robocze",
      viewGroup: "CURRENT",
      transportTypeCode: "PL",
      transportTypeName: "Krajowy",
      summaryRoute: "Warszawa → Kraków",
      stops: [],
      firstLoadingDate: "2026-03-10",
      firstLoadingTime: "08:00",
      firstUnloadingDate: "2026-03-10",
      firstUnloadingTime: "16:00",
      lastLoadingDate: "2026-03-10",
      lastLoadingTime: "08:00",
      lastUnloadingDate: "2026-03-10",
      lastUnloadingTime: "16:00",
      weekNumber: 11,
      carrierCompanyId: null,
      carrierName: null,
      mainProductName: "Węgiel",
      items: [],
      priceAmount: 1500,
      currencyCode: "PLN",
      vehicleTypeText: null,
      vehicleCapacityVolumeM3: null,
      isEntryFixed: null,
      requiredDocumentsText: null,
      generalNotes: null,
      sentByUserName: null,
      sentAt: null,
      lockedByUserId: null,
      lockedByUserName: null,
      lockedAt: null,
      createdAt: "2026-03-01T10:00:00Z",
      createdByUserId: "user-uuid-1",
      createdByUserName: "Jan Kowalski",
      updatedAt: "2026-03-01T10:00:00Z",
      updatedByUserId: null,
      updatedByUserName: null,
      carrierCellColor: null,
    },
  ],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
};

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Stan początkowy
  // -------------------------------------------------------------------------

  it("starts with isLoading=true and no data", () => {
    // Trzymaj promise nieskończoną — nie zwracaj odpowiedzi
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("exposes refetch function", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    expect(typeof result.current.refetch).toBe("function");
  });

  // -------------------------------------------------------------------------
  // Pomyślne pobranie danych
  // -------------------------------------------------------------------------

  it("sets data and clears loading on successful fetch", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(MOCK_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  it("calls api.get with correct endpoint", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [endpoint] = mockGet.mock.calls[0];
    expect(endpoint).toBe("/api/v1/orders");
  });

  it("passes view, page and pageSize params to api.get", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() =>
      useOrders({ ...DEFAULT_FILTERS, view: "COMPLETED", pageSize: 10 }, 3)
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.view).toBe("COMPLETED");
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(10);
  });

  it("passes sortBy and sortDirection params", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() =>
      useOrders(
        { ...DEFAULT_FILTERS, sortBy: "ORDER_NO", sortDirection: "DESC" },
        1
      )
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.sortBy).toBe("ORDER_NO");
    expect(params.sortDirection).toBe("DESC");
  });

  it("trims search string before passing to api", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() =>
      useOrders({ ...DEFAULT_FILTERS, search: "  kowalski  " }, 1)
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.search).toBe("kowalski");
  });

  it("sets search to undefined when string is empty/whitespace", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() =>
      useOrders({ ...DEFAULT_FILTERS, search: "   " }, 1)
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.search).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // weekNumber — przeliczanie na zakres dat
  // -------------------------------------------------------------------------

  it("converts weekNumber to dateFrom/dateTo when weekNumber is set", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);
    mockWeekNumberToDateRange.mockReturnValue({
      dateFrom: "2026-03-09",
      dateTo: "2026-03-15",
    });

    renderHook(() =>
      useOrders({ ...DEFAULT_FILTERS, weekNumber: "11" }, 1)
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockWeekNumberToDateRange).toHaveBeenCalledWith("11");

    const [, params] = mockGet.mock.calls[0];
    expect(params.dateFrom).toBe("2026-03-09");
    expect(params.dateTo).toBe("2026-03-15");
  });

  it("ignores direct dateFrom/dateTo when weekNumber is set", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);
    mockWeekNumberToDateRange.mockReturnValue({
      dateFrom: "2026-03-09",
      dateTo: "2026-03-15",
    });

    renderHook(() =>
      useOrders(
        {
          ...DEFAULT_FILTERS,
          weekNumber: "11",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-07",
        },
        1
      )
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    // Wartości z weekNumber, nie z filtrów bezpośrednich
    expect(params.dateFrom).toBe("2026-03-09");
    expect(params.dateTo).toBe("2026-03-15");
  });

  it("uses direct dateFrom/dateTo when weekNumber is absent", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() =>
      useOrders(
        {
          ...DEFAULT_FILTERS,
          weekNumber: undefined,
          dateFrom: "2026-03-01",
          dateTo: "2026-03-31",
        },
        1
      )
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.dateFrom).toBe("2026-03-01");
    expect(params.dateTo).toBe("2026-03-31");
    expect(mockWeekNumberToDateRange).not.toHaveBeenCalled();
  });

  it("ignores weekNumber when it is whitespace only", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    renderHook(() =>
      useOrders({ ...DEFAULT_FILTERS, weekNumber: "   " }, 1)
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockWeekNumberToDateRange).not.toHaveBeenCalled();
  });

  it("does not set dateFrom/dateTo when weekNumberToDateRange returns null", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);
    mockWeekNumberToDateRange.mockReturnValue(null);

    renderHook(() =>
      useOrders({ ...DEFAULT_FILTERS, weekNumber: "99" }, 1)
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.dateFrom).toBeUndefined();
    expect(params.dateTo).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Obsługa błędów
  // -------------------------------------------------------------------------

  it("sets error message on api failure (Error instance)", async () => {
    mockGet.mockRejectedValue(new Error("Serwer niedostępny"));

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Serwer niedostępny");
    expect(result.current.data).toBeNull();
  });

  it("sets fallback error message on non-Error exception", async () => {
    mockGet.mockRejectedValue("string error");

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Błąd pobierania listy zleceń.");
  });

  it("clears error on successful refetch after failure", async () => {
    mockGet.mockRejectedValueOnce(new Error("Błąd sieciowy"));
    mockGet.mockResolvedValueOnce(MOCK_RESPONSE);

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Błąd sieciowy");

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(MOCK_RESPONSE);
  });

  // -------------------------------------------------------------------------
  // Refetch
  // -------------------------------------------------------------------------

  it("refetch triggers another api.get call", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Mechanizm stale-prevention
  // -------------------------------------------------------------------------

  it("does not update state after unmount (stale prevention)", async () => {
    let resolveRequest!: (v: OrderListResponseDto) => void;
    const pendingPromise = new Promise<OrderListResponseDto>((res) => {
      resolveRequest = res;
    });
    mockGet.mockReturnValue(pendingPromise);

    const { result, unmount } = renderHook(() => useOrders(DEFAULT_FILTERS, 1));

    // Odmontuj przed zakończeniem promise
    unmount();

    // Zakończ promise po odmontowaniu
    await act(async () => {
      resolveRequest(MOCK_RESPONSE);
    });

    // Stan nie powinien zostać zaktualizowany (brak błędów React)
    expect(result.current.data).toBeNull();
  });

  it("re-fetches when page changes", async () => {
    mockGet.mockResolvedValue(MOCK_RESPONSE);

    const { rerender } = renderHook(
      ({ page }) => useOrders(DEFAULT_FILTERS, page),
      { initialProps: { page: 1 } }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    rerender({ page: 2 });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    const [, paramsCall2] = mockGet.mock.calls[1];
    expect(paramsCall2.page).toBe(2);
  });
});

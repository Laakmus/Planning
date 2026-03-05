/**
 * Testy hooka useWarehouseWeek.
 * Sprawdza inicjalizację ze stanu URL, nawigację tydzień +/-,
 * rollover tygodni (1→52, 52→1), przekazywanie locationId do API,
 * obsługę błędów i mechanizm stale-prevention.
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

// Mock window.history.replaceState, żeby testy nie wymagały pełnego środowiska
const mockReplaceState = vi.fn();
Object.defineProperty(window, "history", {
  value: { replaceState: mockReplaceState },
  writable: true,
});

import { useWarehouseWeek } from "../useWarehouseWeek";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ustaw URL window.location.search i href */
function setWindowLocation(search: string) {
  Object.defineProperty(window, "location", {
    value: {
      search,
      href: `http://localhost/warehouse${search}`,
    },
    writable: true,
    configurable: true,
  });
}

/** Przykładowa odpowiedź API dla widoku magazynowego */
const makeMockResponse = (week: number, year: number) => ({
  week,
  year,
  weekStart: "2026-03-09",
  weekEnd: "2026-03-15",
  locationName: "Magazyn Centralny",
  days: [],
  noDateEntries: [],
  summary: {
    loadingCount: 0,
    loadingTotalTons: 0,
    unloadingCount: 5,
    unloadingTotalTons: 20,
  },
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useWarehouseWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Domyślnie: brak parametrów w URL — hook używa getCurrentISOWeek()
    setWindowLocation("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Stan początkowy
  // -------------------------------------------------------------------------

  it("starts with isLoading=true", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWarehouseWeek());

    expect(result.current.isLoading).toBe(true);
  });

  it("starts with null data and no error", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWarehouseWeek());

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("exposes week, year, prevWeek, nextWeek, goToWeek", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWarehouseWeek());

    expect(typeof result.current.week).toBe("number");
    expect(typeof result.current.year).toBe("number");
    expect(typeof result.current.prevWeek).toBe("function");
    expect(typeof result.current.nextWeek).toBe("function");
    expect(typeof result.current.goToWeek).toBe("function");
  });

  // -------------------------------------------------------------------------
  // Inicjalizacja z URL
  // -------------------------------------------------------------------------

  it("reads week and year from URL search params", () => {
    setWindowLocation("?week=10&year=2026");
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWarehouseWeek());

    expect(result.current.week).toBe(10);
    expect(result.current.year).toBe(2026);
  });

  it("uses current ISO week when URL params are missing", () => {
    setWindowLocation("");
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWarehouseWeek());

    // Tydzień powinien być w zakresie 1–53
    expect(result.current.week).toBeGreaterThanOrEqual(1);
    expect(result.current.week).toBeLessThanOrEqual(53);
    // Rok powinien być rozsądnym rokiem
    expect(result.current.year).toBeGreaterThanOrEqual(2020);
  });

  it("falls back to current week when URL week param is invalid", () => {
    setWindowLocation("?week=abc&year=2026");
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWarehouseWeek());

    // Powinien wrócić do bieżącego tygodnia (nie NaN)
    expect(Number.isNaN(result.current.week)).toBe(false);
    expect(result.current.week).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Pobieranie danych
  // -------------------------------------------------------------------------

  it("calls api.get with correct endpoint and params", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [endpoint, params] = mockGet.mock.calls[0];
    expect(endpoint).toBe("/api/v1/warehouse/orders");
    expect(params.week).toBe(11);
    expect(params.year).toBe(2026);
  });

  it("sets data and clears loading on successful fetch", async () => {
    setWindowLocation("?week=11&year=2026");
    const mockResponse = makeMockResponse(11, 2026);
    mockGet.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it("passes locationId to api when provided", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    renderHook(() => useWarehouseWeek("location-uuid-789"));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.locationId).toBe("location-uuid-789");
  });

  it("does not include locationId in params when undefined", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, params] = mockGet.mock.calls[0];
    expect(params.locationId).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Obsługa błędów
  // -------------------------------------------------------------------------

  it("sets error on api failure (Error instance)", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockRejectedValue(new Error("Serwer niedostępny"));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Serwer niedostępny");
    expect(result.current.data).toBeNull();
  });

  it("sets fallback error on non-Error exception", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockRejectedValue("network error");

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Błąd ładowania danych");
  });

  // -------------------------------------------------------------------------
  // Nawigacja: prevWeek / nextWeek / goToWeek
  // -------------------------------------------------------------------------

  it("prevWeek decrements week by 1", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGet.mockResolvedValue(makeMockResponse(10, 2026));

    act(() => {
      result.current.prevWeek();
    });

    expect(result.current.week).toBe(10);
    expect(result.current.year).toBe(2026);
  });

  it("nextWeek increments week by 1", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGet.mockResolvedValue(makeMockResponse(12, 2026));

    act(() => {
      result.current.nextWeek();
    });

    expect(result.current.week).toBe(12);
    expect(result.current.year).toBe(2026);
  });

  it("goToWeek sets specific week number", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGet.mockResolvedValue(makeMockResponse(25, 2026));

    act(() => {
      result.current.goToWeek(25);
    });

    expect(result.current.week).toBe(25);
  });

  it("goToWeek ignores values below 1", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.goToWeek(0);
    });

    expect(result.current.week).toBe(11); // bez zmiany
  });

  it("goToWeek ignores values above 53", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.goToWeek(54);
    });

    expect(result.current.week).toBe(11); // bez zmiany
  });

  // -------------------------------------------------------------------------
  // Rollover tygodni
  // -------------------------------------------------------------------------

  it("prevWeek from week 1 rolls over to week 52 of previous year", async () => {
    setWindowLocation("?week=1&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(1, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGet.mockResolvedValue(makeMockResponse(52, 2025));

    act(() => {
      result.current.prevWeek();
    });

    expect(result.current.week).toBe(52);
    expect(result.current.year).toBe(2025);
  });

  it("nextWeek from week 52 rolls over to week 1 of next year", async () => {
    setWindowLocation("?week=52&year=2025");
    mockGet.mockResolvedValue(makeMockResponse(52, 2025));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGet.mockResolvedValue(makeMockResponse(1, 2026));

    act(() => {
      result.current.nextWeek();
    });

    expect(result.current.week).toBe(1);
    expect(result.current.year).toBe(2026);
  });

  // -------------------------------------------------------------------------
  // Re-fetch po zmianie tygodnia/roku
  // -------------------------------------------------------------------------

  it("re-fetches when week changes via navigation", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { result } = renderHook(() => useWarehouseWeek());

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    mockGet.mockResolvedValue(makeMockResponse(12, 2026));

    act(() => {
      result.current.nextWeek();
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    const [, paramsSecond] = mockGet.mock.calls[1];
    expect(paramsSecond.week).toBe(12);
  });

  it("re-fetches when locationId changes", async () => {
    setWindowLocation("?week=11&year=2026");
    mockGet.mockResolvedValue(makeMockResponse(11, 2026));

    const { rerender } = renderHook(
      ({ locationId }) => useWarehouseWeek(locationId),
      { initialProps: { locationId: undefined as string | undefined } }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    rerender({ locationId: "loc-uuid-new" });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    const [, paramsSecond] = mockGet.mock.calls[1];
    expect(paramsSecond.locationId).toBe("loc-uuid-new");
  });

  // -------------------------------------------------------------------------
  // Mechanizm stale-prevention
  // -------------------------------------------------------------------------

  it("does not update state after unmount (stale prevention)", async () => {
    setWindowLocation("?week=11&year=2026");

    let resolveRequest!: (v: any) => void;
    const pendingPromise = new Promise((res) => {
      resolveRequest = res;
    });
    mockGet.mockReturnValue(pendingPromise);

    const { result, unmount } = renderHook(() => useWarehouseWeek());

    unmount();

    await act(async () => {
      resolveRequest(makeMockResponse(11, 2026));
    });

    // Po odmontowaniu dane nie powinny zostać ustawione
    expect(result.current.data).toBeNull();
  });
});

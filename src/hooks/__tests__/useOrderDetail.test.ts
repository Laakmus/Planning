/**
 * Testy hooka useOrderDetail.
 * Sprawdza pobieranie szczegółów zlecenia, obsługę null orderId,
 * obsługę błędów oraz mechanizm stale-prevention.
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

import { useOrderDetail } from "../useOrderDetail";
import type { OrderDetailResponseDto } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ORDER_ID = "order-uuid-abc123";

const MOCK_DETAIL: OrderDetailResponseDto = {
  order: {
    id: MOCK_ORDER_ID,
    orderNo: "ZL/2026/042",
    statusCode: "wysłane",
    transportTypeCode: "PL",
    currencyCode: "PLN",
    priceAmount: 2000,
    paymentTermDays: 30,
    paymentMethod: "przelew",
    totalLoadTons: 10,
    totalLoadVolumeM3: 20,
    summaryRoute: "Warszawa → Kraków",
    firstLoadingDate: "2026-03-10",
    firstLoadingTime: "08:00",
    firstUnloadingDate: "2026-03-10",
    firstUnloadingTime: "16:00",
    lastLoadingDate: "2026-03-10",
    lastLoadingTime: "08:00",
    lastUnloadingDate: "2026-03-10",
    lastUnloadingTime: "16:00",
    transportYear: 2026,
    firstLoadingCountry: "PL",
    firstUnloadingCountry: "PL",
    carrierCompanyId: null,
    carrierNameSnapshot: null,
    carrierLocationNameSnapshot: null,
    carrierAddressSnapshot: null,
    shipperLocationId: null,
    shipperNameSnapshot: null,
    shipperAddressSnapshot: null,
    receiverLocationId: null,
    receiverNameSnapshot: null,
    receiverAddressSnapshot: null,
    vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
    mainProductName: "Węgiel",
    specialRequirements: null,
    requiredDocumentsText: null,
    generalNotes: null,
    complaintReason: null,
    senderContactName: null,
    senderContactPhone: null,
    senderContactEmail: null,
    createdAt: "2026-03-01T10:00:00Z",
    createdByUserId: "user-uuid-1",
    updatedAt: "2026-03-01T10:00:00Z",
    updatedByUserId: null,
    lockedByUserId: null,
    lockedAt: null,
    statusName: "Wysłane",
    weekNumber: 11,
    sentAt: null,
    sentByUserName: null,
    createdByUserName: "Jan Kowalski",
    updatedByUserName: null,
    lockedByUserName: null,
  },
  stops: [],
  items: [],
};

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useOrderDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // orderId = null
  // -------------------------------------------------------------------------

  it("returns null data and no loading when orderId is null", () => {
    const { result } = renderHook(() => useOrderDetail(null));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not call api.get when orderId is null", () => {
    renderHook(() => useOrderDetail(null));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("resets data when orderId changes from value to null", async () => {
    mockGet.mockResolvedValue(MOCK_DETAIL);

    const { result, rerender } = renderHook(
      ({ id }) => useOrderDetail(id),
      { initialProps: { id: MOCK_ORDER_ID as string | null } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).not.toBeNull();

    rerender({ id: null });

    // Po zmianie na null dane powinny zostać wyczyszczone
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Stan podczas ładowania
  // -------------------------------------------------------------------------

  it("sets isLoading=true when orderId is provided and fetch starts", async () => {
    // Promise nigdy się nie rozwiązuje
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    // isLoading powinno być true zanim promise się zakończy
    expect(result.current.isLoading).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Pomyślne pobranie danych
  // -------------------------------------------------------------------------

  it("fetches detail from correct endpoint", async () => {
    mockGet.mockResolvedValue(MOCK_DETAIL);

    renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [endpoint] = mockGet.mock.calls[0];
    expect(endpoint).toBe(`/api/v1/orders/${MOCK_ORDER_ID}`);
  });

  it("sets data on successful fetch and clears loading", async () => {
    mockGet.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(MOCK_DETAIL);
    expect(result.current.error).toBeNull();
  });

  it("exposes refetch function", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    expect(typeof result.current.refetch).toBe("function");
  });

  // -------------------------------------------------------------------------
  // Obsługa błędów
  // -------------------------------------------------------------------------

  it("sets error message on api failure (Error instance)", async () => {
    mockGet.mockRejectedValue(new Error("Zlecenie nie istnieje"));

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Zlecenie nie istnieje");
    expect(result.current.data).toBeNull();
  });

  it("sets fallback error on non-Error exception", async () => {
    mockGet.mockRejectedValue(500);

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Błąd pobierania danych zlecenia.");
  });

  it("clears error on successful refetch", async () => {
    mockGet.mockRejectedValueOnce(new Error("Błąd sieci"));
    mockGet.mockResolvedValueOnce(MOCK_DETAIL);

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Błąd sieci");

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(MOCK_DETAIL);
  });

  // -------------------------------------------------------------------------
  // Refetch
  // -------------------------------------------------------------------------

  it("refetch triggers another api.get call", async () => {
    mockGet.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when orderId changes", async () => {
    const OTHER_ID = "order-uuid-xyz789";
    mockGet.mockResolvedValue(MOCK_DETAIL);

    const { rerender } = renderHook(
      ({ id }) => useOrderDetail(id),
      { initialProps: { id: MOCK_ORDER_ID } }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    rerender({ id: OTHER_ID });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    const [endpointSecondCall] = mockGet.mock.calls[1];
    expect(endpointSecondCall).toBe(`/api/v1/orders/${OTHER_ID}`);
  });

  // -------------------------------------------------------------------------
  // Mechanizm stale-prevention
  // -------------------------------------------------------------------------

  it("does not update state after unmount (stale prevention)", async () => {
    let resolveRequest!: (v: OrderDetailResponseDto) => void;
    const pendingPromise = new Promise<OrderDetailResponseDto>((res) => {
      resolveRequest = res;
    });
    mockGet.mockReturnValue(pendingPromise);

    const { result, unmount } = renderHook(() => useOrderDetail(MOCK_ORDER_ID));

    unmount();

    await act(async () => {
      resolveRequest(MOCK_DETAIL);
    });

    // Stan nie powinien być zaktualizowany po odmontowaniu
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true); // nie zmienione po odmontowaniu
  });
});

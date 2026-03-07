/**
 * Testy hooka useOrderDrawer (M-15).
 * Sprawdza: loadDetail, handleSave (create/update), handleCloseRequest, doClose.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocki — vi.hoisted() zapewnia dostępność zmiennych przed hoistingiem vi.mock()
// ---------------------------------------------------------------------------

const { mockApi, mockToast, mockUser } = vi.hoisted(() => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postRaw: vi.fn(),
  };
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };
  const mockUser = {
    id: "user-uuid-drawer-test",
    email: "admin@test.pl",
    role: "ADMIN" as const,
    fullName: "Test Admin",
  };
  return { mockApi, mockToast, mockUser };
});

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ api: mockApi, user: mockUser }),
}));

vi.mock("@/contexts/DictionaryContext", () => ({
  useDictionaries: () => ({
    companies: [],
    locations: [],
    products: [],
  }),
}));

vi.mock("@/components/orders/order-view/types", () => ({
  formDataToViewData: vi.fn(() => ({} as any)),
  viewDataToFormData: vi.fn(() => ({} as any)),
}));

// Importy po zamockowaniu
import { useOrderDrawer } from "../useOrderDrawer";
import type { OrderDetailResponseDto } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORDER_ID = "order-uuid-drawer-test";

/** Pełny mock OrderDetailResponseDto */
function makeMockDetail(overrides?: Partial<OrderDetailResponseDto["order"]>): OrderDetailResponseDto {
  return {
    order: {
      id: ORDER_ID,
      orderNo: "ZT2026/0042",
      statusCode: "robocze",
      transportTypeCode: "PL",
      currencyCode: "PLN",
      priceAmount: null,
      paymentTermDays: null,
      paymentMethod: null,
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      summaryRoute: null,
      firstLoadingDate: null,
      firstLoadingTime: null,
      firstUnloadingDate: null,
      firstUnloadingTime: null,
      lastLoadingDate: null,
      lastLoadingTime: null,
      lastUnloadingDate: null,
      lastUnloadingTime: null,
      transportYear: null,
      firstLoadingCountry: null,
      firstUnloadingCountry: null,
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
      mainProductName: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: null,
      notificationDetails: null,
      confidentialityClause: null,
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
      statusName: "Robocze",
      weekNumber: null,
      sentAt: null,
      sentByUserName: null,
      createdByUserName: null,
      updatedByUserName: null,
      lockedByUserName: null,
      ...overrides,
    },
    stops: [],
    items: [],
  };
}

/** Minimalne formData do przekazania handleSave */
function makeMockFormData() {
  return {
    transportTypeCode: "PL" as const,
    currencyCode: "PLN" as const,
    priceAmount: null,
    paymentTermDays: null,
    paymentMethod: null,
    totalLoadTons: null,
    totalLoadVolumeM3: null,
    carrierCompanyId: null,
    shipperLocationId: null,
    receiverLocationId: null,
    vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
    specialRequirements: null,
    requiredDocumentsText: null,
    generalNotes: null,
    notificationDetails: null,
    confidentialityClause: null,
    complaintReason: null,
    senderContactName: null,
    senderContactPhone: null,
    senderContactEmail: null,
    stops: [] as any[],
    items: [] as any[],
  };
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useOrderDrawer", () => {
  // vi.fn() jest zgodny z () => void na runtime, ale TS tego nie widzi
  // Używamy vi.fn() i castujemy w renderHook
  let onCloseFn: ReturnType<typeof vi.fn>;
  let onOrderUpdatedFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onCloseFn = vi.fn();
    onOrderUpdatedFn = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // loadDetail (GET sukces)
  // -------------------------------------------------------------------------

  describe("loadDetail", () => {
    it("GET sukces → ustawia detail + formData-ready", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      // Lock call — sukces
      mockApi.post.mockResolvedValue({ locked: true });

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      // Powinien być w stanie ładowania
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.detail).not.toBeNull();
      expect(result.current.detail!.order.id).toBe(ORDER_ID);
      expect(result.current.detail!.order.orderNo).toBe("ZT2026/0042");
      expect(mockApi.get).toHaveBeenCalledWith(`/api/v1/orders/${ORDER_ID}`);
    });

    it("GET error → toast.error", async () => {
      mockApi.get.mockRejectedValue(new Error("Not found"));
      mockApi.post.mockRejectedValue(new Error("Lock failed"));

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockToast.error).toHaveBeenCalledWith("Not found");
      expect(result.current.detail).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // New order mode (orderId = null)
  // -------------------------------------------------------------------------

  describe("new order mode", () => {
    it("orderId=null + isOpen=true → detail z pustymi defaults, isNewOrder=true", async () => {
      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: null,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      // Nie wywołuje GET
      expect(mockApi.get).not.toHaveBeenCalled();
      expect(result.current.isNewOrder).toBe(true);
      expect(result.current.detail).not.toBeNull();
      expect(result.current.detail!.order.statusCode).toBe("robocze");
      expect(result.current.detail!.order.orderNo).toBe("");
      expect(result.current.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // handleSave — create mode (POST)
  // -------------------------------------------------------------------------

  describe("handleSave — create mode", () => {
    it("POST sukces → toast.success + onOrderUpdated + onClose", async () => {
      mockApi.post.mockResolvedValue({ id: "new-id", orderNo: "ZT2026/0099", statusCode: "robocze" });

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: null,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      const formData = makeMockFormData();

      await act(async () => {
        await result.current.handleSave(formData, null, null);
      });

      expect(mockApi.post).toHaveBeenCalledWith("/api/v1/orders", expect.any(Object));
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("ZT2026/0099"));
      expect(onOrderUpdatedFn).toHaveBeenCalled();
      expect(onCloseFn).toHaveBeenCalled();
    });

    it("POST error → toast.error", async () => {
      // post jest wywoływany w create mode
      mockApi.post.mockRejectedValue(new Error("Validation error"));

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: null,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      const formData = makeMockFormData();

      await act(async () => {
        await result.current.handleSave(formData, null, null);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Validation error");
      expect(onCloseFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleSave — update mode (PUT)
  // -------------------------------------------------------------------------

  describe("handleSave — update mode", () => {
    it("PUT sukces → toast.success + doClose + onOrderUpdated", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      // Lock sukces
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Resetuj mocki po loadDetail
      mockApi.put.mockResolvedValue({});
      mockApi.post.mockResolvedValue({}); // unlock

      const formData = makeMockFormData();

      await act(async () => {
        await result.current.handleSave(formData, null, null);
      });

      expect(mockApi.put).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}`,
        expect.any(Object)
      );
      expect(mockToast.success).toHaveBeenCalledWith("Zlecenie zapisane.");
      expect(onOrderUpdatedFn).toHaveBeenCalled();
      // doClose wywołuje onClose
      expect(onCloseFn).toHaveBeenCalled();
    });

    it("PUT + pendingStatus → dodatkowy POST /status", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({}); // lock + unlock + status

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApi.put.mockResolvedValue({});
      const formData = makeMockFormData();

      await act(async () => {
        await result.current.handleSave(formData, "zrealizowane", null);
      });

      // PUT + POST /status
      expect(mockApi.put).toHaveBeenCalled();
      // post powinien być wywołany dla lock + status + unlock
      const statusCalls = mockApi.post.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/status")
      );
      expect(statusCalls.length).toBe(1);
      expect(statusCalls[0][1]).toEqual({ newStatusCode: "zrealizowane" });
    });

    it("pendingStatus=reklamacja bez complaintReason → toast.error, nie wysyła PUT", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const formData = makeMockFormData();

      await act(async () => {
        await result.current.handleSave(formData, "reklamacja", null);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Podaj powód reklamacji.");
      expect(mockApi.put).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleCloseRequest
  // -------------------------------------------------------------------------

  describe("handleCloseRequest", () => {
    it("isDirty=false → doClose (onClose wywoływane)", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // isDirty jest false domyślnie
      expect(result.current.isDirty).toBe(false);

      await act(async () => {
        result.current.handleCloseRequest();
      });

      // doClose powinien wywołać onClose
      expect(onCloseFn).toHaveBeenCalled();
    });

    it("isDirty=true → showUnsavedDialog=true (nie zamyka)", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Ustaw isDirty na true
      act(() => {
        result.current.setIsDirty(true);
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.handleCloseRequest();
      });

      expect(result.current.showUnsavedDialog).toBe(true);
      expect(onCloseFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // doClose
  // -------------------------------------------------------------------------

  describe("doClose", () => {
    it("unlock + reset state + onClose callback", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Resetuj post mock calls (lock call already happened)
      mockApi.post.mockClear();
      mockApi.post.mockResolvedValue({});

      await act(async () => {
        await result.current.doClose();
      });

      // Sprawdź unlock call
      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/unlock`,
        {}
      );
      // Stan zresetowany
      expect(result.current.detail).toBeNull();
      expect(result.current.isDirty).toBe(false);
      // onClose wywołane
      expect(onCloseFn).toHaveBeenCalled();
    });

    it("READ_ONLY user → nie wywołuje unlock", async () => {
      // Tymczasowo zmień rolę
      const origRole = mockUser.role;
      (mockUser as any).role = "READ_ONLY";

      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApi.post.mockClear();

      await act(async () => {
        await result.current.doClose();
      });

      // Nie powinien wywołać unlock
      expect(mockApi.post).not.toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/unlock`,
        {}
      );
      expect(onCloseFn).toHaveBeenCalled();

      // Przywróć rolę
      (mockUser as any).role = origRole;
    });

    it("unlock error → ignorowany, onClose nadal wywoływane", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Unlock rzuca błąd
      mockApi.post.mockRejectedValue(new Error("Unlock failed"));

      await act(async () => {
        await result.current.doClose();
      });

      // onClose nadal wywołane pomimo błędu unlock
      expect(onCloseFn).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // isReadOnly
  // -------------------------------------------------------------------------

  describe("isReadOnly", () => {
    it("ADMIN user + no lock → isReadOnly=false", async () => {
      const detail = makeMockDetail();
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isReadOnly).toBe(false);
    });

    it("lockedByUserId innego usera → isReadOnly=true", async () => {
      const detail = makeMockDetail({ lockedByUserId: "other-user-id" });
      mockApi.get.mockResolvedValue(detail);
      // Lock call — 409 conflict
      mockApi.post.mockResolvedValue({ lockFailed: true });

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isReadOnly).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // statusName
  // -------------------------------------------------------------------------

  describe("statusName", () => {
    it("detail z statusCode='robocze' → statusName='Robocze'", async () => {
      const detail = makeMockDetail({ statusCode: "robocze" });
      mockApi.get.mockResolvedValue(detail);
      mockApi.post.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOrderDrawer({
          orderId: ORDER_ID,
          isOpen: true,
          onClose: onCloseFn as unknown as () => void,
          onOrderUpdated: onOrderUpdatedFn as unknown as () => void,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.statusName).toBe("Robocze");
    });
  });
});

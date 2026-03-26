/**
 * Testy hooka useOrderActions (M-14).
 * Sprawdza handlery: addOrder, sendEmail, cancelConfirm, duplicate, changeStatus, restore.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocki — vi.hoisted() zapewnia dostępność zmiennych przed hoistingiem vi.mock()
// ---------------------------------------------------------------------------

const { mockApi, mockToast } = vi.hoisted(() => {
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
  return { mockApi, mockToast };
});

vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Importy po zamockowaniu
import { useOrderActions } from "../useOrderActions";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORDER_ID = "order-uuid-actions-test";
const ORDER_NO = "ZT2026/0001";

function createMockScrollRef() {
  return {
    current: {
      scrollTo: vi.fn(),
      scrollHeight: 1000,
    },
  } as unknown as React.RefObject<HTMLDivElement | null>;
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useOrderActions", () => {
  let refetchFn: ReturnType<typeof vi.fn>;
  let silentRefetchFn: ReturnType<typeof vi.fn>;
  let updateOrderLocallyFn: ReturnType<typeof vi.fn>;
  let tableScrollRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    refetchFn = vi.fn().mockResolvedValue(undefined);
    silentRefetchFn = vi.fn().mockResolvedValue(undefined);
    updateOrderLocallyFn = vi.fn();
    tableScrollRef = createMockScrollRef();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderActions() {
    return renderHook(() =>
      useOrderActions({
        api: mockApi as any,
        user: null,
        refetch: refetchFn as unknown as () => void | Promise<void>,
        silentRefetch: silentRefetchFn as unknown as () => void | Promise<void>,
        updateOrderLocally: updateOrderLocallyFn as unknown as (orderId: string, patch: Partial<import("@/types").OrderListItemDto>) => void,
        tableScrollRef,
      })
    );
  }

  // -------------------------------------------------------------------------
  // handleAddOrder
  // -------------------------------------------------------------------------

  describe("handleAddOrder", () => {
    it("POST sukces → toast.success + refetch", async () => {
      mockApi.post.mockResolvedValue({ orderNo: "ZT2026/0042" });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleAddOrder();
      });

      expect(mockApi.post).toHaveBeenCalledWith("/api/v1/orders", expect.any(Object));
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("ZT2026/0042"));
      expect(silentRefetchFn).toHaveBeenCalled();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Serwer niedostępny"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleAddOrder();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Serwer niedostępny");
      expect(silentRefetchFn).not.toHaveBeenCalled();
    });

    it("POST error (non-Error) → toast.error z fallback message", async () => {
      mockApi.post.mockRejectedValue("string error");

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleAddOrder();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Błąd tworzenia zlecenia.");
    });

    it("podwójne kliknięcie → drugie wywołanie ignorowane (ref guard)", async () => {
      // Pierwszy POST trwa długo
      let resolveFirst!: (v: unknown) => void;
      mockApi.post.mockReturnValueOnce(
        new Promise((res) => { resolveFirst = res; })
      );

      const { result } = renderActions();

      // Rozpocznij pierwsze wywołanie (nie czekaj na zakończenie)
      const firstCall = act(async () => {
        await result.current.handleAddOrder();
      });

      // Drugie wywołanie — powinno być zignorowane
      await act(async () => {
        await result.current.handleAddOrder();
      });

      // Zakończ pierwsze
      await act(async () => {
        resolveFirst({ orderNo: "ZT2026/0001" });
      });
      await firstCall;

      // POST powinien być wywołany tylko raz
      expect(mockApi.post).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // handleSendEmail
  // -------------------------------------------------------------------------

  describe("handleSendEmail", () => {
    it("postRaw sukces → blob download .eml + toast.success + refetch", async () => {
      const mockBlob = new Blob(["mock-eml"], { type: "message/rfc822" });
      mockApi.postRaw.mockResolvedValue({
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSendEmail(ORDER_ID);
      });

      expect(mockApi.postRaw).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/prepare-email`,
        {}
      );
      expect(mockToast.success).toHaveBeenCalled();
      expect(silentRefetchFn).toHaveBeenCalled();
    });

    it("postRaw error → toast.error", async () => {
      mockApi.postRaw.mockRejectedValue(new Error("Email error"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSendEmail(ORDER_ID);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Email error");
      expect(silentRefetchFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleCancelConfirm
  // -------------------------------------------------------------------------

  describe("handleCancelConfirm", () => {
    it("DELETE sukces → toast.success + refetch + reset pendingCancel", async () => {
      mockApi.delete.mockResolvedValue(undefined);

      const { result } = renderActions();

      // Ustaw pendingCancel
      act(() => {
        result.current.handleCancelRequest(ORDER_ID, ORDER_NO);
      });
      expect(result.current.pendingCancel).toEqual({ orderId: ORDER_ID, orderNo: ORDER_NO });

      // Potwierdź anulowanie
      await act(async () => {
        await result.current.handleCancelConfirm();
      });

      expect(mockApi.delete).toHaveBeenCalledWith(`/api/v1/orders/${ORDER_ID}`);
      expect(mockToast.success).toHaveBeenCalledWith("Zlecenie anulowane.");
      expect(silentRefetchFn).toHaveBeenCalled();
      expect(result.current.pendingCancel).toBeNull();
    });

    it("pendingCancel = null → nie wywołuje api.delete", async () => {
      const { result } = renderActions();

      await act(async () => {
        await result.current.handleCancelConfirm();
      });

      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it("DELETE error → toast.error", async () => {
      mockApi.delete.mockRejectedValue(new Error("Cannot cancel"));

      const { result } = renderActions();

      act(() => {
        result.current.handleCancelRequest(ORDER_ID, ORDER_NO);
      });

      await act(async () => {
        await result.current.handleCancelConfirm();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Cannot cancel");
    });
  });

  // -------------------------------------------------------------------------
  // handleDuplicate
  // -------------------------------------------------------------------------

  describe("handleDuplicateRequest + handleDuplicateConfirm", () => {
    it("request ustawia pendingDuplicate, confirm → POST + toast.success + refetch", async () => {
      mockApi.post.mockResolvedValue({ orderNo: "ZT2026/0099" });

      const { result } = renderActions();

      // Request otwiera dialog
      act(() => {
        result.current.handleDuplicateRequest(ORDER_ID, ORDER_NO);
      });
      expect(result.current.pendingDuplicate).toEqual({ orderId: ORDER_ID, orderNo: ORDER_NO });

      // Confirm wysyła POST
      await act(async () => {
        await result.current.handleDuplicateConfirm();
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/duplicate`,
        { includeStops: true, includeItems: true, resetStatusToDraft: true }
      );
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("ZT2026/0099"));
      expect(silentRefetchFn).toHaveBeenCalled();
      expect(result.current.pendingDuplicate).toBeNull();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Duplicate failed"));

      const { result } = renderActions();

      act(() => {
        result.current.handleDuplicateRequest(ORDER_ID, ORDER_NO);
      });

      await act(async () => {
        await result.current.handleDuplicateConfirm();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Duplicate failed");
    });
  });

  // -------------------------------------------------------------------------
  // handleChangeStatus
  // -------------------------------------------------------------------------

  describe("handleChangeStatusRequest + handleChangeStatusConfirm", () => {
    it("request ustawia pendingStatusChange, confirm → POST + toast.success + refetch", async () => {
      mockApi.post.mockResolvedValue(undefined);

      const { result } = renderActions();

      // Request otwiera dialog
      act(() => {
        result.current.handleChangeStatusRequest(ORDER_ID, ORDER_NO, "zrealizowane");
      });
      expect(result.current.pendingStatusChange).toEqual({
        orderId: ORDER_ID,
        orderNo: ORDER_NO,
        newStatus: "zrealizowane",
      });

      // Confirm wysyła POST
      await act(async () => {
        await result.current.handleChangeStatusConfirm();
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/status`,
        { newStatusCode: "zrealizowane" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Status zmieniony.");
      expect(silentRefetchFn).toHaveBeenCalled();
      expect(result.current.pendingStatusChange).toBeNull();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Forbidden"));

      const { result } = renderActions();

      act(() => {
        result.current.handleChangeStatusRequest(ORDER_ID, ORDER_NO, "anulowane");
      });

      await act(async () => {
        await result.current.handleChangeStatusConfirm();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Forbidden");
    });

    it("reklamacja z complaintReason → POST zawiera complaintReason", async () => {
      mockApi.post.mockResolvedValue(undefined);

      const { result } = renderActions();

      act(() => {
        result.current.handleChangeStatusRequest(ORDER_ID, ORDER_NO, "reklamacja");
      });

      await act(async () => {
        await result.current.handleChangeStatusConfirm("Towar uszkodzony");
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/status`,
        { newStatusCode: "reklamacja", complaintReason: "Towar uszkodzony" }
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleRestore
  // -------------------------------------------------------------------------

  describe("handleRestoreRequest + handleRestoreConfirm", () => {
    it("request ustawia pendingRestore, confirm → POST + toast.success + refetch", async () => {
      mockApi.post.mockResolvedValue(undefined);

      const { result } = renderActions();

      // Request otwiera dialog
      act(() => {
        result.current.handleRestoreRequest(ORDER_ID, ORDER_NO);
      });
      expect(result.current.pendingRestore).toEqual({ orderId: ORDER_ID, orderNo: ORDER_NO });

      // Confirm wysyła POST
      await act(async () => {
        await result.current.handleRestoreConfirm();
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/restore`,
        {}
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Zlecenie przywrócone do Aktualnych (status: Korekta)."
      );
      expect(silentRefetchFn).toHaveBeenCalled();
      expect(result.current.pendingRestore).toBeNull();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Restore failed"));

      const { result } = renderActions();

      act(() => {
        result.current.handleRestoreRequest(ORDER_ID, ORDER_NO);
      });

      await act(async () => {
        await result.current.handleRestoreConfirm();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Restore failed");
    });
  });

  // -------------------------------------------------------------------------
  // handleSetCarrierColor + handleSetEntryFixed
  // -------------------------------------------------------------------------

  describe("handleSetCarrierColor", () => {
    it("PATCH sukces z kolorem → optimistic update + toast 'Kolor ustawiony.'", async () => {
      mockApi.patch.mockResolvedValue({ id: ORDER_ID, carrierCellColor: "#FF0000" });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetCarrierColor(ORDER_ID, "#FF0000");
      });

      expect(updateOrderLocallyFn).toHaveBeenCalledWith(ORDER_ID, { carrierCellColor: "#FF0000" });
      expect(mockApi.patch).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/carrier-color`,
        { color: "#FF0000" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Kolor ustawiony.");
      expect(silentRefetchFn).not.toHaveBeenCalled();
    });

    it("PATCH sukces z null → optimistic update + toast 'Kolor usunięty.'", async () => {
      mockApi.patch.mockResolvedValue({ id: ORDER_ID, carrierCellColor: null });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetCarrierColor(ORDER_ID, null);
      });

      expect(updateOrderLocallyFn).toHaveBeenCalledWith(ORDER_ID, { carrierCellColor: null });
      expect(mockToast.success).toHaveBeenCalledWith("Kolor usunięty.");
    });
  });

  describe("handleSetEntryFixed", () => {
    it("PATCH true → optimistic update + toast 'Fix: Tak'", async () => {
      mockApi.patch.mockResolvedValue({});

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetEntryFixed(ORDER_ID, true);
      });

      expect(updateOrderLocallyFn).toHaveBeenCalledWith(ORDER_ID, { isEntryFixed: true });
      expect(mockToast.success).toHaveBeenCalledWith("Fix: Tak");
    });

    it("PATCH false → toast 'Fix: Nie'", async () => {
      mockApi.patch.mockResolvedValue({});

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetEntryFixed(ORDER_ID, false);
      });

      expect(mockToast.success).toHaveBeenCalledWith("Fix: Nie");
    });

    it("PATCH null → toast 'Fix usunięty.'", async () => {
      mockApi.patch.mockResolvedValue({});

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetEntryFixed(ORDER_ID, null);
      });

      expect(mockToast.success).toHaveBeenCalledWith("Fix usunięty.");
    });
  });

  // -------------------------------------------------------------------------
  // handleCancelRequest
  // -------------------------------------------------------------------------

  describe("handleCancelRequest", () => {
    it("ustawia pendingCancel z orderId i orderNo", () => {
      const { result } = renderActions();

      act(() => {
        result.current.handleCancelRequest(ORDER_ID, ORDER_NO);
      });

      expect(result.current.pendingCancel).toEqual({ orderId: ORDER_ID, orderNo: ORDER_NO });
    });
  });

  // -------------------------------------------------------------------------
  // Stan początkowy
  // -------------------------------------------------------------------------

  describe("stan początkowy", () => {
    it("isCreatingOrder = false, pendingCancel = null, pendingStatusChange = null, pendingDuplicate = null, pendingRestore = null", () => {
      const { result } = renderActions();

      expect(result.current.isCreatingOrder).toBe(false);
      expect(result.current.pendingCancel).toBeNull();
      expect(result.current.pendingStatusChange).toBeNull();
      expect(result.current.pendingDuplicate).toBeNull();
      expect(result.current.pendingRestore).toBeNull();
    });
  });
});

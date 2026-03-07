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
  let tableScrollRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    refetchFn = vi.fn().mockResolvedValue(undefined);
    tableScrollRef = createMockScrollRef();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderActions() {
    return renderHook(() =>
      useOrderActions({ api: mockApi as any, refetch: refetchFn as unknown as () => void | Promise<void>, tableScrollRef })
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
      expect(refetchFn).toHaveBeenCalled();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Serwer niedostępny"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleAddOrder();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Serwer niedostępny");
      expect(refetchFn).not.toHaveBeenCalled();
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
    it("POST sukces → window.open + toast.success + refetch", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      mockApi.post.mockResolvedValue({ emailOpenUrl: "mailto:test@example.com" });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSendEmail(ORDER_ID);
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/prepare-email`,
        {}
      );
      expect(openSpy).toHaveBeenCalledWith(
        "mailto:test@example.com",
        "_blank",
        "noopener,noreferrer"
      );
      expect(mockToast.success).toHaveBeenCalled();
      expect(refetchFn).toHaveBeenCalled();

      openSpy.mockRestore();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Email error"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSendEmail(ORDER_ID);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Email error");
      expect(refetchFn).not.toHaveBeenCalled();
    });

    it("brak emailOpenUrl → nie wywołuje window.open", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      mockApi.post.mockResolvedValue({ emailOpenUrl: null });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSendEmail(ORDER_ID);
      });

      expect(openSpy).not.toHaveBeenCalled();
      // Ale toast.success nadal powinien być wywołany
      expect(mockToast.success).toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // handleCancelConfirm
  // -------------------------------------------------------------------------

  describe("handleCancelConfirm", () => {
    it("DELETE sukces → toast.success + refetch + reset cancelOrderId", async () => {
      mockApi.delete.mockResolvedValue(undefined);

      const { result } = renderActions();

      // Ustaw cancelOrderId
      act(() => {
        result.current.handleCancelRequest(ORDER_ID);
      });
      expect(result.current.cancelOrderId).toBe(ORDER_ID);

      // Potwierdź anulowanie
      await act(async () => {
        await result.current.handleCancelConfirm();
      });

      expect(mockApi.delete).toHaveBeenCalledWith(`/api/v1/orders/${ORDER_ID}`);
      expect(mockToast.success).toHaveBeenCalledWith("Zlecenie anulowane.");
      expect(refetchFn).toHaveBeenCalled();
      expect(result.current.cancelOrderId).toBeNull();
    });

    it("cancelOrderId = null → nie wywołuje api.delete", async () => {
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
        result.current.handleCancelRequest(ORDER_ID);
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

  describe("handleDuplicate", () => {
    it("POST sukces → toast.success z orderNo + refetch", async () => {
      mockApi.post.mockResolvedValue({ orderNo: "ZT2026/0099" });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleDuplicate(ORDER_ID);
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/duplicate`,
        { includeStops: true, includeItems: true, resetStatusToDraft: true }
      );
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("ZT2026/0099"));
      expect(refetchFn).toHaveBeenCalled();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Duplicate failed"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleDuplicate(ORDER_ID);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Duplicate failed");
    });
  });

  // -------------------------------------------------------------------------
  // handleChangeStatus
  // -------------------------------------------------------------------------

  describe("handleChangeStatus", () => {
    it("POST sukces → toast.success + refetch", async () => {
      mockApi.post.mockResolvedValue(undefined);

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleChangeStatus(ORDER_ID, "zrealizowane");
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/status`,
        { newStatusCode: "zrealizowane" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Status zmieniony.");
      expect(refetchFn).toHaveBeenCalled();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Forbidden"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleChangeStatus(ORDER_ID, "anulowane");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Forbidden");
    });
  });

  // -------------------------------------------------------------------------
  // handleRestore
  // -------------------------------------------------------------------------

  describe("handleRestore", () => {
    it("POST sukces → toast.success + refetch", async () => {
      mockApi.post.mockResolvedValue(undefined);

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleRestore(ORDER_ID);
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/restore`,
        {}
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Zlecenie przywrócone do Aktualnych (status: Korekta)."
      );
      expect(refetchFn).toHaveBeenCalled();
    });

    it("POST error → toast.error", async () => {
      mockApi.post.mockRejectedValue(new Error("Restore failed"));

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleRestore(ORDER_ID);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Restore failed");
    });
  });

  // -------------------------------------------------------------------------
  // handleSetCarrierColor + handleSetEntryFixed
  // -------------------------------------------------------------------------

  describe("handleSetCarrierColor", () => {
    it("PATCH sukces z kolorem → toast 'Kolor ustawiony.' + refetch", async () => {
      mockApi.patch.mockResolvedValue({ id: ORDER_ID, carrierCellColor: "#FF0000" });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetCarrierColor(ORDER_ID, "#FF0000");
      });

      expect(mockApi.patch).toHaveBeenCalledWith(
        `/api/v1/orders/${ORDER_ID}/carrier-color`,
        { color: "#FF0000" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Kolor ustawiony.");
      expect(refetchFn).toHaveBeenCalled();
    });

    it("PATCH sukces z null → toast 'Kolor usunięty.'", async () => {
      mockApi.patch.mockResolvedValue({ id: ORDER_ID, carrierCellColor: null });

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetCarrierColor(ORDER_ID, null);
      });

      expect(mockToast.success).toHaveBeenCalledWith("Kolor usunięty.");
    });
  });

  describe("handleSetEntryFixed", () => {
    it("PATCH true → toast 'Fix: Tak'", async () => {
      mockApi.patch.mockResolvedValue({});

      const { result } = renderActions();

      await act(async () => {
        await result.current.handleSetEntryFixed(ORDER_ID, true);
      });

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
    it("ustawia cancelOrderId", () => {
      const { result } = renderActions();

      act(() => {
        result.current.handleCancelRequest(ORDER_ID);
      });

      expect(result.current.cancelOrderId).toBe(ORDER_ID);
    });
  });

  // -------------------------------------------------------------------------
  // Stan początkowy
  // -------------------------------------------------------------------------

  describe("stan początkowy", () => {
    it("isCreatingOrder = false, cancelOrderId = null", () => {
      const { result } = renderActions();

      expect(result.current.isCreatingOrder).toBe(false);
      expect(result.current.cancelOrderId).toBeNull();
    });
  });
});

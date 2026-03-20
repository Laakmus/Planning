/**
 * Hook wyekstrahowany z OrdersPage — obsługuje akcje na zleceniach
 * (tworzenie, email, zmiana statusu, anulowanie, przywracanie, kolor, fix, duplikacja).
 */

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { ApiClient } from "@/lib/api-client";
import { sendEmailForOrder } from "@/lib/send-email";
import type { OrderStatusCode } from "@/lib/view-models";
import type {
  AuthMeDto,
  CarrierColorResponseDto,
  CreateOrderResponseDto,
  DuplicateOrderResponseDto,
  EntryFixedResponseDto,
} from "@/types";

interface MicrosoftAuth {
  isConfigured: boolean;
  getToken: () => Promise<string>;
}

interface UseOrderActionsOptions {
  api: ApiClient;
  user: AuthMeDto | null;
  refetch: () => void | Promise<void>;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  microsoft?: MicrosoftAuth;
}

/** Pending zmiana statusu — czeka na potwierdzenie użytkownika */
export interface PendingStatusChange {
  orderId: string;
  orderNo: string;
  newStatus: OrderStatusCode;
  complaintReason?: string;
}

/** Pending duplikacja — czeka na potwierdzenie użytkownika */
export interface PendingDuplicate {
  orderId: string;
  orderNo: string;
}

/** Pending przywrócenie — czeka na potwierdzenie użytkownika */
export interface PendingRestore {
  orderId: string;
  orderNo: string;
}

/** Pending anulowanie — czeka na potwierdzenie użytkownika (z orderNo) */
export interface PendingCancel {
  orderId: string;
  orderNo: string;
}

export interface UseOrderActionsReturn {
  isCreatingOrder: boolean;
  pendingCancel: PendingCancel | null;
  setPendingCancel: (val: PendingCancel | null) => void;
  pendingStatusChange: PendingStatusChange | null;
  setPendingStatusChange: (val: PendingStatusChange | null) => void;
  pendingDuplicate: PendingDuplicate | null;
  setPendingDuplicate: (val: PendingDuplicate | null) => void;
  pendingRestore: PendingRestore | null;
  setPendingRestore: (val: PendingRestore | null) => void;
  handleAddOrder: () => Promise<void>;
  handleSendEmail: (orderId: string) => Promise<void>;
  handleChangeStatusRequest: (orderId: string, orderNo: string, newStatus: OrderStatusCode) => void;
  handleChangeStatusConfirm: (complaintReason?: string) => Promise<void>;
  handleCancelRequest: (orderId: string, orderNo: string) => void;
  handleCancelConfirm: () => Promise<void>;
  handleRestoreRequest: (orderId: string, orderNo: string) => void;
  handleRestoreConfirm: () => Promise<void>;
  handleSetCarrierColor: (orderId: string, color: string | null) => Promise<void>;
  handleSetEntryFixed: (orderId: string, value: boolean | null) => Promise<void>;
  handleDuplicateRequest: (orderId: string, orderNo: string) => void;
  handleDuplicateConfirm: () => Promise<void>;
  emailValidationErrors: string[];
  clearEmailValidationErrors: () => void;
}

export function useOrderActions({
  api,
  user,
  refetch,
  tableScrollRef,
  microsoft,
}: UseOrderActionsOptions): UseOrderActionsReturn {
  // Stan tworzenia nowego zlecenia (blokada przycisku + spinner)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const isCreatingRef = useRef(false);

  // Stan dialogu potwierdzenia anulowania (z orderNo)
  const [pendingCancel, setPendingCancel] = useState<PendingCancel | null>(null);

  // Stan dialogu potwierdzenia zmiany statusu
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);

  // Stan dialogu potwierdzenia duplikacji
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);

  // Stan dialogu potwierdzenia przywrócenia
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

  // Stan dialogu walidacji email (422 — brakujące pola)
  const [emailValidationErrors, setEmailValidationErrors] = useState<string[]>([]);
  const clearEmailValidationErrors = useCallback(() => setEmailValidationErrors([]), []);

  const handleAddOrder = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreatingOrder(true);
    try {
      const result = await api.post<CreateOrderResponseDto>("/api/v1/orders", {
        transportTypeCode: "PL",
        currencyCode: "PLN",
        carrierCompanyId: null,
        shipperLocationId: null,
        receiverLocationId: null,
        vehicleTypeText: null,
        vehicleCapacityVolumeM3: null,
        priceAmount: null,
        paymentTermDays: 21,
        paymentMethod: null,
        totalLoadTons: null,
        totalLoadVolumeM3: null,
        specialRequirements: null,
        requiredDocumentsText: "WZ, KPO, kwit wagowy",
        generalNotes: null,
        senderContactName: user?.fullName ?? null,
        senderContactPhone: user?.phone ?? null,
        senderContactEmail: user?.email ?? null,
        stops: [],
        items: [],
      });
      toast.success(`Utworzono zlecenie ${result.orderNo}.`);
      await refetch();
      // Auto-scroll na dół po wyrenderowaniu nowego wiersza
      requestAnimationFrame(() => {
        tableScrollRef.current?.scrollTo({ top: tableScrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd tworzenia zlecenia.");
    } finally {
      isCreatingRef.current = false;
      setIsCreatingOrder(false);
    }
  }, [api, refetch, tableScrollRef]);

  const handleSendEmail = useCallback(
    async (orderId: string) => {
      await sendEmailForOrder({
        orderId,
        api,
        microsoft,
        onSuccess: () => refetch(),
        onValidationError: (fields) => setEmailValidationErrors(fields),
      });
    },
    [api, refetch, microsoft]
  );

  // Zmiana statusu — request otwiera dialog, confirm wysyła POST
  const handleChangeStatusRequest = useCallback(
    (orderId: string, orderNo: string, newStatus: OrderStatusCode) => {
      setPendingStatusChange({ orderId, orderNo, newStatus });
    },
    []
  );

  const handleChangeStatusConfirm = useCallback(
    async (complaintReason?: string) => {
      if (!pendingStatusChange) return;
      const { orderId, newStatus } = pendingStatusChange;
      setPendingStatusChange(null);
      try {
        await api.post(`/api/v1/orders/${orderId}/status`, {
          newStatusCode: newStatus,
          ...(newStatus === "reklamacja" && complaintReason ? { complaintReason } : {}),
        });
        toast.success("Status zmieniony.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd zmiany statusu.");
      }
    },
    [api, pendingStatusChange, refetch]
  );

  // Anulowanie — request otwiera dialog (z orderNo), confirm wysyła DELETE
  const handleCancelRequest = useCallback((orderId: string, orderNo: string) => {
    setPendingCancel({ orderId, orderNo });
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    if (!pendingCancel) return;
    const { orderId } = pendingCancel;
    setPendingCancel(null);
    try {
      await api.delete(`/api/v1/orders/${orderId}`);
      toast.success("Zlecenie anulowane.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd anulowania zlecenia.");
    }
  }, [api, pendingCancel, refetch]);

  // Przywrócenie — request otwiera dialog, confirm wysyła POST
  const handleRestoreRequest = useCallback(
    (orderId: string, orderNo: string) => {
      setPendingRestore({ orderId, orderNo });
    },
    []
  );

  const handleRestoreConfirm = useCallback(async () => {
    if (!pendingRestore) return;
    const { orderId } = pendingRestore;
    setPendingRestore(null);
    try {
      await api.post(`/api/v1/orders/${orderId}/restore`, {});
      toast.success("Zlecenie przywrócone do Aktualnych (status: Korekta).");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd przywracania zlecenia.");
    }
  }, [api, pendingRestore, refetch]);

  const handleSetCarrierColor = useCallback(
    async (orderId: string, color: string | null) => {
      try {
        await api.patch<CarrierColorResponseDto>(
          `/api/v1/orders/${orderId}/carrier-color`,
          { color }
        );
        toast.success(color ? "Kolor ustawiony." : "Kolor usunięty.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd ustawiania koloru.");
      }
    },
    [api, refetch]
  );

  const handleSetEntryFixed = useCallback(
    async (orderId: string, value: boolean | null) => {
      try {
        await api.patch<EntryFixedResponseDto>(
          `/api/v1/orders/${orderId}/entry-fixed`,
          { isEntryFixed: value }
        );
        toast.success(
          value === true ? "Fix: Tak" : value === false ? "Fix: Nie" : "Fix usunięty."
        );
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd ustawiania pola Fix.");
      }
    },
    [api, refetch]
  );

  // Duplikacja — request otwiera dialog, confirm wysyła POST
  const handleDuplicateRequest = useCallback(
    (orderId: string, orderNo: string) => {
      setPendingDuplicate({ orderId, orderNo });
    },
    []
  );

  const handleDuplicateConfirm = useCallback(async () => {
    if (!pendingDuplicate) return;
    const { orderId } = pendingDuplicate;
    setPendingDuplicate(null);
    try {
      const result = await api.post<DuplicateOrderResponseDto>(
        `/api/v1/orders/${orderId}/duplicate`,
        { includeStops: true, includeItems: true, resetStatusToDraft: true }
      );
      toast.success(`Zlecenie skopiowane jako ${result.orderNo}.`);
      await refetch();
      // Auto-scroll na dół — kopia trafia na koniec listy (null dates, ASC nulls last)
      requestAnimationFrame(() => {
        tableScrollRef.current?.scrollTo({ top: tableScrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd kopiowania zlecenia.");
    }
  }, [api, pendingDuplicate, refetch, tableScrollRef]);

  return {
    isCreatingOrder,
    pendingCancel,
    setPendingCancel,
    pendingStatusChange,
    setPendingStatusChange,
    pendingDuplicate,
    setPendingDuplicate,
    pendingRestore,
    setPendingRestore,
    handleAddOrder,
    handleSendEmail,
    handleChangeStatusRequest,
    handleChangeStatusConfirm,
    handleCancelRequest,
    handleCancelConfirm,
    handleRestoreRequest,
    handleRestoreConfirm,
    handleSetCarrierColor,
    handleSetEntryFixed,
    handleDuplicateRequest,
    handleDuplicateConfirm,
    emailValidationErrors,
    clearEmailValidationErrors,
  };
}

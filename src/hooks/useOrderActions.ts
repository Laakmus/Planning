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
  refetch: () => void | Promise<void>;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  microsoft?: MicrosoftAuth;
}

export interface UseOrderActionsReturn {
  isCreatingOrder: boolean;
  cancelOrderId: string | null;
  setCancelOrderId: (id: string | null) => void;
  handleAddOrder: () => Promise<void>;
  handleSendEmail: (orderId: string) => Promise<void>;
  handleChangeStatus: (orderId: string, newStatus: OrderStatusCode) => Promise<void>;
  handleCancelRequest: (orderId: string) => void;
  handleCancelConfirm: () => Promise<void>;
  handleRestore: (orderId: string) => Promise<void>;
  handleSetCarrierColor: (orderId: string, color: string | null) => Promise<void>;
  handleSetEntryFixed: (orderId: string, value: boolean | null) => Promise<void>;
  handleDuplicate: (orderId: string) => Promise<void>;
  emailValidationErrors: string[];
  clearEmailValidationErrors: () => void;
}

export function useOrderActions({
  api,
  refetch,
  tableScrollRef,
  microsoft,
}: UseOrderActionsOptions): UseOrderActionsReturn {
  // Stan tworzenia nowego zlecenia (blokada przycisku + spinner)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const isCreatingRef = useRef(false);

  // Stan dialogu potwierdzenia anulowania
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

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
        paymentTermDays: null,
        paymentMethod: null,
        totalLoadTons: null,
        totalLoadVolumeM3: null,
        specialRequirements: null,
        requiredDocumentsText: null,
        generalNotes: null,
        senderContactName: null,
        senderContactPhone: null,
        senderContactEmail: null,
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

  const handleChangeStatus = useCallback(
    async (orderId: string, newStatus: OrderStatusCode) => {
      try {
        await api.post(`/api/v1/orders/${orderId}/status`, { newStatusCode: newStatus });
        toast.success("Status zmieniony.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd zmiany statusu.");
      }
    },
    [api, refetch]
  );

  const handleCancelRequest = useCallback((orderId: string) => {
    setCancelOrderId(orderId);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelOrderId) return;
    const orderId = cancelOrderId;
    setCancelOrderId(null);
    try {
      await api.delete(`/api/v1/orders/${orderId}`);
      toast.success("Zlecenie anulowane.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd anulowania zlecenia.");
    }
  }, [api, cancelOrderId, refetch]);

  const handleRestore = useCallback(
    async (orderId: string) => {
      try {
        await api.post(`/api/v1/orders/${orderId}/restore`, {});
        toast.success("Zlecenie przywrócone do Aktualnych (status: Korekta).");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd przywracania zlecenia.");
      }
    },
    [api, refetch]
  );

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

  const handleDuplicate = useCallback(
    async (orderId: string) => {
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
    },
    [api, refetch, tableScrollRef]
  );

  return {
    isCreatingOrder,
    cancelOrderId,
    setCancelOrderId,
    handleAddOrder,
    handleSendEmail,
    handleChangeStatus,
    handleCancelRequest,
    handleCancelConfirm,
    handleRestore,
    handleSetCarrierColor,
    handleSetEntryFixed,
    handleDuplicate,
    emailValidationErrors,
    clearEmailValidationErrors,
  };
}

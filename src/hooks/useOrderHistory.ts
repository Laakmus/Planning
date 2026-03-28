/**
 * Hook pobierający historię statusów i log zmian zlecenia.
 * Używany przez HistoryPanel.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { ChangeLogItemDto, ListResponse, StatusHistoryItemDto } from "@/types";

export interface UseOrderHistoryResult {
  statusHistory: StatusHistoryItemDto[];
  changeLog: ChangeLogItemDto[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Pobiera historię statusów i log zmian kluczowych pól dla zlecenia.
 * Oba endpointy wywoływane równolegle (Promise.all).
 * Anuluje poprzednie żądania HTTP przy zmianie orderId (AbortController).
 * Gdy `orderId` jest null, zwraca puste listy.
 *
 * @param orderId - UUID zlecenia lub null gdy brak wybranego zlecenia
 */
export function useOrderHistory(orderId: string | null): UseOrderHistoryResult {
  const { api } = useAuth();
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItemDto[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!orderId) {
      setStatusHistory([]);
      setChangeLog([]);
      setError(null);
      return;
    }

    // Anuluj poprzednie żądanie
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const [statusResult, changesResult] = await Promise.all([
        api.get<ListResponse<StatusHistoryItemDto>>(
          `/api/v1/orders/${orderId}/history/status`
        ),
        api.get<ListResponse<ChangeLogItemDto>>(
          `/api/v1/orders/${orderId}/history/changes`
        ),
      ]);

      setStatusHistory(statusResult.items);
      setChangeLog(changesResult.items);
    } catch (err) {
      if (controller.signal.aborted) return; // Anulowane — ignoruj
      setError(err instanceof Error ? err.message : "Błąd pobierania historii zlecenia.");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [api, orderId]);

  useEffect(() => {
    fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData]);

  return { statusHistory, changeLog, isLoading, error, refetch: fetchData };
}

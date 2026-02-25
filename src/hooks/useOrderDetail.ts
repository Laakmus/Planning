/**
 * Hook pobierający szczegółowe dane zlecenia (nagłówek + punkty + pozycje).
 * Używany przez OrderDrawer podczas otwierania/edycji zlecenia.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { OrderDetailResponseDto } from "@/types";

export interface UseOrderDetailResult {
  data: OrderDetailResponseDto | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Pobiera pełne dane zlecenia z GET /api/v1/orders/{orderId}.
 * Gdy `orderId` jest null, zwraca stan pusty (nie wykonuje zapytania).
 *
 * @param orderId - UUID zlecenia lub null gdy brak wybranego zlecenia
 */
export function useOrderDetail(orderId: string | null): UseOrderDetailResult {
  const { api } = useAuth();
  const [data, setData] = useState<OrderDetailResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staleRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!orderId) {
      setData(null);
      setError(null);
      return;
    }

    staleRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.get<OrderDetailResponseDto>(`/api/v1/orders/${orderId}`);
      if (!staleRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!staleRef.current) {
        setError(err instanceof Error ? err.message : "Błąd pobierania danych zlecenia.");
      }
    } finally {
      if (!staleRef.current) {
        setIsLoading(false);
      }
    }
  }, [api, orderId]);

  useEffect(() => {
    staleRef.current = false;
    fetchData();
    return () => {
      staleRef.current = true;
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

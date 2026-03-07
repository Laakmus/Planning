/**
 * Hook pobierający listę zleceń z API.
 * Obsługuje filtry, paginację, sortowanie i przeliczanie numeru tygodnia na zakres dat.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { weekNumberToDateRange } from "@/lib/week-utils";
import type { OrderListResponseDto } from "@/types";
import type { OrderListFilters } from "@/lib/view-models";

export interface UseOrdersResult {
  data: OrderListResponseDto | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Pobiera stronę listy zleceń zgodnie z podanymi filtrami.
 * Automatycznie przelicza `weekNumber` na `dateFrom`/`dateTo` przed wysłaniem zapytania.
 * Anuluje poprzednie żądanie HTTP przy zmianie zależności (AbortController).
 *
 * @param filters - bieżące filtry listy (widok, sortowanie, strona, itp.)
 * @param page - bieżący numer strony (1-based)
 */
export function useOrders(filters: OrderListFilters, page: number): UseOrdersResult {
  const { api } = useAuth();
  const [data, setData] = useState<OrderListResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Anuluj poprzednie żądanie
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    // Buduj parametry zapytania — undefined pomijane przez ApiClient
    const params: Record<string, string | number | string[] | undefined> = {
      view: filters.view,
      page,
      pageSize: filters.pageSize,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      transportType: filters.transportType,
      status: filters.status,
      carrierId: filters.carrierId,
      productId: filters.productId,
      loadingLocationId: filters.loadingLocationId,
      loadingCompanyId: filters.loadingCompanyId,
      unloadingLocationId: filters.unloadingLocationId,
      unloadingCompanyId: filters.unloadingCompanyId,
      search: filters.search?.trim() || undefined,
    };

    // Przelicz numer tygodnia na zakres dat (po stronie frontendu — api-plan §2.2)
    if (filters.weekNumber?.trim()) {
      const range = weekNumberToDateRange(filters.weekNumber.trim());
      if (range) {
        params.dateFrom = range.dateFrom;
        params.dateTo = range.dateTo;
      }
    } else {
      params.dateFrom = filters.dateFrom;
      params.dateTo = filters.dateTo;
    }

    try {
      const result = await api.get<OrderListResponseDto>("/api/v1/orders", params);
      setData(result);
    } catch (err) {
      if (controller.signal.aborted) return; // Anulowane — ignoruj
      setError(err instanceof Error ? err.message : "Błąd pobierania listy zleceń.");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [api, filters, page]);

  useEffect(() => {
    fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

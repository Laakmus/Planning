import { useState, useEffect, useCallback, useRef } from "react";
import type { OrderListItemDto, OrderListResponseDto } from "@/types";
import type { OrderListFilters } from "@/lib/view-models";
import { DEFAULT_FILTERS } from "@/lib/view-models";
import { apiClient, ApiError } from "@/lib/api-client";

interface UseOrdersReturn {
  orders: OrderListItemDto[];
  totalItems: number;
  isLoading: boolean;
  error: string | null;
  filters: OrderListFilters;
  setFilters: (partial: Partial<OrderListFilters>) => void;
  resetFilters: () => void;
  refresh: () => void;
}

/**
 * Hook managing the orders list — filters, sorting, fetching, and refresh.
 * Debounces text search input by 300ms.
 */
export function useOrders(): UseOrdersReturn {
  const [filters, setFiltersState] = useState<OrderListFilters>(DEFAULT_FILTERS);
  const [orders, setOrders] = useState<OrderListItemDto[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer for text search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refresh counter to trigger re-fetch
  const refreshCountRef = useRef(0);
  const [refreshCount, setRefreshCount] = useState(0);

  const fetchOrders = useCallback(async (currentFilters: OrderListFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<OrderListResponseDto>("/api/v1/orders", {
        params: {
          view: currentFilters.view,
          transportType: currentFilters.transportType,
          carrierId: currentFilters.carrierId,
          productId: currentFilters.productId,
          loadingLocationId: currentFilters.loadingLocationId,
          unloadingLocationId: currentFilters.unloadingLocationId,
          loadingDateFrom: currentFilters.loadingDateFrom,
          loadingDateTo: currentFilters.loadingDateTo,
          unloadingDateFrom: currentFilters.unloadingDateFrom,
          unloadingDateTo: currentFilters.unloadingDateTo,
          search: currentFilters.search,
          sortBy: currentFilters.sortBy,
          sortDirection: currentFilters.sortDirection,
          pageSize: currentFilters.pageSize,
          page: 1,
        },
      });

      setOrders(response.items);
      setTotalItems(response.totalItems);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.body.error.message
          : "Błąd pobierania listy zleceń";
      setError(msg);
      setOrders([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on filter/sort/refresh change
  useEffect(() => {
    fetchOrders(filters);
  }, [
    filters.view,
    filters.transportType,
    filters.carrierId,
    filters.productId,
    filters.loadingLocationId,
    filters.unloadingLocationId,
    filters.loadingDateFrom,
    filters.loadingDateTo,
    filters.unloadingDateFrom,
    filters.unloadingDateTo,
    filters.sortBy,
    filters.sortDirection,
    filters.pageSize,
    refreshCount,
    fetchOrders,
  ]);

  // Debounced search — separate effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchOrders(filters);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // Only re-run when search text changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const setFilters = useCallback((partial: Partial<OrderListFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState((prev) => ({
      ...DEFAULT_FILTERS,
      // Keep the current view tab when clearing filters
      view: prev.view,
    }));
  }, []);

  const refresh = useCallback(() => {
    refreshCountRef.current += 1;
    setRefreshCount(refreshCountRef.current);
  }, []);

  return {
    orders,
    totalItems,
    isLoading,
    error,
    filters,
    setFilters,
    resetFilters,
    refresh,
  };
}

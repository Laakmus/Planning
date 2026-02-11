import { useState, useCallback } from "react";
import type {
  StatusHistoryItemDto,
  ChangeLogItemDto,
  ListResponse,
} from "@/types";
import type { TimelineEntryViewModel } from "@/lib/view-models";
import { apiClient } from "@/lib/api-client";

interface UseOrderHistoryReturn {
  /** Merged and sorted timeline entries */
  entries: TimelineEntryViewModel[];
  /** Whether history data is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Load history for an order (fetches both status + changes in parallel) */
  loadHistory: (orderId: string) => Promise<void>;
}

/**
 * Hook for fetching and merging order change history.
 * Combines status history and field change log into a unified timeline,
 * sorted descending by changedAt, ready for display.
 */
export function useOrderHistory(): UseOrderHistoryReturn {
  const [entries, setEntries] = useState<TimelineEntryViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (orderId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both history endpoints in parallel
      const [statusResponse, changesResponse] = await Promise.all([
        apiClient.get<ListResponse<StatusHistoryItemDto>>(
          `/api/v1/orders/${orderId}/history/status`,
        ),
        apiClient.get<ListResponse<ChangeLogItemDto>>(
          `/api/v1/orders/${orderId}/history/changes`,
        ),
      ]);

      // Normalize status history entries
      const statusEntries: TimelineEntryViewModel[] = statusResponse.items.map(
        (item) => ({
          id: `status-${item.id}`,
          type: "status_change" as const,
          changedAt: item.changedAt,
          changedByUserName: item.changedByUserName,
          changedByUserId: item.changedByUserId,
          oldStatusCode: item.oldStatusCode,
          newStatusCode: item.newStatusCode,
        }),
      );

      // Normalize field change entries
      const changeEntries: TimelineEntryViewModel[] = changesResponse.items.map(
        (item) => ({
          id: `change-${item.id}`,
          type: "field_change" as const,
          changedAt: item.changedAt,
          changedByUserName: item.changedByUserName,
          changedByUserId: item.changedByUserId,
          fieldName: item.fieldName,
          oldValue: item.oldValue,
          newValue: item.newValue,
        }),
      );

      // Merge all entries
      const allEntries = [...statusEntries, ...changeEntries];

      // Sort descending by changedAt (newest first)
      allEntries.sort(
        (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
      );

      setEntries(allEntries);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Błąd ładowania historii";
      setError(msg);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { entries, isLoading, error, loadHistory };
}

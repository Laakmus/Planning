import { useState, useCallback, useRef } from "react";
import type { DictionarySyncResponseDto, DictionarySyncJobDto } from "@/types";
import { apiClient, ApiError } from "@/lib/api-client";

const POLL_INTERVAL_MS = 2000;

interface UseDictionarySyncReturn {
  isSyncing: boolean;
  error: string | null;
  startSync: () => Promise<void>;
}

/**
 * Hook managing ERP dictionary synchronization.
 * Starts sync, polls for status, and calls onComplete/onError callbacks.
 */
export function useDictionarySync(options: {
  onComplete: () => void;
  onError: (message: string) => void;
}): UseDictionarySyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollJobStatus = useCallback(
    (jobId: string) => {
      pollingRef.current = setInterval(async () => {
        try {
          const job = await apiClient.get<DictionarySyncJobDto>(
            `/api/v1/dictionary-sync/jobs/${jobId}`,
          );

          if (job.status === "COMPLETED") {
            stopPolling();
            setIsSyncing(false);
            setError(null);
            options.onComplete();
          } else if (job.status === "FAILED") {
            stopPolling();
            setIsSyncing(false);
            const msg = "Błąd synchronizacji danych";
            setError(msg);
            options.onError(msg);
          }
          // STARTED / IN_PROGRESS — keep polling
        } catch {
          stopPolling();
          setIsSyncing(false);
          const msg = "Błąd sprawdzania statusu synchronizacji";
          setError(msg);
          options.onError(msg);
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, options],
  );

  const startSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await apiClient.post<DictionarySyncResponseDto>(
        "/api/v1/dictionary-sync/run",
        { resources: ["COMPANIES", "LOCATIONS", "PRODUCTS"] },
      );

      pollJobStatus(response.jobId);
    } catch (err) {
      setIsSyncing(false);
      const msg =
        err instanceof ApiError
          ? err.body.error.message
          : "Nie udało się rozpocząć synchronizacji";
      setError(msg);
      options.onError(msg);
    }
  }, [pollJobStatus, options]);

  return { isSyncing, error, startSync };
}

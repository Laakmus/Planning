/**
 * Hook zarządzający synchronizacją słowników z ERP.
 * Używany przez SyncButton w AppSidebar.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useDictionaries } from "@/contexts/DictionaryContext";
import type { DictionarySyncCommand, DictionarySyncJobDto, DictionarySyncResponseDto } from "@/types";

/** Status synchronizacji. */
export type SyncStatus = "idle" | "running" | "success" | "error";

/** Interwał pollingu (ms). */
const POLL_INTERVAL_MS = 1500;
/** Maksymalna liczba prób pollingu (~60 s). */
const POLL_MAX_ATTEMPTS = 40;

export interface UseDictionarySyncResult {
  status: SyncStatus;
  error: string | null;
  /**
   * Uruchamia synchronizację słowników.
   * Domyślnie synchronizuje wszystkie zasoby (COMPANIES, LOCATIONS, PRODUCTS).
   */
  startSync: (resources?: DictionarySyncCommand["resources"]) => Promise<void>;
}

/**
 * Uruchamia POST /api/v1/dictionary-sync/run, a następnie polluje
 * GET /api/v1/dictionary-sync/jobs/{jobId} do ukończenia jobu.
 * Po sukcesie odświeża lokalny cache słowników.
 */
export function useDictionarySync(): UseDictionarySyncResult {
  const { api } = useAuth();
  const { refreshDictionaries } = useDictionaries();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const startSync = useCallback(
    async (
      resources: DictionarySyncCommand["resources"] = ["COMPANIES", "LOCATIONS", "PRODUCTS"]
    ) => {
      if (status === "running") return;

      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }

      if (!mountedRef.current) return;
      setStatus("running");
      setError(null);

      let jobId: string;
      try {
        const response = await api.post<DictionarySyncResponseDto>(
          "/api/v1/dictionary-sync/run",
          { resources }
        );
        jobId = response.jobId;
      } catch (err) {
        if (mountedRef.current) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Nie udało się uruchomić synchronizacji.");
        }
        return;
      }

      let attempts = 0;

      const poll = async () => {
        if (!mountedRef.current) return;
        if (attempts >= POLL_MAX_ATTEMPTS) {
          setStatus("error");
          setError("Synchronizacja trwa zbyt długo. Spróbuj ponownie.");
          return;
        }
        attempts++;

        try {
          const job = await api.get<DictionarySyncJobDto>(
            `/api/v1/dictionary-sync/jobs/${jobId}`
          );

          if (!mountedRef.current) return;

          const jobStatus = job.status.toUpperCase();
          if (jobStatus === "COMPLETED") {
            await refreshDictionaries();
            if (!mountedRef.current) return;
            setStatus("success");
            // Wróć do "idle" po 3 s
            pollTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) setStatus("idle");
            }, 3000);
          } else if (jobStatus === "FAILED") {
            setStatus("error");
            setError("Synchronizacja zakończyła się błędem.");
          } else {
            pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (err) {
          if (mountedRef.current) {
            setStatus("error");
            setError(
              err instanceof Error ? err.message : "Błąd sprawdzania statusu synchronizacji."
            );
          }
        }
      };

      pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    },
    [api, refreshDictionaries, status]
  );

  return { status, error, startSync };
}

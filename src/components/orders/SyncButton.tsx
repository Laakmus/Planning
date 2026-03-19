/**
 * Przycisk synchronizacji słowników ERP.
 * Widoczny tylko dla ról ADMIN i PLANNER.
 * Pokazuje spinner i toast po zakończeniu.
 */

import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDictionarySync } from "@/hooks/useDictionarySync";

export default function SyncButton() {
  const { user } = useAuth();
  const { status, error, startSync } = useDictionarySync();
  // Flaga zapobiegająca powtórnemu wyświetlaniu toasta
  const toastShownRef = useRef(false);

  useEffect(() => {
    if ((status === "success" || status === "error") && !toastShownRef.current) {
      toastShownRef.current = true;
      if (status === "success") {
        toast.success("Słowniki zostały zsynchronizowane.");
      } else if (error) {
        toast.error(error);
      }
    }
    // Reset flagi gdy status wraca do idle/running (nowa synchronizacja)
    if (status === "idle" || status === "running") {
      toastShownRef.current = false;
    }
  }, [status, error]);

  if (!user || user.role === "READ_ONLY") return null;

  const isRunning = status === "running";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => startSync()}
      disabled={isRunning}
      className="h-8 gap-1.5 text-xs"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
      {isRunning ? "Synchronizacja..." : "Aktualizuj dane"}
    </Button>
  );
}

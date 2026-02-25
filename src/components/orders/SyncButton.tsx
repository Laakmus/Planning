/**
 * Przycisk synchronizacji słowników ERP.
 * Widoczny tylko dla ról ADMIN i PLANNER.
 * Pokazuje spinner i toast po zakończeniu.
 */

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDictionarySync } from "@/hooks/useDictionarySync";

export default function SyncButton() {
  const { user } = useAuth();
  const { status, error, startSync } = useDictionarySync();

  useEffect(() => {
    if (status === "success") {
      toast.success("Słowniki zostały zsynchronizowane.");
    } else if (status === "error" && error) {
      toast.error(error);
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

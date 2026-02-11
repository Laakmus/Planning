import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { useDictionarySync } from "@/hooks/useDictionarySync";
import { toast } from "sonner";

/**
 * "Aktualizuj dane" button — triggers ERP dictionary sync.
 * Visible only for ADMIN and PLANNER roles.
 */
export function SyncButton() {
  const { user } = useAuth();
  const { refreshDictionaries } = useDictionaries();

  const { isSyncing, startSync } = useDictionarySync({
    onComplete: () => {
      toast.success("Dane zostały zsynchronizowane");
      refreshDictionaries();
    },
    onError: (message) => {
      toast.error(message);
    },
  });

  // Only ADMIN and PLANNER can sync
  if (!user || user.role === "READ_ONLY") {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={startSync}
      disabled={isSyncing}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Synchronizacja..." : "Aktualizuj dane"}
    </Button>
  );
}

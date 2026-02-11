import { useEffect, useMemo } from "react";
import { History, Loader2, AlertTriangle, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TimelineEntryViewModel } from "@/lib/view-models";
import { useOrderHistory } from "@/hooks/useOrderHistory";
import { TimelineGroup } from "./TimelineGroup";

interface HistoryPanelProps {
  orderId: string | null;
  orderNo: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Group timeline entries by date (Polish locale).
 * Returns array of { dateLabel, entries } sorted newest date first.
 */
function groupByDate(
  entries: TimelineEntryViewModel[],
): { dateLabel: string; entries: TimelineEntryViewModel[] }[] {
  const groups = new Map<string, TimelineEntryViewModel[]>();

  for (const entry of entries) {
    const dateKey = entry.changedAt.slice(0, 10); // YYYY-MM-DD
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  }

  const today = new Date();
  const todayStr = formatDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateKey(yesterday);

  return Array.from(groups.entries()).map(([dateKey, entries]) => {
    let dateLabel: string;
    if (dateKey === todayStr) {
      dateLabel = "Dzisiaj";
    } else if (dateKey === yesterdayStr) {
      dateLabel = "Wczoraj";
    } else {
      dateLabel = formatFullDate(dateKey);
    }
    return { dateLabel, entries };
  });
}

/** Format YYYY-MM-DD to YYYY-MM-DD key */
function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Format YYYY-MM-DD to full Polish date string */
function formatFullDate(dateKey: string): string {
  try {
    const date = new Date(dateKey + "T00:00:00");
    return date.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateKey;
  }
}

/**
 * History panel — side sheet (450px) showing merged order change timeline.
 * Matches test/history.html mockup design.
 */
export function HistoryPanel({
  orderId,
  orderNo,
  isOpen,
  onClose,
}: HistoryPanelProps) {
  const { entries, isLoading, error, loadHistory } = useOrderHistory();

  // Load history when panel opens
  useEffect(() => {
    if (isOpen && orderId) {
      loadHistory(orderId);
    }
  }, [isOpen, orderId, loadHistory]);

  // Group entries by date
  const groups = useMemo(() => groupByDate(entries), [entries]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[450px] flex flex-col p-0 border-l border-slate-200 dark:border-slate-800"
        showCloseButton={false}
      >
        {/* Header — matches mockup: sticky, backdrop-blur */}
        <SheetHeader className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-background/80 dark:bg-[#16202a]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div>
              <SheetTitle className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Historia zmian
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Zlecenie #{orderNo || "—"}
              </SheetDescription>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        {/* Body — scrollable timeline */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <History className="h-8 w-8" />
              <p className="text-sm">Brak historii zmian</p>
            </div>
          ) : (
            <ScrollArea className="h-full custom-scrollbar">
              <div className="px-6 py-4">
                {groups.map((group) => (
                  <TimelineGroup
                    key={group.dateLabel}
                    dateLabel={group.dateLabel}
                    entries={group.entries}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer — legend matching mockup */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101922]">
          <div className="flex items-center justify-center gap-6 opacity-60">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] font-bold uppercase">Systemowe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[10px] font-bold uppercase">Manualne</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

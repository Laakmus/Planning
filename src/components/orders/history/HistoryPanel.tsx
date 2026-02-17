/**
 * Panel historii zmian zlecenia.
 * Sheet (side="right", ~450px) z osiami czasu statusów i pól.
 * Scala wyniki useOrderHistory i grupuje po dacie.
 */

import { History, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { useOrderHistory } from "@/hooks/useOrderHistory";
import type { ChangeLogItemDto, StatusHistoryItemDto } from "@/types";
import type { TimelineEntryViewModel } from "@/lib/view-models";

import { TimelineGroup } from "./TimelineGroup";

interface HistoryPanelProps {
  orderId: string | null;
  orderNo: string;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Merge & sort helpers
// ---------------------------------------------------------------------------

function mergeToTimeline(
  statusHistory: StatusHistoryItemDto[],
  changeLog: ChangeLogItemDto[]
): TimelineEntryViewModel[] {
  const entries: TimelineEntryViewModel[] = [];

  for (const s of statusHistory) {
    entries.push({
      id: `status-${s.id}`,
      type: "status_change",
      changedAt: s.changedAt,
      changedByUserName: s.changedByUserName,
      changedByUserId: s.changedByUserId,
      oldStatusCode: s.oldStatusCode,
      newStatusCode: s.newStatusCode,
    });
  }

  for (const c of changeLog) {
    entries.push({
      id: `change-${c.id}`,
      type: "field_change",
      changedAt: c.changedAt,
      changedByUserName: c.changedByUserName,
      changedByUserId: c.changedByUserId,
      fieldName: c.fieldName,
      oldValue: c.oldValue,
      newValue: c.newValue,
    });
  }

  // Sortuj malejąco (najnowsze pierwsze)
  entries.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return entries;
}

/** Grupuje wpisy po dacie (YYYY-MM-DD) */
function groupByDate(
  entries: TimelineEntryViewModel[]
): { date: string; entries: TimelineEntryViewModel[] }[] {
  const map = new Map<string, TimelineEntryViewModel[]>();

  for (const entry of entries) {
    const date = entry.changedAt.substring(0, 10);
    const group = map.get(date) ?? [];
    group.push(entry);
    map.set(date, group);
  }

  // Daty malejąco
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, entries: items }));
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

export function HistoryPanel({ orderId, orderNo, isOpen, onClose }: HistoryPanelProps) {
  const { statusHistory, changeLog, isLoading, error } = useOrderHistory(
    isOpen ? orderId : null
  );

  const timeline = mergeToTimeline(statusHistory, changeLog);
  const groups = groupByDate(timeline);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[450px] p-0 flex flex-col"
        onInteractOutside={() => onClose()}
        onEscapeKeyDown={() => onClose()}
      >
        {/* Nagłówek */}
        <div className="shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Historia zmian
              </p>
              {orderNo && (
                <p className="text-xs text-slate-500">{orderNo}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Treść */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        {!isLoading && !error && groups.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2">
            <History className="w-8 h-8 text-slate-300" />
            <p className="text-sm text-slate-500">Brak historii dla tego zlecenia.</p>
          </div>
        )}

        {!isLoading && !error && groups.length > 0 && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4">
              {groups.map((group) => (
                <TimelineGroup
                  key={group.date}
                  date={group.date}
                  entries={group.entries}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Stopka z legendą */}
        {!isLoading && !error && groups.length > 0 && (
          <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-center gap-6 opacity-60">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dane</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Systemowe</span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

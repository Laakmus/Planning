/**
 * Pasek stopki sticky na dole ekranu (h-10).
 *
 * Lewa strona: liczniki zleceń dla bieżącej zakładki.
 * Prawa strona: status systemu + czas ostatniej aktualizacji.
 *
 * BEZ liczników "W trasie", "Załadunek", "Opóźnione" — usunięte z projektu (PRD 3.1.2a).
 */

import type { OrderStatusCode, ViewGroup } from "@/lib/view-models";

interface StatusFooterProps {
  activeView: ViewGroup;
  /** Łączna liczba zleceń w bieżącej zakładce (totalItems z API). */
  totalItems: number;
  /** Opcjonalne liczniki per status (do wyświetlania szczegółowych statystyk). */
  statusCounts?: Partial<Record<OrderStatusCode, number>>;
  /** ISO timestamp ostatniego odświeżenia listy lub null. */
  lastUpdateTime: string | null;
}

const VIEW_LABELS: Record<ViewGroup, string> = {
  CURRENT: "Aktywne",
  COMPLETED: "Zrealizowane",
  CANCELLED: "Anulowane",
};

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function StatusFooter({
  activeView,
  totalItems,
  lastUpdateTime,
}: StatusFooterProps) {
  const label = VIEW_LABELS[activeView];

  return (
    <footer className="h-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 z-50 sticky bottom-0">
      {/* Lewa strona: liczniki */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label}: {totalItems}
          </span>
        </div>
      </div>

      {/* Prawa strona: system status + czas aktualizacji */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>System Status: OK</span>
        {lastUpdateTime && (
          <span>Ostatnia aktualizacja: {formatTime(lastUpdateTime)}</span>
        )}
      </div>
    </footer>
  );
}

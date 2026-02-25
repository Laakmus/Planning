/**
 * Komponent pustego stanu — brak zleceń lub brak wyników filtrów.
 */

import { InboxIcon, SearchX } from "lucide-react";

interface EmptyStateProps {
  /** true = aktywne filtry, false = brak zleceń w zakładce */
  hasFilters: boolean;
  /** Widoczny tylko dla CURRENT + Admin/Planner — otwiera formularz nowego zlecenia. */
  showAddButton?: boolean;
  isAddingOrder?: boolean;
  onAddOrder?: () => void;
  onClearFilters?: () => void;
}

export function EmptyState({
  hasFilters,
  showAddButton,
  isAddingOrder,
  onAddOrder,
  onClearFilters,
}: EmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl py-16 flex flex-col items-center justify-center text-center mx-4 my-4">
        <SearchX className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
          Brak wyników dla zastosowanych filtrów
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Spróbuj zmienić kryteria wyszukiwania.
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Wyczyść filtry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl py-16 flex flex-col items-center justify-center text-center mx-4 my-4">
      <InboxIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
        Brak zleceń
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        Nie masz jeszcze żadnych zleceń w tej zakładce.
      </p>
      {showAddButton && onAddOrder && (
        <button
          onClick={onAddOrder}
          disabled={isAddingOrder}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAddingOrder ? "Tworzenie..." : "Nowe zlecenie"}
        </button>
      )}
    </div>
  );
}

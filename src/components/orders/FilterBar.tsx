/**
 * Pasek filtrów pod AppHeader.
 * Kolejność zgodna z PRD 3.1.2a:
 * 1. Rodzaj transportu | 2. Status | 3. Firma załadunku | 4. Firma rozładunku
 * 5. Firma transportowa | 6. Towar | 7. Numer tygodnia | 8. Wyszukiwanie
 * 9. Wyczyść filtry | [ml-auto] ListSettings + Nowe zlecenie
 */

import { Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDictionaries } from "@/contexts/DictionaryContext";
import type { OrderListFilters } from "@/lib/view-models";
import type { ListViewMode } from "@/lib/view-models";

import { AutocompleteFilter } from "./AutocompleteFilter";
import { ListSettings } from "./ListSettings";

interface FilterBarProps {
  filters: OrderListFilters;
  viewMode: ListViewMode;
  onFiltersChange: (patch: Partial<OrderListFilters>) => void;
  onClearFilters: () => void;
  onPageSizeChange: (size: number) => void;
  onViewModeChange: (mode: ListViewMode) => void;
  /** Przycisk "Nowe zlecenie" widoczny tylko w Aktualne + Admin/Planner */
  showAddButton: boolean;
  onAddOrder: () => void;
}

export function FilterBar({
  filters,
  viewMode,
  onFiltersChange,
  onClearFilters,
  onPageSizeChange,
  onViewModeChange,
  showAddButton,
  onAddOrder,
}: FilterBarProps) {
  const { companies, products, transportTypes, orderStatuses } = useDictionaries();

  // Debounce dla pól tekstowych (wyszukiwanie, numer tygodnia)
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [weekInput, setWeekInput] = useState(filters.weekNumber ?? "");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync gdy filtry zostają wyczyszczone z zewnątrz
  useEffect(() => {
    setSearchInput(filters.search ?? "");
    setWeekInput(filters.weekNumber ?? "");
  }, [filters.search, filters.weekNumber]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onFiltersChange({ search: value || undefined });
    }, 300);
  }

  function handleWeekChange(value: string) {
    setWeekInput(value);
    if (weekDebounceRef.current) clearTimeout(weekDebounceRef.current);
    weekDebounceRef.current = setTimeout(() => {
      onFiltersChange({ weekNumber: value || undefined });
    }, 300);
  }

  // Listy pozycji dla autocomplete
  const companyItems = companies.map((c) => ({ id: c.id, label: c.name }));
  const productItems = products.map((p) => ({ id: p.id, label: p.name }));

  const hasActiveFilters =
    !!filters.transportType ||
    !!filters.status ||
    !!filters.carrierId ||
    !!filters.productId ||
    !!filters.loadingCompanyId ||
    !!filters.loadingLocationId ||
    !!filters.unloadingCompanyId ||
    !!filters.unloadingLocationId ||
    !!filters.weekNumber ||
    !!filters.search;

  return (
    <div className="shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center gap-2">
      {/* 1. Rodzaj transportu */}
      <select
        value={filters.transportType ?? ""}
        onChange={(e) =>
          onFiltersChange({ transportType: (e.target.value as OrderListFilters["transportType"]) || undefined })
        }
        className="h-8 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 text-slate-700 dark:text-slate-300"
      >
        <option value="">Rodzaj transportu</option>
        {transportTypes.map((t) => (
          <option key={t.code} value={t.code}>
            {t.name}
          </option>
        ))}
      </select>

      {/* 2. Status */}
      <select
        value={filters.status ?? ""}
        onChange={(e) => onFiltersChange({ status: e.target.value || undefined })}
        className="h-8 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 text-slate-700 dark:text-slate-300"
      >
        <option value="">Status</option>
        {orderStatuses.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </select>

      {/* 3. Firma załadunku */}
      <AutocompleteFilter
        label="Firma załadunku"
        items={companyItems}
        value={filters.loadingCompanyId}
        onChange={(id) => onFiltersChange({ loadingCompanyId: id, loadingLocationId: undefined })}
        width="w-36"
      />

      {/* 4. Firma rozładunku */}
      <AutocompleteFilter
        label="Firma rozładunku"
        items={companyItems}
        value={filters.unloadingCompanyId}
        onChange={(id) => onFiltersChange({ unloadingCompanyId: id, unloadingLocationId: undefined })}
        width="w-36"
      />

      {/* 5. Firma transportowa */}
      <AutocompleteFilter
        label="Firma transp."
        items={companyItems}
        value={filters.carrierId}
        onChange={(id) => onFiltersChange({ carrierId: id })}
        width="w-32"
      />

      {/* 6. Towar */}
      <AutocompleteFilter
        label="Towar"
        items={productItems}
        value={filters.productId}
        onChange={(id) => onFiltersChange({ productId: id })}
        width="w-28"
      />

      {/* 7. Numer tygodnia */}
      <input
        type="text"
        placeholder="Tydzień"
        value={weekInput}
        onChange={(e) => handleWeekChange(e.target.value)}
        className="h-8 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 w-16 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
      />

      {/* 8. Wyszukiwanie pełnotekstowe */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Szukaj..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-8 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-7 pr-2 w-28 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
        />
      </div>

      {/* 9. Wyczyść filtry */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="h-8 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 flex items-center gap-1 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Wyczyść filtry
        </button>
      )}

      {/* Prawa strona: ListSettings + Nowe zlecenie */}
      <div className="ml-auto flex items-center gap-2">
        <ListSettings
          pageSize={filters.pageSize}
          viewMode={viewMode}
          onPageSizeChange={onPageSizeChange}
          onViewModeChange={onViewModeChange}
        />

        {showAddButton && (
          <button
            onClick={onAddOrder}
            className="inline-flex items-center gap-1 h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nowe zlecenie
          </button>
        )}
      </div>
    </div>
  );
}

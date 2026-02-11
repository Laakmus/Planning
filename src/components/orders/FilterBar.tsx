import { useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { AutocompleteFilter } from "./AutocompleteFilter";
import { DatePickerField } from "@/components/shared/DatePickerField";
import type { OrderListFilters } from "@/lib/view-models";
import type { TransportTypeCode } from "@/types";

interface FilterBarProps {
  filters: OrderListFilters;
  onFiltersChange: (filters: Partial<OrderListFilters>) => void;
  onClearFilters: () => void;
}

/** Label styling matching mockup: text-[10px] uppercase font-bold text-slate-500 tracking-wider */
function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
      {children}
    </label>
  );
}

/**
 * Filter bar above the orders table.
 * Per UI Plan 6.8 and test/widok_main_skrot.html mockup.
 */
export function FilterBar({ filters, onFiltersChange, onClearFilters }: FilterBarProps) {
  const { companies, locations, products, transportTypes } = useDictionaries();

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ search: e.target.value || undefined });
    },
    [onFiltersChange],
  );

  // Date range validation: dateFrom <= dateTo
  const loadingDateError = useMemo(() => {
    if (filters.loadingDateFrom && filters.loadingDateTo && filters.loadingDateFrom > filters.loadingDateTo) {
      return "Data 'od' nie może być późniejsza niż 'do'";
    }
    return null;
  }, [filters.loadingDateFrom, filters.loadingDateTo]);

  // Check if any filter is active (to show "Clear" button)
  const hasActiveFilters =
    !!filters.transportType ||
    !!filters.carrierId ||
    !!filters.productId ||
    !!filters.loadingLocationId ||
    !!filters.unloadingLocationId ||
    !!filters.loadingDateFrom ||
    !!filters.loadingDateTo ||
    !!filters.unloadingDateFrom ||
    !!filters.unloadingDateTo ||
    !!filters.search;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Carrier */}
      <div className="space-y-1">
        <FilterLabel>Przewoźnik</FilterLabel>
        <AutocompleteFilter
          label="Wszyscy przewoźnicy"
          placeholder="Szukaj przewoźnika..."
          items={companies}
          value={filters.carrierId}
          displayField="name"
          searchFields={["name", "taxId"]}
          onChange={(id) => onFiltersChange({ carrierId: id })}
        />
      </div>

      {/* Product */}
      <div className="space-y-1">
        <FilterLabel>Towar</FilterLabel>
        <AutocompleteFilter
          label="Wszystkie towary"
          placeholder="Szukaj towaru..."
          items={products}
          value={filters.productId}
          displayField="name"
          searchFields={["name"]}
          onChange={(id) => onFiltersChange({ productId: id })}
        />
      </div>

      {/* Route: Loading → Unloading */}
      <div className="space-y-1">
        <FilterLabel>Relacja (Od / Do)</FilterLabel>
        <div className="flex items-center gap-1">
          <AutocompleteFilter
            label="Załadunek"
            placeholder="Szukaj lokalizacji..."
            items={locations}
            value={filters.loadingLocationId}
            displayField="name"
            searchFields={["name", "city"]}
            onChange={(id) => onFiltersChange({ loadingLocationId: id })}
          />
          <span className="text-slate-400 text-xs px-1">→</span>
          <AutocompleteFilter
            label="Rozładunek"
            placeholder="Szukaj lokalizacji..."
            items={locations}
            value={filters.unloadingLocationId}
            displayField="name"
            searchFields={["name", "city"]}
            onChange={(id) => onFiltersChange({ unloadingLocationId: id })}
          />
        </div>
      </div>

      {/* Date range */}
      <div className="space-y-1">
        <FilterLabel>Zakres Dat</FilterLabel>
        <div className="flex items-end gap-1">
          <div className="w-28">
            <DatePickerField
              value={filters.loadingDateFrom ?? null}
              onChange={(val) => onFiltersChange({ loadingDateFrom: val ?? undefined })}
              placeholder="Od"
              error={loadingDateError ?? undefined}
            />
          </div>
          <span className="text-slate-400 text-xs px-0.5 pb-2">–</span>
          <div className="w-28">
            <DatePickerField
              value={filters.loadingDateTo ?? null}
              onChange={(val) => onFiltersChange({ loadingDateTo: val ?? undefined })}
              placeholder="Do"
            />
          </div>
        </div>
      </div>

      {/* Transport type */}
      <div className="space-y-1">
        <FilterLabel>Typ</FilterLabel>
        <Select
          value={filters.transportType ?? "ALL"}
          onValueChange={(v) =>
            onFiltersChange({
              transportType: v === "ALL" ? undefined : (v as TransportTypeCode),
            })
          }
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Typ transportu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {transportTypes.map((tt) => (
              <SelectItem key={tt.code} value={tt.code}>
                {tt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Text search */}
      <div className="space-y-1">
        <FilterLabel>Szukaj</FilterLabel>
        <div className="relative w-40">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Szukaj zlecenia..."
            value={filters.search ?? ""}
            onChange={handleSearchChange}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 text-xs">
          <X className="mr-1 h-3.5 w-3.5" />
          Wyczyść
        </Button>
      )}
    </div>
  );
}

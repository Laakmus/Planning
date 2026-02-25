/**
 * Ustawienia listy: rozmiar strony + przełącznik widoku Trasa | Kolumny.
 * Renderowany po prawej stronie FilterBar (ml-auto).
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE_SIZES } from "@/lib/view-models";
import type { ListViewMode } from "@/lib/view-models";

interface ListSettingsProps {
  pageSize: number;
  viewMode: ListViewMode;
  onPageSizeChange: (size: number) => void;
  onViewModeChange: (mode: ListViewMode) => void;
}

export function ListSettings({
  pageSize,
  viewMode,
  onPageSizeChange,
  onViewModeChange,
}: ListSettingsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Rozmiar strony */}
      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
      >
        <SelectTrigger className="h-8 w-16 text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEFAULT_PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)} className="text-xs">
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Przełącznik Trasa | Kolumny */}
      <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-600">
        <button
          onClick={() => onViewModeChange("route")}
          className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
            viewMode === "route"
              ? "bg-primary text-white"
              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
          }`}
        >
          Trasa
        </button>
        <button
          onClick={() => onViewModeChange("columns")}
          className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
            viewMode === "columns"
              ? "bg-primary text-white"
              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
          }`}
        >
          Kolumny
        </button>
      </div>
    </div>
  );
}

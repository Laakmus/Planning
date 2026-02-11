import { Route, Columns3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ListViewMode } from "@/lib/view-models";

interface ListSettingsProps {
  pageSize: number;
  viewMode: ListViewMode;
  onPageSizeChange: (size: number) => void;
  onViewModeChange: (mode: ListViewMode) => void;
}

/**
 * Page size selector + view mode toggle (Route / Columns).
 */
export function ListSettings({
  pageSize,
  viewMode,
  onPageSizeChange,
  onViewModeChange,
}: ListSettingsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Page size */}
      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
      >
        <SelectTrigger className="h-8 w-24 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
          <SelectItem value="200">200</SelectItem>
        </SelectContent>
      </Select>

      {/* View mode toggle */}
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(v) => {
          if (v) onViewModeChange(v as ListViewMode);
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="route" aria-label="Widok trasy" className="h-8 px-2.5">
              <Route className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Widok trasy</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="columns" aria-label="Widok kolumn" className="h-8 px-2.5">
              <Columns3 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Widok kolumn</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  );
}

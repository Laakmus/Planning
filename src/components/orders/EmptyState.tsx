import { FileX2, SearchX, AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewGroup } from "@/types";

interface EmptyStateProps {
  variant: "no_orders" | "no_results" | "too_many_results";
  activeView: ViewGroup;
  onAddOrder?: () => void;
  onClearFilters?: () => void;
}

const CONFIGS = {
  no_orders: {
    icon: FileX2,
    title: "Brak zleceń",
    description: "Nie ma jeszcze żadnych zleceń w tej zakładce.",
  },
  no_results: {
    icon: SearchX,
    title: "Brak wyników",
    description: "Nie znaleziono zleceń dla zastosowanych filtrów.",
  },
  too_many_results: {
    icon: AlertTriangle,
    title: "Zbyt wiele wyników",
    description: "Zawęź filtry, aby wyświetlić listę zleceń.",
  },
};

/**
 * Empty state displayed when the orders list has no results.
 * Three variants with contextual CTA buttons.
 */
export function EmptyState({ variant, activeView, onAddOrder, onClearFilters }: EmptyStateProps) {
  const config = CONFIGS[variant];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <h3 className="text-lg font-medium">{config.title}</h3>
      <p className="text-sm text-muted-foreground">{config.description}</p>
      <div className="mt-2 flex gap-2">
        {variant === "no_orders" && activeView === "CURRENT" && onAddOrder && (
          <Button variant="outline" size="sm" onClick={onAddOrder}>
            <Plus className="mr-1 h-4 w-4" />
            Dodaj nowy wiersz
          </Button>
        )}
        {variant === "no_results" && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <X className="mr-1 h-4 w-4" />
            Wyczyść filtry
          </Button>
        )}
      </div>
    </div>
  );
}

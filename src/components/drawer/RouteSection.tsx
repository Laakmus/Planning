import type { OrderFormStop } from "@/lib/view-models";
import { RoutePointList } from "./RoutePointList";

interface RouteSectionProps {
  stops: OrderFormStop[];
  isReadOnly: boolean;
  errors?: Record<string, string>;
  onStopsChange: (stops: OrderFormStop[]) => void;
}

/**
 * Route section of the order form.
 * Contains the list of loading and unloading points.
 */
export function RouteSection({
  stops,
  isReadOnly,
  errors,
  onStopsChange,
}: RouteSectionProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Trasa
      </legend>

      <RoutePointList
        stops={stops}
        onChange={onStopsChange}
        disabled={isReadOnly}
        errors={errors}
      />
    </fieldset>
  );
}

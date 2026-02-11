import { GripVertical, ArrowUp, ArrowDown, Trash2, MapPin } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocationDto } from "@/types";
import type { OrderFormStop } from "@/lib/view-models";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { AutocompleteField } from "./AutocompleteField";
import { DatePickerField } from "@/components/shared/DatePickerField";
import { TimePickerField } from "@/components/shared/TimePickerField";

interface RoutePointCardProps {
  /** Unique ID for sortable (must be stable string) */
  sortableId: string;
  stop: OrderFormStop;
  index: number;
  totalCount: number;
  onChange: (stop: OrderFormStop) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

/**
 * Single route point card with:
 * - Drag handle (via @dnd-kit/sortable)
 * - Badge (LOADING/UNLOADING) with color
 * - Date + Time pickers
 * - Location autocomplete (auto-fills address)
 * - Address (readonly, from location)
 * - Notes
 * - Move up/down buttons + remove button
 */
export function RoutePointCard({
  sortableId,
  stop,
  index,
  totalCount,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled = false,
  errors,
}: RoutePointCardProps) {
  const { locations } = useDictionaries();

  // @dnd-kit sortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isLoading = stop.kind === "LOADING";
  const badgeLabel = isLoading ? "Załadunek" : "Rozładunek";
  const badgeClasses = isLoading
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-orange-100 text-orange-700 border-orange-200";

  const handleLocationSelect = (location: LocationDto | null) => {
    if (location) {
      const addressParts = [
        location.streetAndNumber,
        location.postalCode,
        location.city,
        location.country,
      ].filter(Boolean);

      onChange({
        ...stop,
        locationId: location.id,
        locationNameSnapshot: location.name,
        companyNameSnapshot: null,
        addressSnapshot: addressParts.join(", "),
      });
    } else {
      onChange({
        ...stop,
        locationId: null,
        locationNameSnapshot: null,
        companyNameSnapshot: null,
        addressSnapshot: null,
      });
    }
  };

  const errorPrefix = `stops.${index}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-4 space-y-3"
    >
      {/* Header row: drag handle + badge + move buttons + remove */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!disabled && (
            <button
              className="touch-none cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
              aria-label="Przeciągnij aby zmienić kolejność"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <Badge variant="outline" className={badgeClasses}>
            <MapPin className="mr-1 h-3 w-3" />
            {badgeLabel} #{index + 1}
          </Badge>
        </div>

        {!disabled && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onMoveUp}
              disabled={index === 0}
              title="Przesuń w górę"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onMoveDown}
              disabled={index === totalCount - 1}
              title="Przesuń w dół"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              title="Usuń punkt"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Date + Time row */}
      <div className="grid grid-cols-2 gap-3">
        <DatePickerField
          label="Data"
          value={stop.dateLocal}
          onChange={(val) => onChange({ ...stop, dateLocal: val })}
          disabled={disabled}
          error={errors?.[`${errorPrefix}.dateLocal`]}
        />
        <TimePickerField
          label="Godzina"
          value={stop.timeLocal}
          onChange={(val) => onChange({ ...stop, timeLocal: val })}
          disabled={disabled}
          error={errors?.[`${errorPrefix}.timeLocal`]}
        />
      </div>

      {/* Location autocomplete */}
      <AutocompleteField<LocationDto>
        label="Lokalizacja"
        placeholder="Wybierz lokalizację..."
        items={locations}
        value={stop.locationId}
        displayValue={stop.locationNameSnapshot}
        searchFields={["name", "city", "streetAndNumber"]}
        onSelect={handleLocationSelect}
        disabled={disabled}
        error={errors?.[`${errorPrefix}.locationId`]}
      />

      {/* Address (readonly, auto-filled from location) */}
      {stop.addressSnapshot && (
        <div className="text-xs text-muted-foreground">
          {stop.addressSnapshot}
        </div>
      )}

      {/* Notes */}
      <Input
        value={stop.notes ?? ""}
        onChange={(e) => onChange({ ...stop, notes: e.target.value || null })}
        placeholder="Uwagi do punktu..."
        disabled={disabled}
        maxLength={500}
        className="text-sm"
      />
    </div>
  );
}

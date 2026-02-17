/**
 * Karta pojedynczego punktu trasy (załadunek / rozładunek).
 * Pola: data, godzina, firma (autocomplete), lokalizacja (select), uwagi.
 * Obsługuje drag-and-drop (useSortable) oraz przyciski Move Up / Move Down.
 */

import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyDto, LocationDto } from "@/types";
import type { OrderFormStop, StopKind } from "@/lib/view-models";

import { AutocompleteField } from "./AutocompleteField";

interface RoutePointCardProps {
  stop: OrderFormStop;
  index: number;
  sortableId: string;
  loadingIndex?: number;
  unloadingIndex?: number;
  companies: CompanyDto[];
  locations: LocationDto[];
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormStop>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const KIND_LABEL: Record<StopKind, string> = {
  LOADING: "Załadunek",
  UNLOADING: "Rozładunek",
};

const KIND_BADGE_CLASS: Record<StopKind, string> = {
  LOADING: "bg-emerald-100 text-emerald-700",
  UNLOADING: "bg-orange-100 text-orange-700",
};

export function RoutePointCard({
  stop,
  index,
  sortableId,
  loadingIndex,
  unloadingIndex,
  companies,
  locations,
  isReadOnly,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: RoutePointCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  const kind = stop.kind as StopKind;
  const kindLabel = KIND_LABEL[kind] ?? kind;
  const badgeClass = KIND_BADGE_CLASS[kind] ?? "bg-slate-100 text-slate-700";

  // Etykieta: L1, L2... / U1, U2...
  const seqLabel = kind === "LOADING"
    ? `L${(loadingIndex ?? 0) + 1}`
    : `U${(unloadingIndex ?? 0) + 1}`;

  // Lokalizacje filtrowane po firmie
  const selectedCompany = stop.companyNameSnapshot
    ? companies.find((c) => c.name === stop.companyNameSnapshot)
    : null;

  const filteredLocations = selectedCompany
    ? locations.filter((l) => l.companyId === selectedCompany.id)
    : locations;

  function handleCompanyChange(_id: string | null, item: CompanyDto | null) {
    onChange({
      companyNameSnapshot: item?.name ?? null,
      locationId: null,
      locationNameSnapshot: null,
      addressSnapshot: null,
    });
  }

  function handleLocationChange(_id: string | null, item: LocationDto | null) {
    const address = item
      ? [item.streetAndNumber, item.postalCode, item.city, item.country]
          .filter(Boolean)
          .join(", ")
      : null;
    onChange({
      locationId: item?.id ?? null,
      locationNameSnapshot: item?.name ?? null,
      addressSnapshot: address,
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      {/* Nagłówek karty */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <div className="flex items-center gap-0.5">
              {/* Drag handle */}
              <div
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 touch-none"
                aria-label="Przeciągnij"
              >
                <GripVertical className="w-4 h-4" />
              </div>
              {/* Move Up / Move Down buttons */}
              <button
                type="button"
                onClick={onMoveUp}
                disabled={isFirst}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Przesuń w górę"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={isLast}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Przesuń w dół"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${badgeClass}`}
          >
            {seqLabel}
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {kindLabel}
          </span>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            aria-label={`Usuń ${kindLabel}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Data i godzina */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <Input
            type="date"
            value={stop.dateLocal ?? ""}
            onChange={(e) => onChange({ dateLocal: e.target.value || null })}
            disabled={isReadOnly}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Godzina</Label>
          <Input
            type="time"
            value={stop.timeLocal ? stop.timeLocal.substring(0, 5) : ""}
            onChange={(e) => onChange({ timeLocal: e.target.value ? `${e.target.value}:00` : null })}
            disabled={isReadOnly}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Firma */}
      <AutocompleteField
        label="Firma"
        placeholder="Wybierz firmę…"
        items={companies}
        value={selectedCompany?.id ?? null}
        displayField="name"
        searchFields={["name"]}
        onChange={handleCompanyChange}
        disabled={isReadOnly}
      />

      {/* Lokalizacja */}
      <AutocompleteField
        label="Oddział / lokalizacja"
        placeholder="Wybierz lokalizację…"
        items={filteredLocations}
        value={stop.locationId}
        displayField="name"
        searchFields={["name", "city"]}
        onChange={handleLocationChange}
        disabled={isReadOnly}
      />

      {/* Adres (readonly) */}
      {stop.addressSnapshot && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Adres</Label>
          <p className="text-xs text-slate-600 dark:text-slate-400 pl-1">
            {stop.addressSnapshot}
          </p>
        </div>
      )}

      {/* Uwagi */}
      <div className="space-y-1">
        <Label className="text-xs">Uwagi</Label>
        <Textarea
          value={stop.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          disabled={isReadOnly}
          rows={2}
          maxLength={500}
          className="text-sm resize-none"
          placeholder="Dodatkowe uwagi…"
        />
      </div>
    </div>
  );
}

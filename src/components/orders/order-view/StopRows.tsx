// StopRows — wiersze punktow trasy w dokumencie A4 z DnD

import React, { useCallback } from "react";
import { GripVertical, PlusCircle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CompanyDto, LocationDto } from "@/types";
import type { OrderViewStop } from "./types";
import {
  CELL,
  ROW_526,
  MAX_LOADING_STOPS,
  MAX_UNLOADING_STOPS,
  renumberStops,
  createEmptyStop,
} from "./constants";
import { EditableText } from "./inline-editors";
import { DatePickerPopover, TimePickerPopover } from "./date-time-pickers";
import { CompanyAutocomplete, LocationAutocomplete } from "./autocompletes";

// ---------------------------------------------------------------------------
// SortableStopWrapper — DnD wrapper dla kazdego stopu
// ---------------------------------------------------------------------------

function SortableStopWrapper({
  sortableId,
  isReadOnly,
  children,
}: {
  sortableId: string;
  isReadOnly: boolean;
  children: React.ReactNode;
}) {
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

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {!isReadOnly && (
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none flex items-center justify-center"
          style={{ left: -14, top: 8, width: 12, height: 12 }}
          aria-label="Przeciągnij"
        >
          <GripVertical style={{ width: 8, height: 8 }} />
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SingleStopRows — renderuje 2 wiersze A4 per stop (DATA + MIEJSCE)
// ---------------------------------------------------------------------------

function SingleStopRows({
  stop,
  disabled,
  allStops,
  onUpdate,
  onRemove,
  companies,
  locations,
}: {
  stop: OrderViewStop;
  disabled: boolean;
  allStops: OrderViewStop[];
  onUpdate: (patch: Partial<OrderViewStop>) => void;
  onRemove: () => void;
  companies: CompanyDto[];
  locations: LocationDto[];
}) {
  const isLoading = stop.kind === "LOADING";
  const stopsOfKind = allStops.filter((s) => s.kind === stop.kind);
  const kindIndex = stopsOfKind.indexOf(stop);
  const kindCount = stopsOfKind.length;

  // Etykiety: numer tylko gdy >1 stop danego typu
  const kindLabel = isLoading ? "ZAŁADUNKU" : "ROZŁADUNKU";
  const numberSuffix = kindCount > 1 ? ` ${kindIndex + 1}` : "";
  const dateLabel = `DATA ${kindLabel}${numberSuffix}:`;
  const placeLabel = `MIEJSCE ${kindLabel}${numberSuffix}:`;

  // Kolory
  const labelBg = isLoading ? "bg-[#E7E7E7]" : "bg-[#F59444]";
  const valueBg = isLoading ? "" : "bg-[#FAD1A5]";

  // Wyswietlany tekst miejsca
  const placeDisplay =
    stop.companyName && stop.locationName
      ? `${stop.companyName} \u2014 ${stop.locationName}`
      : stop.companyName
        ? stop.companyName
        : stop.place;

  return (
    <div className="relative group/stop">
      {/* Wiersz DATA */}
      <div className={`${ROW_526} h-[17px]`}>
        <div
          className={`${CELL} w-[98px] shrink-0 ${labelBg} border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-end`}
          style={{ padding: "5px 2px" }}
        >
          {dateLabel}
        </div>
        <div
          className={`${CELL} w-[375px] ${valueBg} border-t-[0.5px] border-l-[0.5px] border-solid border-black`}
          style={{ paddingLeft: "12px" }}
        >
          <DatePickerPopover
            value={stop.date}
            onChange={(v) => onUpdate({ date: v })}
            disabled={disabled}
          />
        </div>
        <div
          className={`${CELL} w-[53px] ${valueBg} border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
          style={{ borderLeftStyle: "dashed" }}
        >
          <span
            className="text-[5px] font-bold ov-gray shrink-0"
            style={{ letterSpacing: "0.15px" }}
          >
            GOD.
          </span>
          <div style={{ marginLeft: "2px" }}>
            <TimePickerPopover
              value={stop.time}
              onChange={(v) => onUpdate({ time: v })}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Wiersz MIEJSCE — firma + oddzial/adres */}
      <div className={`${ROW_526} min-h-[17px]`}>
        <div
          className={`${CELL} w-[98px] shrink-0 ${labelBg} border-b-[0.5px] border-dashed border-black border-r-[0.5px] text-[7px] font-bold items-start`}
          style={{ padding: "4px 2px", borderRightStyle: "solid" }}
        >
          {placeLabel}
        </div>
        <div
          className={`${CELL} w-[375px] ${valueBg} border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
          style={{ paddingLeft: "12px", borderLeftStyle: "solid" }}
        >
          {disabled ? (
            <span
              className="text-[7px] font-bold truncate"
              style={{ letterSpacing: "0.14px" }}
            >
              {stop.companyName && stop.address
                ? `${stop.companyName}, ${stop.address}`
                : placeDisplay}
            </span>
          ) : (
            <div className="flex items-start gap-1 w-full">
              <div className="w-[120px] shrink-0">
                <CompanyAutocomplete
                  value={stop.companyId}
                  displayName={stop.companyName}
                  onSelect={(company) =>
                    onUpdate({
                      companyId: company.id,
                      companyName: company.name,
                      locationId: null,
                      locationName: null,
                      address: null,
                    })
                  }
                  onClear={() =>
                    onUpdate({
                      companyId: null,
                      companyName: null,
                      locationId: null,
                      locationName: null,
                      address: null,
                    })
                  }
                  disabled={false}
                  companies={companies}
                />
              </div>
              <span className="text-[5px] ov-gray shrink-0 mt-[2px]">
                {"\u2192"}
              </span>
              <div className="flex-1 min-w-0">
                <LocationAutocomplete
                  value={stop.locationId}
                  displayName={stop.address ?? stop.locationName}
                  companyId={stop.companyId}
                  onSelect={(loc) =>
                    onUpdate({
                      locationId: loc.id,
                      locationName: loc.name,
                      address: `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`,
                      country: loc.country,
                      place: `${loc.companyName} ${loc.city} ${loc.postalCode}, ${loc.streetAndNumber}`,
                    })
                  }
                  onClear={() =>
                    onUpdate({
                      locationId: null,
                      locationName: null,
                      address: null,
                    })
                  }
                  disabled={false}
                  locations={locations}
                />
              </div>
            </div>
          )}
        </div>
        <div
          className={`${CELL} w-[53px] ${valueBg} border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
          style={{ borderLeftStyle: "dashed" }}
        >
          <span
            className="text-[5px] font-bold ov-gray shrink-0"
            style={{ letterSpacing: "0.15px" }}
          >
            KRAJ
          </span>
          <EditableText
            value={stop.country}
            onChange={(v) => onUpdate({ country: v })}
            className="text-[7px] font-bold"
            disabled={disabled}
            style={{ letterSpacing: "0.21px", marginLeft: "2px" }}
          />
        </div>
      </div>

      {/* Przycisk usuwania (hover) */}
      {!disabled && allStops.length > 2 && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-[2px] top-1/2 -translate-y-1/2 hidden group-hover/stop:flex items-center justify-center w-[12px] h-[12px] text-[8px] text-red-500 hover:text-red-700 bg-white rounded-full border border-red-300 cursor-pointer leading-none z-10"
          title="Usuń stop"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StopRowsSection — glowny eksport: DnD container + lista stopow + przyciski
// ---------------------------------------------------------------------------

export default function StopRowsSection({
  stops,
  onStopsChange,
  isReadOnly,
  companies,
  locations,
}: {
  stops: OrderViewStop[];
  onStopsChange: (stops: OrderViewStop[]) => void;
  isReadOnly: boolean;
  companies: CompanyDto[];
  locations: LocationDto[];
}) {
  // Handlery aktualizacji stopu
  const updateStop = useCallback(
    (index: number, patch: Partial<OrderViewStop>) => {
      const updated = stops.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      );
      onStopsChange(updated);
    },
    [stops, onStopsChange],
  );

  const removeStop = useCallback(
    (index: number) => {
      const filtered = stops.filter((_, i) => i !== index);
      onStopsChange(renumberStops(filtered));
    },
    [stops, onStopsChange],
  );

  const addStop = useCallback(
    (kind: "LOADING" | "UNLOADING") => {
      const arr = [...stops];
      const newStop = createEmptyStop(kind);

      if (kind === "LOADING") {
        let lastLoadingIdx = -1;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].kind === "LOADING") {
            lastLoadingIdx = i;
            break;
          }
        }
        if (lastLoadingIdx === -1) {
          arr.unshift(newStop);
        } else {
          arr.splice(lastLoadingIdx + 1, 0, newStop);
        }
      } else {
        let lastUnloadingIdx = -1;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].kind === "UNLOADING") {
            lastUnloadingIdx = i;
            break;
          }
        }
        if (lastUnloadingIdx === -1) {
          arr.push(newStop);
        } else {
          arr.splice(lastUnloadingIdx, 0, newStop);
        }
      }

      onStopsChange(renumberStops(arr));
    },
    [stops, onStopsChange],
  );

  // DnD setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sortableIds = stops.map((s) => s.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = sortableIds.indexOf(active.id as string);
      const newIdx = sortableIds.indexOf(over.id as string);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...stops], oldIdx, newIdx);

      // Enforce: pierwsza pozycja musi byc LOADING
      if (reordered.length > 0 && reordered[0].kind !== "LOADING") return;
      // Enforce: ostatnia pozycja musi byc UNLOADING
      if (
        reordered.length > 0 &&
        reordered[reordered.length - 1].kind !== "UNLOADING"
      )
        return;

      onStopsChange(renumberStops(reordered));
    },
    [stops, onStopsChange, sortableIds],
  );

  // Liczniki stopow dla limitow przyciskow
  const loadingCount = stops.filter((s) => s.kind === "LOADING").length;
  const unloadingCount = stops.filter(
    (s) => s.kind === "UNLOADING",
  ).length;

  return (
    <>
      {isReadOnly ? (
        // ReadOnly: bez DnD
        stops.map((stop, idx) => (
          <SingleStopRows
            key={stop.id}
            stop={stop}
            disabled={isReadOnly}
            allStops={stops}
            onUpdate={(patch) => updateStop(idx, patch)}
            onRemove={() => removeStop(idx)}
            companies={companies}
            locations={locations}
          />
        ))
      ) : (
        // Edit mode: DnD
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {stops.map((stop, idx) => (
              <SortableStopWrapper
                key={stop.id}
                sortableId={stop.id}
                isReadOnly={isReadOnly}
              >
                <SingleStopRows
                  stop={stop}
                  disabled={isReadOnly}
                  allStops={stops}
                  onUpdate={(patch) => updateStop(idx, patch)}
                  onRemove={() => removeStop(idx)}
                  companies={companies}
                  locations={locations}
                />
              </SortableStopWrapper>
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Przyciski dodawania stopow */}
      {!isReadOnly && (
        <div
          className={`${ROW_526} h-[18px] justify-center gap-4`}
          data-no-print
        >
          <button
            type="button"
            onClick={() => addStop("LOADING")}
            disabled={loadingCount >= MAX_LOADING_STOPS}
            className="flex items-center gap-0.5 text-[6px] text-emerald-600 hover:text-emerald-800 cursor-pointer bg-transparent border-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusCircle style={{ width: 8, height: 8 }} />
            Załadunek
          </button>
          <button
            type="button"
            onClick={() => addStop("UNLOADING")}
            disabled={unloadingCount >= MAX_UNLOADING_STOPS}
            className="flex items-center gap-0.5 text-[6px] text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusCircle style={{ width: 8, height: 8 }} />
            Rozładunek
          </button>
        </div>
      )}
    </>
  );
}

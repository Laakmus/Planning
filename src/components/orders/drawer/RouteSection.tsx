/**
 * Sekcja 1 – Trasa.
 * Rodzaj transportu + lista punktów załadunku/rozładunku.
 * Obsługuje drag-and-drop (DndContext + SortableContext) do reorderingu punktów trasy.
 * Drag handle jest NA ZEWNĄTRZ karty — w wrapperze flex.
 */

import { useCallback, useMemo, useState } from "react";
import { GripVertical, PlusCircle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyDto, LocationDto, TransportTypeDto } from "@/types";
import type { OrderFormData, OrderFormStop, TransportTypeCode } from "@/lib/view-models";

import { RoutePointCard } from "./RoutePointCard";

interface RouteSectionProps {
  formData: OrderFormData;
  transportTypes: TransportTypeDto[];
  companies: CompanyDto[];
  locations: LocationDto[];
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormData>) => void;
}

const MAX_LOADING = 8;
const MAX_UNLOADING = 3;

/** Wrapper sortable z drag handle NA ZEWNĄTRZ karty */
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
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start">
      {!isReadOnly && (
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 touch-none mt-1"
          aria-label="Przeciągnij"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {children}
    </div>
  );
}

export function RouteSection({
  formData,
  transportTypes,
  companies,
  locations,
  isReadOnly,
  onChange,
}: RouteSectionProps) {
  // M-07: Memoizacja zmiennych używanych w handleDragEnd
  const activeStops = useMemo(
    () => formData.stops.filter((s) => !s._deleted),
    [formData.stops]
  );
  const loadingStops = activeStops.filter((s) => s.kind === "LOADING");
  const unloadingStops = activeStops.filter((s) => s.kind === "UNLOADING");

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  // Build a mapping: activeIndex -> original index in formData.stops
  const activeIndexToOriginal = useMemo(() => {
    const mapping: number[] = [];
    formData.stops.forEach((stop, origIdx) => {
      if (!stop._deleted) mapping.push(origIdx);
    });
    return mapping;
  }, [formData.stops]);

  // Sortable IDs for active stops
  const sortableIds = useMemo(
    () => activeStops.map((_, activeIdx) => `stop-${activeIndexToOriginal[activeIdx]}`),
    [activeStops, activeIndexToOriginal]
  );

  /**
   * After reordering active stops, renumber sequenceNo for all active stops
   * and produce the updated full stops array (preserving deleted stops).
   * Order is preserved as-is (no automatic re-sorting by kind).
   * Constraint: first stop must be LOADING, last stop must be UNLOADING.
   */
  function renumberAndBuild(newActiveStops: OrderFormStop[]): OrderFormStop[] {
    const renumbered = newActiveStops.map((s, i) => ({
      ...s,
      sequenceNo: i + 1,
    }));

    const deletedStops = formData.stops.filter((s) => s._deleted);
    return [...renumbered, ...deletedStops];
  }

  // Drag end handler with position constraints:
  // - position 0 (first): only LOADING stops allowed
  // - last position: only UNLOADING stops allowed
  // - middle positions: any kind allowed
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldActiveIdx = sortableIds.indexOf(active.id as string);
      const newActiveIdx = sortableIds.indexOf(over.id as string);

      if (oldActiveIdx === -1 || newActiveIdx === -1) return;

      const reordered = arrayMove([...activeStops], oldActiveIdx, newActiveIdx);

      // Enforce: first position must be LOADING
      if (reordered.length > 0 && reordered[0].kind !== "LOADING") return;
      // Enforce: last position must be UNLOADING
      if (reordered.length > 0 && reordered[reordered.length - 1].kind !== "UNLOADING") return;

      onChange({ stops: renumberAndBuild(reordered) });
    },
    [sortableIds, activeStops, formData.stops, onChange]
  );

  function patchStop(idx: number, patch: Partial<OrderFormStop>) {
    const updated = formData.stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ stops: updated });
  }

  // Stan dialogu potwierdzenia usunięcia stopu
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState<number | null>(null);

  /** Sprawdza czy stop ma wypełnione dane (locationId, dateLocal lub notes) */
  function stopHasData(stop: OrderFormStop): boolean {
    return stop.locationId !== null || stop.dateLocal !== null || stop.notes !== null;
  }

  function doRemoveStop(idx: number) {
    const stop = formData.stops[idx];
    let updated: OrderFormStop[];
    if (stop.id === null) {
      updated = formData.stops.filter((_, i) => i !== idx);
    } else {
      updated = formData.stops.map((s, i) => (i === idx ? { ...s, _deleted: true } : s));
    }
    onChange({ stops: updated });
  }

  function removeStop(idx: number) {
    const stop = formData.stops[idx];
    // Jeśli stop ma dane — pokaż dialog potwierdzenia
    if (stopHasData(stop)) {
      setPendingRemoveIdx(idx);
    } else {
      doRemoveStop(idx);
    }
  }

  function addStop(kind: "LOADING" | "UNLOADING") {
    const newStop: OrderFormStop = {
      id: null,
      kind,
      sequenceNo: 0,
      dateLocal: null,
      timeLocal: null,
      locationId: null,
      locationNameSnapshot: null,
      companyNameSnapshot: null,
      addressSnapshot: null,
      notes: null,
      _deleted: false,
    };

    const currentActive = [...formData.stops.filter((s) => !s._deleted)];
    const deletedStops = formData.stops.filter((s) => s._deleted);

    if (kind === "LOADING") {
      // Insert after the last LOADING stop (before any subsequent stops)
      let lastLoadingIdx = -1;
      for (let i = currentActive.length - 1; i >= 0; i--) {
        if (currentActive[i].kind === "LOADING") {
          lastLoadingIdx = i;
          break;
        }
      }
      if (lastLoadingIdx === -1) {
        currentActive.unshift(newStop);
      } else {
        currentActive.splice(lastLoadingIdx + 1, 0, newStop);
      }
    } else {
      // Insert before the last UNLOADING stop (so last remains UNLOADING)
      let lastUnloadingIdx = -1;
      for (let i = currentActive.length - 1; i >= 0; i--) {
        if (currentActive[i].kind === "UNLOADING") {
          lastUnloadingIdx = i;
          break;
        }
      }
      if (lastUnloadingIdx === -1) {
        currentActive.push(newStop);
      } else {
        currentActive.splice(lastUnloadingIdx, 0, newStop);
      }
    }

    const renumbered = currentActive.map((s, i) => ({ ...s, sequenceNo: i + 1 }));
    onChange({ stops: [...renumbered, ...deletedStops] });
  }

  function getKindIndex(stop: OrderFormStop): { loadingIndex?: number; unloadingIndex?: number } {
    const activeOfKind = activeStops.filter((s) => s.kind === stop.kind);
    const kindIdx = activeOfKind.indexOf(stop);
    if (stop.kind === "LOADING") return { loadingIndex: kindIdx };
    return { unloadingIndex: kindIdx };
  }

  function renderStopCard(stop: OrderFormStop, activeIdx: number) {
    const origIdx = activeIndexToOriginal[activeIdx];
    const kindIdx = getKindIndex(stop);
    return (
      <RoutePointCard
        stop={stop}
        index={origIdx}
        {...kindIdx}
        companies={companies}
        locations={locations}
        isReadOnly={isReadOnly}
        onChange={(patch) => patchStop(origIdx, patch)}
        onRemove={() => removeStop(origIdx)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Rodzaj transportu */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">
          Rodzaj transportu<span className="text-red-500 ml-0.5">*</span>
        </Label>
        <Select
          value={formData.transportTypeCode}
          onValueChange={(v) => onChange({ transportTypeCode: v as TransportTypeCode })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Wybierz rodzaj…" />
          </SelectTrigger>
          <SelectContent>
            {transportTypes.map((tt) => (
              <SelectItem key={tt.code} value={tt.code} className="text-sm">
                {tt.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista punktów trasy */}
      {isReadOnly ? (
        <div className="space-y-3">
          {activeStops.map((stop, activeIdx) => (
            <div key={`stop-${activeIndexToOriginal[activeIdx]}`} className="flex gap-2 items-start">
              {renderStopCard(stop, activeIdx)}
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {activeStops.map((stop, activeIdx) => (
                <SortableStopWrapper
                  key={sortableIds[activeIdx]}
                  sortableId={sortableIds[activeIdx]}
                  isReadOnly={isReadOnly}
                >
                  {renderStopCard(stop, activeIdx)}
                </SortableStopWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Przyciski dodaj — pełnowymiarowe, kolorowe */}
      {!isReadOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addStop("LOADING")}
            disabled={loadingStops.length >= MAX_LOADING}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusCircle className="w-4 h-4" />
            Dodaj punkt załadunku (max {MAX_LOADING})
          </button>
          <button
            type="button"
            onClick={() => addStop("UNLOADING")}
            disabled={unloadingStops.length >= MAX_UNLOADING}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 hover:border-blue-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusCircle className="w-4 h-4" />
            Dodaj punkt rozładunku (max {MAX_UNLOADING})
          </button>
        </div>
      )}

      {/* Dialog potwierdzenia usunięcia stopu z danymi */}
      <AlertDialog open={pendingRemoveIdx !== null} onOpenChange={(open) => { if (!open) setPendingRemoveIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć punkt trasy?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten punkt trasy? Dane zostaną utracone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveIdx !== null) {
                  doRemoveStop(pendingRemoveIdx);
                  setPendingRemoveIdx(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

/**
 * Sekcja 1 – Trasa.
 * Rodzaj transportu + lista punktów załadunku/rozładunku + kontakt nadawcy.
 * Obsługuje drag-and-drop (DndContext + SortableContext) do reorderingu punktów trasy.
 */

import { useCallback } from "react";
import { Plus } from "lucide-react";
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
} from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function RouteSection({
  formData,
  transportTypes,
  companies,
  locations,
  isReadOnly,
  onChange,
}: RouteSectionProps) {
  const activeStops = formData.stops.filter((s) => !s._deleted);
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
  // This is needed because formData.stops contains deleted stops as well.
  const activeIndexToOriginal: number[] = [];
  formData.stops.forEach((stop, origIdx) => {
    if (!stop._deleted) {
      activeIndexToOriginal.push(origIdx);
    }
  });

  // Sortable IDs for active stops (stable identifiers)
  const sortableIds = activeStops.map((_, activeIdx) => `stop-${activeIndexToOriginal[activeIdx]}`);

  /**
   * After reordering active stops, renumber sequenceNo for all active stops
   * and produce the updated full stops array (preserving deleted stops).
   */
  function renumberAndBuild(newActiveStops: OrderFormStop[]): OrderFormStop[] {
    // Assign sequential sequenceNo to the reordered active stops
    const renumbered = newActiveStops.map((s, i) => ({
      ...s,
      sequenceNo: i + 1,
    }));

    // Rebuild full array: keep deleted stops at the end (they don't affect ordering)
    const deletedStops = formData.stops.filter((s) => s._deleted);
    return [...renumbered, ...deletedStops];
  }

  // Drag end handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldActiveIdx = sortableIds.indexOf(active.id as string);
      const newActiveIdx = sortableIds.indexOf(over.id as string);

      if (oldActiveIdx === -1 || newActiveIdx === -1) return;

      const reordered = arrayMove([...activeStops], oldActiveIdx, newActiveIdx);
      onChange({ stops: renumberAndBuild(reordered) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData.stops, onChange]
  );

  // Move Up / Move Down handlers (button-based reorder)
  function moveStop(activeIdx: number, direction: -1 | 1) {
    const targetIdx = activeIdx + direction;
    if (targetIdx < 0 || targetIdx >= activeStops.length) return;

    const reordered = arrayMove([...activeStops], activeIdx, targetIdx);
    onChange({ stops: renumberAndBuild(reordered) });
  }

  function patchStop(idx: number, patch: Partial<OrderFormStop>) {
    const updated = formData.stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ stops: updated });
  }

  function removeStop(idx: number) {
    const stop = formData.stops[idx];
    let updated: OrderFormStop[];
    if (stop.id === null) {
      // nowy punkt — usuń całkowicie
      updated = formData.stops.filter((_, i) => i !== idx);
    } else {
      // istniejący punkt — oznacz jako usunięty
      updated = formData.stops.map((s, i) => (i === idx ? { ...s, _deleted: true } : s));
    }
    onChange({ stops: updated });
  }

  function addStop(kind: "LOADING" | "UNLOADING") {
    const maxSeq = formData.stops.reduce((m, s) => Math.max(m, s.sequenceNo), 0);
    const newStop: OrderFormStop = {
      id: null,
      kind,
      sequenceNo: maxSeq + 1,
      dateLocal: null,
      timeLocal: null,
      locationId: null,
      locationNameSnapshot: null,
      companyNameSnapshot: null,
      addressSnapshot: null,
      notes: null,
      _deleted: false,
    };
    onChange({ stops: [...formData.stops, newStop] });
  }

  // Mapowanie rzeczywistego indeksu w tablicy stops do indeksu L/U
  function getKindIndex(stop: OrderFormStop): { loadingIndex?: number; unloadingIndex?: number } {
    const activeOfKind = activeStops.filter((s) => s.kind === stop.kind);
    const kindIdx = activeOfKind.indexOf(stop);
    if (stop.kind === "LOADING") return { loadingIndex: kindIdx };
    return { unloadingIndex: kindIdx };
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
                {tt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista punktów trasy z drag-and-drop (DndContext tylko w trybie edycji) */}
      {isReadOnly ? (
        <div className="space-y-3">
          {activeStops.map((stop, activeIdx) => {
            const origIdx = activeIndexToOriginal[activeIdx];
            const kindIdx = getKindIndex(stop);
            return (
              <RoutePointCard
                key={`stop-${origIdx}`}
                stop={stop}
                index={origIdx}
                sortableId={`stop-${origIdx}`}
                {...kindIdx}
                companies={companies}
                locations={locations}
                isReadOnly={isReadOnly}
                onChange={(patch) => patchStop(origIdx, patch)}
                onRemove={() => removeStop(origIdx)}
                isFirst={activeIdx === 0}
                isLast={activeIdx === activeStops.length - 1}
              />
            );
          })}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {activeStops.map((stop, activeIdx) => {
                const origIdx = activeIndexToOriginal[activeIdx];
                const kindIdx = getKindIndex(stop);
                return (
                  <RoutePointCard
                    key={sortableIds[activeIdx]}
                    stop={stop}
                    index={origIdx}
                    sortableId={sortableIds[activeIdx]}
                    {...kindIdx}
                    companies={companies}
                    locations={locations}
                    isReadOnly={isReadOnly}
                    onChange={(patch) => patchStop(origIdx, patch)}
                    onRemove={() => removeStop(origIdx)}
                    onMoveUp={() => moveStop(activeIdx, -1)}
                    onMoveDown={() => moveStop(activeIdx, 1)}
                    isFirst={activeIdx === 0}
                    isLast={activeIdx === activeStops.length - 1}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Przyciski dodaj */}
      {!isReadOnly && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addStop("LOADING")}
            disabled={loadingStops.length >= MAX_LOADING}
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          >
            <Plus className="w-3 h-3 mr-1" />
            + Załadunek
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addStop("UNLOADING")}
            disabled={unloadingStops.length >= MAX_UNLOADING}
            className="text-primary border-primary/30 hover:bg-primary/5"
          >
            <Plus className="w-3 h-3 mr-1" />
            + Rozładunek
          </Button>
        </div>
      )}

      {/* Kontakt nadawcy */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Osoba kontaktowa
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Imię i nazwisko</Label>
            <Input
              value={formData.senderContactName ?? ""}
              onChange={(e) => onChange({ senderContactName: e.target.value || null })}
              disabled={isReadOnly}
              className="h-8 text-sm"
              placeholder="Jan Kowalski"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefon</Label>
            <Input
              value={formData.senderContactPhone ?? ""}
              onChange={(e) => onChange({ senderContactPhone: e.target.value || null })}
              disabled={isReadOnly}
              className="h-8 text-sm"
              placeholder="+48 000 000 000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={formData.senderContactEmail ?? ""}
              onChange={(e) => onChange({ senderContactEmail: e.target.value || null })}
              disabled={isReadOnly}
              className="h-8 text-sm"
              placeholder="kontakt@firma.pl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

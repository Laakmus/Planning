import { useCallback, useMemo } from "react";
import { Plus, MapPin } from "lucide-react";
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import type { OrderFormStop } from "@/lib/view-models";
import { RoutePointCard } from "./RoutePointCard";

interface RoutePointListProps {
  stops: OrderFormStop[];
  onChange: (stops: OrderFormStop[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

const MAX_LOADING_STOPS = 8;
const MAX_UNLOADING_STOPS = 3;

/**
 * Generate a stable sortable ID for each stop.
 * Existing stops use their DB id, new stops use a generated key.
 */
function getSortableId(stop: OrderFormStop, index: number): string {
  return stop.id ?? `new-${stop.kind}-${index}`;
}

/**
 * List of route points (loading + unloading) with:
 * - Drag-and-drop reorder via @dnd-kit
 * - Move up/down buttons as keyboard-accessible fallback
 * - Add loading/unloading buttons (with limits)
 * - Remove (soft-delete for existing, hard-delete for new)
 */
export function RoutePointList({
  stops,
  onChange,
  disabled = false,
  errors,
}: RoutePointListProps) {
  // Only show non-deleted stops
  const visibleStops = useMemo(
    () => stops.filter((s) => !s._deleted),
    [stops],
  );

  const loadingCount = visibleStops.filter((s) => s.kind === "LOADING").length;
  const unloadingCount = visibleStops.filter((s) => s.kind === "UNLOADING").length;

  const canAddLoading = loadingCount < MAX_LOADING_STOPS;
  const canAddUnloading = unloadingCount < MAX_UNLOADING_STOPS;

  // Sortable IDs for visible stops
  const sortableIds = useMemo(
    () => visibleStops.map((s, i) => getSortableId(s, i)),
    [visibleStops],
  );

  // DnD sensors — pointer (mouse/touch) + keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Get the actual index in the full array (including deleted) for a visible stop
  const getActualIndex = useCallback(
    (visibleIndex: number): number => {
      let count = 0;
      for (let i = 0; i < stops.length; i++) {
        if (!stops[i]._deleted) {
          if (count === visibleIndex) return i;
          count++;
        }
      }
      return -1;
    },
    [stops],
  );

  // Handle drag end — reorder stops by swapping sequence numbers
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldVisibleIndex = sortableIds.indexOf(String(active.id));
      const newVisibleIndex = sortableIds.indexOf(String(over.id));
      if (oldVisibleIndex === -1 || newVisibleIndex === -1) return;

      // Reorder visible stops
      const reordered = [...visibleStops];
      const [moved] = reordered.splice(oldVisibleIndex, 1);
      reordered.splice(newVisibleIndex, 0, moved);

      // Reassign sequence numbers
      const updatedVisible = reordered.map((s, i) => ({
        ...s,
        sequenceNo: i + 1,
      }));

      // Rebuild full array: deleted items stay as-is, visible items get new order
      const deleted = stops.filter((s) => s._deleted);
      onChange([...updatedVisible, ...deleted]);
    },
    [stops, visibleStops, sortableIds, onChange],
  );

  const handleStopChange = useCallback(
    (visibleIndex: number, updatedStop: OrderFormStop) => {
      const actualIndex = getActualIndex(visibleIndex);
      if (actualIndex === -1) return;
      const newStops = [...stops];
      newStops[actualIndex] = updatedStop;
      onChange(newStops);
    },
    [stops, onChange, getActualIndex],
  );

  const handleRemoveStop = useCallback(
    (visibleIndex: number) => {
      const actualIndex = getActualIndex(visibleIndex);
      if (actualIndex === -1) return;
      const newStops = [...stops];
      if (newStops[actualIndex].id) {
        // Existing stop — soft delete
        newStops[actualIndex] = { ...newStops[actualIndex], _deleted: true };
      } else {
        // New stop — hard delete
        newStops.splice(actualIndex, 1);
      }
      // Re-number sequence for visible stops
      let seq = 1;
      for (const stop of newStops) {
        if (!stop._deleted) {
          stop.sequenceNo = seq++;
        }
      }
      onChange(newStops);
    },
    [stops, onChange, getActualIndex],
  );

  const handleMoveUp = useCallback(
    (visibleIndex: number) => {
      if (visibleIndex === 0) return;
      const actualA = getActualIndex(visibleIndex);
      const actualB = getActualIndex(visibleIndex - 1);
      if (actualA === -1 || actualB === -1) return;
      const newStops = [...stops];
      const seqA = newStops[actualA].sequenceNo;
      newStops[actualA] = { ...newStops[actualA], sequenceNo: newStops[actualB].sequenceNo };
      newStops[actualB] = { ...newStops[actualB], sequenceNo: seqA };
      newStops.sort((a, b) => {
        if (a._deleted && !b._deleted) return 1;
        if (!a._deleted && b._deleted) return -1;
        return a.sequenceNo - b.sequenceNo;
      });
      onChange(newStops);
    },
    [stops, onChange, getActualIndex],
  );

  const handleMoveDown = useCallback(
    (visibleIndex: number) => {
      if (visibleIndex >= visibleStops.length - 1) return;
      const actualA = getActualIndex(visibleIndex);
      const actualB = getActualIndex(visibleIndex + 1);
      if (actualA === -1 || actualB === -1) return;
      const newStops = [...stops];
      const seqA = newStops[actualA].sequenceNo;
      newStops[actualA] = { ...newStops[actualA], sequenceNo: newStops[actualB].sequenceNo };
      newStops[actualB] = { ...newStops[actualB], sequenceNo: seqA };
      newStops.sort((a, b) => {
        if (a._deleted && !b._deleted) return 1;
        if (!a._deleted && b._deleted) return -1;
        return a.sequenceNo - b.sequenceNo;
      });
      onChange(newStops);
    },
    [stops, visibleStops.length, onChange, getActualIndex],
  );

  const handleAddStop = useCallback(
    (kind: "LOADING" | "UNLOADING") => {
      const maxSeq =
        visibleStops.length > 0
          ? Math.max(...visibleStops.map((s) => s.sequenceNo))
          : 0;

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
      onChange([...stops, newStop]);
    },
    [stops, visibleStops, onChange],
  );

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {visibleStops.map((stop, index) => (
            <RoutePointCard
              key={sortableIds[index]}
              sortableId={sortableIds[index]}
              stop={stop}
              index={index}
              totalCount={visibleStops.length}
              onChange={(updated) => handleStopChange(index, updated)}
              onRemove={() => handleRemoveStop(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              disabled={disabled}
              errors={errors}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add buttons */}
      {!disabled && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddStop("LOADING")}
            disabled={!canAddLoading}
            className="flex-1"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <MapPin className="mr-1 h-3 w-3 text-blue-500" />
            Załadunek ({loadingCount}/{MAX_LOADING_STOPS})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddStop("UNLOADING")}
            disabled={!canAddUnloading}
            className="flex-1"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <MapPin className="mr-1 h-3 w-3 text-orange-500" />
            Rozładunek ({unloadingCount}/{MAX_UNLOADING_STOPS})
          </Button>
        </div>
      )}
    </div>
  );
}

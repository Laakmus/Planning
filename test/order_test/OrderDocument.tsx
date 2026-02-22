import React, { useCallback, useRef, useState } from "react";
import { Check, ChevronsUpDown, GripVertical, PlusCircle, X } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  CurrencyCode,
  OrderViewData,
  OrderViewItem,
  OrderViewStop,
  PackagingType,
  StopKind,
  TestProduct,
  TestCompany,
  TestLocation,
} from "./types";
import {
  COMPANY_NAME,
  CONDITIONS_HEADER,
  DOCUMENTS_OPTIONS,
  LOGO_BASE64,
  MAX_VISIBLE_ITEMS,
  MAX_LOADING_STOPS,
  MAX_UNLOADING_STOPS,
  PAYMENT_METHODS,
} from "./constants";
import { TEST_PRODUCTS, TEST_COMPANIES, TEST_LOCATIONS } from "./test-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrderDocumentProps {
  data: OrderViewData;
  onChange: (data: OrderViewData) => void;
  isReadOnly: boolean;
}

// ---------------------------------------------------------------------------
// Inline editable helpers
// ---------------------------------------------------------------------------

function EditableText({
  value,
  onChange,
  className,
  disabled,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  if (disabled) return <span className={className}>{value}</span>;
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-none outline-none w-full ${className ?? ""}`}
      {...props}
    />
  );
}

function EditableNumber({
  value,
  onChange,
  className,
  disabled,
  suffix,
  ...props
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  disabled?: boolean;
  suffix?: string;
  [key: string]: any;
}) {
  if (disabled) {
    return (
      <span className={className}>
        {value != null ? value : ""}
        {suffix && value != null ? ` ${suffix}` : ""}
      </span>
    );
  }
  return (
    <input
      type="text"
      value={value != null ? String(value) : ""}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, "");
        if (raw === "") {
          onChange(null);
        } else {
          const parsed = parseFloat(raw.replace(",", "."));
          onChange(isNaN(parsed) ? null : parsed);
        }
      }}
      className={`bg-transparent border-none outline-none w-full ${className ?? ""}`}
      {...props}
    />
  );
}

function EditableTextarea({
  value,
  onChange,
  className,
  disabled,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  if (disabled) {
    return (
      <span className={className} style={{ whiteSpace: "pre-wrap" }}>
        {value}
      </span>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-none outline-none w-full resize-none ${className ?? ""}`}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Product autocomplete for A4 document (tiny inline style)
// ---------------------------------------------------------------------------

function ProductAutocomplete({
  value,
  onSelect,
  disabled,
}: {
  value: string;
  onSelect: (product: TestProduct) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (disabled) {
    return <span className="text-[7px] font-bold">{value}</span>;
  }

  const filtered =
    query.length < 1
      ? TEST_PRODUCTS
      : TEST_PRODUCTS.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="truncate flex-1">
            {value || "wybierz produkt..."}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 8, height: 8 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj produktu..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              Brak wyników
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === product.name ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span>{product.name}</span>
                  {product.defaultPackaging && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      {product.defaultPackaging}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Company autocomplete for A4 stop rows (tiny inline style)
// ---------------------------------------------------------------------------

function CompanyAutocomplete({
  value,
  displayName,
  onSelect,
  onClear,
  disabled,
}: {
  value: string | null;
  displayName: string | null;
  onSelect: (company: TestCompany) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (disabled) {
    return (
      <span className="text-[7px] font-bold truncate">
        {displayName || ""}
      </span>
    );
  }

  const filtered =
    query.length < 1
      ? TEST_COMPANIES.filter((c) => c.isActive)
      : TEST_COMPANIES.filter(
          (c) =>
            c.isActive &&
            c.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="flex-1 line-clamp-2" style={{ lineHeight: "9px" }}>
            {displayName || "wybierz firmę..."}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 6, height: 6 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj firmy..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              Brak wyników
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer text-red-500"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Wyczyść wybór
                </CommandItem>
              )}
              {filtered.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.name}
                  onSelect={() => {
                    onSelect(company);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === company.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span>{company.name}</span>
                  {company.taxId && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      {company.taxId}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Location autocomplete for A4 stop rows (filtered by companyId)
// ---------------------------------------------------------------------------

function LocationAutocomplete({
  value,
  displayName,
  companyId,
  onSelect,
  onClear,
  disabled,
}: {
  value: string | null;
  displayName: string | null;
  companyId: string | null;
  onSelect: (location: TestLocation) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (disabled) {
    return (
      <span className="text-[7px] font-bold truncate">
        {displayName || ""}
      </span>
    );
  }

  const availableLocations = TEST_LOCATIONS.filter(
    (loc) =>
      loc.isActive &&
      (companyId ? loc.companyId === companyId : true),
  );

  const filtered =
    query.length < 1
      ? availableLocations
      : availableLocations.filter((loc) =>
          loc.name.toLowerCase().includes(query.toLowerCase()) ||
          loc.city.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="truncate flex-1">
            {displayName || (companyId ? "wybierz lokalizację..." : "najpierw wybierz firmę")}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 6, height: 6 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj lokalizacji..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              {companyId
                ? "Brak lokalizacji dla tej firmy"
                : "Najpierw wybierz firmę"}
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer text-red-500"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Wyczyść wybór
                </CommandItem>
              )}
              {filtered.map((loc) => (
                <CommandItem
                  key={loc.id}
                  value={`${loc.name} ${loc.city}`}
                  onSelect={() => {
                    onSelect(loc);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === loc.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span>{loc.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {loc.streetAndNumber}, {loc.postalCode} {loc.city}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// SortableStopWrapper — DnD wrapper for each stop
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
// StopRows — renders 2 A4 rows per stop (DATE + PLACE)
// ---------------------------------------------------------------------------

function StopRows({
  stop,
  stopIndex,
  disabled,
  allStops,
  onUpdate,
  onRemove,
}: {
  stop: OrderViewStop;
  stopIndex: number;
  disabled: boolean;
  allStops: OrderViewStop[];
  onUpdate: (patch: Partial<OrderViewStop>) => void;
  onRemove: () => void;
}) {
  const isLoading = stop.kind === "LOADING";
  const stopsOfKind = allStops.filter((s) => s.kind === stop.kind);
  const kindIndex = stopsOfKind.indexOf(stop);
  const kindCount = stopsOfKind.length;

  // Labels: show number only when >1 stop of this kind
  const kindLabel = isLoading ? "ZAŁADUNKU" : "ROZŁADUNKU";
  const numberSuffix = kindCount > 1 ? ` ${kindIndex + 1}` : "";
  const dateLabel = `DATA ${kindLabel}${numberSuffix}:`;
  const placeLabel = `MIEJSCE ${kindLabel}${numberSuffix}:`;

  // Colors
  const labelBg = isLoading ? "bg-[#E7E7E7]" : "bg-[#F59444]";
  const valueBg = isLoading ? "" : "bg-[#FAD1A5]";

  const CELL = "flex items-center px-1 overflow-hidden";
  const ROW_526 = "flex w-[526px]";

  // Display text for place: prefer company+location, fallback to place
  const placeDisplay =
    stop.companyName && stop.locationName
      ? `${stop.companyName} — ${stop.locationName}`
      : stop.companyName
        ? stop.companyName
        : stop.place;

  // Compute address display
  const addressDisplay = stop.address || "";

  return (
    <div className="relative group/stop">
      {/* DATE row */}
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
          <EditableText
            value={stop.date ?? ""}
            onChange={(v) => onUpdate({ date: v || null })}
            className="text-[7px] font-bold"
            disabled={disabled}
            style={{ letterSpacing: "0.14px" }}
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
          <EditableText
            value={stop.time ?? ""}
            onChange={(v) => onUpdate({ time: v || null })}
            className="text-[7px] font-bold"
            disabled={disabled}
            style={{ letterSpacing: "0.21px", marginLeft: "2px" }}
          />
        </div>
      </div>

      {/* PLACE row — firma + oddział/adres */}
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
                />
              </div>
              <span className="text-[5px] ov-gray shrink-0 mt-[2px]">→</span>
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

      {/* Delete button (hover) — inside container to avoid overflow clip */}
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
// Helpers
// ---------------------------------------------------------------------------

const PACKAGING_TYPES: PackagingType[] = ["LUZEM", "BIGBAG", "PALETA", "INNA"];
const CURRENCIES: CurrencyCode[] = ["EUR", "USD", "PLN"];

function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyItem(): OrderViewItem {
  return { id: generateId(), name: "", notes: "", packagingType: null };
}

function createEmptyStop(kind: StopKind): OrderViewStop {
  return {
    id: generateId(),
    kind,
    sequenceNo: 0,
    date: null,
    time: null,
    companyId: null,
    companyName: null,
    locationId: null,
    locationName: null,
    address: null,
    country: "PL",
    place: "",
  };
}

function renumberStops(stops: OrderViewStop[]): OrderViewStop[] {
  return stops.map((s, i) => ({ ...s, sequenceNo: i + 1 }));
}

// ---------------------------------------------------------------------------
// Shared cell/row style fragments (Tailwind arbitrary values)
// ---------------------------------------------------------------------------

const CELL = "flex items-center px-1 overflow-hidden";
const LABEL_98 = `${CELL} w-[98px] shrink-0 bg-[#E9E9E9]`;
const ROW_526 = "flex w-[526px]";
const ROW_449 = "flex w-[449px]";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderDocument({
  data,
  onChange,
  isReadOnly,
}: OrderDocumentProps) {
  // -- Mutation helpers (immutable updates) ----------------------------------

  const update = useCallback(
    (patch: Partial<OrderViewData>) => {
      onChange({ ...data, ...patch });
    },
    [data, onChange],
  );

  const updateItem = useCallback(
    (index: number, patch: Partial<OrderViewItem>) => {
      const items = data.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      );
      onChange({ ...data, items });
    },
    [data, onChange],
  );

  const addItem = useCallback(() => {
    if (data.items.length >= MAX_VISIBLE_ITEMS) return;
    onChange({ ...data, items: [...data.items, createEmptyItem()] });
  }, [data, onChange]);

  const removeItem = useCallback(
    (index: number) => {
      onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
    },
    [data, onChange],
  );

  // -- Stop handlers (unified, replacing old loading/unloading/intermediate) --

  const updateStop = useCallback(
    (index: number, patch: Partial<OrderViewStop>) => {
      const stops = data.stops.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      );
      onChange({ ...data, stops });
    },
    [data, onChange],
  );

  const removeStop = useCallback(
    (index: number) => {
      const filtered = data.stops.filter((_, i) => i !== index);
      onChange({ ...data, stops: renumberStops(filtered) });
    },
    [data, onChange],
  );

  const addStop = useCallback(
    (kind: StopKind) => {
      const stops = [...data.stops];
      const newStop = createEmptyStop(kind);

      if (kind === "LOADING") {
        // Insert after the last LOADING stop
        let lastLoadingIdx = -1;
        for (let i = stops.length - 1; i >= 0; i--) {
          if (stops[i].kind === "LOADING") {
            lastLoadingIdx = i;
            break;
          }
        }
        if (lastLoadingIdx === -1) {
          stops.unshift(newStop);
        } else {
          stops.splice(lastLoadingIdx + 1, 0, newStop);
        }
      } else {
        // Insert before the last UNLOADING stop
        let lastUnloadingIdx = -1;
        for (let i = stops.length - 1; i >= 0; i--) {
          if (stops[i].kind === "UNLOADING") {
            lastUnloadingIdx = i;
            break;
          }
        }
        if (lastUnloadingIdx === -1) {
          stops.push(newStop);
        } else {
          stops.splice(lastUnloadingIdx, 0, newStop);
        }
      }

      onChange({ ...data, stops: renumberStops(stops) });
    },
    [data, onChange],
  );

  // -- DnD setup -------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sortableIds = data.stops.map((s) => s.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = sortableIds.indexOf(active.id as string);
      const newIdx = sortableIds.indexOf(over.id as string);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...data.stops], oldIdx, newIdx);

      // Enforce: first position must be LOADING
      if (reordered.length > 0 && reordered[0].kind !== "LOADING") return;
      // Enforce: last position must be UNLOADING
      if (reordered.length > 0 && reordered[reordered.length - 1].kind !== "UNLOADING") return;

      onChange({ ...data, stops: renumberStops(reordered) });
    },
    [data, onChange, sortableIds],
  );

  // -- Documents select state -----------------------------------------------

  const [docsOpen, setDocsOpen] = useState(false);
  const docsRef = useRef<HTMLDivElement>(null);

  // -- Payment method select state ------------------------------------------

  const [paymentOpen, setPaymentOpen] = useState(false);
  const paymentRef = useRef<HTMLDivElement>(null);

  // -- Render ---------------------------------------------------------------

  const disabled = isReadOnly;

  // Build the padded items array (always 8 visual slots)
  const paddedItems: (OrderViewItem | null)[] = [
    ...data.items,
    ...Array(MAX_VISIBLE_ITEMS - data.items.length).fill(null),
  ];

  // Count stops by kind for add button limits
  const loadingCount = data.stops.filter((s) => s.kind === "LOADING").length;
  const unloadingCount = data.stops.filter((s) => s.kind === "UNLOADING").length;

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] overflow-hidden flex items-start justify-center">
      {/* Scoped styles to force black text on the A4 document page */}
      <style>{`
        .order-a4-page, .order-a4-page * { color: #000; }
        .order-a4-page input, .order-a4-page textarea { color: #000; }
        .order-a4-page .ov-gray { color: #9A9A9A !important; }
        .order-a4-page .ov-gray2 { color: #8D8D8D !important; }
        .order-a4-page .ov-orange { color: #F59444 !important; }
      `}</style>
      <div
        className="order-a4-page relative w-[595px] min-h-[842px] p-[32px_34px]"
        style={{
          transform: "scale(1.3345)",
          transformOrigin: "top center",
          fontFamily: "Arial, Helvetica, sans-serif",
          color: "#000",
        }}
      >
        {/* ================================================================ */}
        {/* 1. LOGO                                                          */}
        {/* ================================================================ */}
        <div className="absolute left-[501px] top-[33px] w-[57px] h-[55px] rounded-[27.4px] overflow-hidden flex items-center justify-center">
          <img
            src={LOGO_BASE64}
            alt="Logo"
            className="w-full h-full object-cover"
          />
        </div>

        {/* ================================================================ */}
        {/* 2. ROW 1: ZLECENIE NR (readonly)                                 */}
        {/* ================================================================ */}
        <div className={`${ROW_449} h-[23px]`}>
          <div
            className={`${CELL} w-[98px] shrink-0 bg-[#E9E9E9] border-l-[0.5px] border-t-[0.5px] border-solid border-black text-[8px] font-bold`}
            style={{ padding: "4px 2px" }}
          >
            ZLECENIE NR:
          </div>
          <div
            className={`${CELL} w-[235px] border-t-[0.5px] border-l-[0.5px] border-solid border-black`}
          >
            <span
              className="text-[5px] ov-gray"
              style={{ padding: "0 10px", letterSpacing: "0.2px" }}
            >
              NUMER
            </span>
            <span
              className="text-[9px] font-bold"
              style={{ letterSpacing: "0.36px" }}
            >
              {data.orderNo}
            </span>
          </div>
          <div
            className={`${CELL} w-[116px] border-t-[0.5px] border-l-[0.5px] border-dashed border-black`}
          >
            <span
              className="text-[5px] ov-gray leading-[1.4]"
              style={{ padding: "0 7px", letterSpacing: "0.2px" }}
            >
              DATA
              <br />
              WYST
            </span>
            <span className="text-[7px]" style={{ letterSpacing: "0.21px" }}>
              {data.createdAt}
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 3. ROW 2: ZLECAJACY (readonly)                                   */}
        {/* ================================================================ */}
        <div className={`${ROW_449} h-[23px]`}>
          <div
            className={`${CELL} w-[98px] shrink-0 bg-[#E9E9E9] border-b-[0.5px] border-dashed border-black border-r-[0.5px] text-[7px] font-bold`}
            style={{ padding: "0 2px" }}
          >
            ZLECAJĄCY:
          </div>
          <div
            className={`${CELL} w-[351px] border-b-[0.5px] border-dashed border-black border-l-[0.5px] border-l-solid`}
            style={{ borderLeftStyle: "solid" }}
          >
            <span
              className="text-[5px] ov-gray leading-[1.4]"
              style={{ padding: "0 10px", letterSpacing: "0.2px" }}
            >
              PEŁNA
              <br />
              NAZWA
            </span>
            <span className="text-[7px]" style={{ letterSpacing: "0.28px" }}>
              {COMPANY_NAME}
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 4. ORANGE HEADER                                                 */}
        {/* ================================================================ */}
        <div className={`${ROW_449} h-[26px]`}>
          <div
            className={`${CELL} flex-1 border-t-[0.5px] border-solid border-black`}
            style={{ padding: "9px 10px" }}
          >
            <span
              className="text-[9.5px] font-bold ov-orange"
              style={{ letterSpacing: "0.14px" }}
            >
              {CONDITIONS_HEADER}
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 5. SPEDYCJA (editable: carrier name+address, readonly: nip)      */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[24px]`}>
          <div
            className={`${LABEL_98} border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-end`}
            style={{ padding: "5px 2px" }}
          >
            SPEDYCJA:
          </div>
          <div
            className={`${CELL} w-[314px] border-t-[0.5px] border-l-[0.5px] border-solid border-black`}
          >
            <span
              className="text-[5px] ov-gray leading-[1.4] shrink-0"
              style={{ padding: "0 2px", letterSpacing: "0.35px" }}
            >
              PEŁNA
              <br />
              NAZWA
            </span>
            {disabled ? (
              <span
                className="text-[7px] leading-[1.4]"
                style={{ paddingLeft: "19px", letterSpacing: "0.14px" }}
              >
                {data.carrierName} {data.carrierAddress}
              </span>
            ) : (
              <div
                className="flex flex-col leading-[1.4]"
                style={{ paddingLeft: "19px" }}
              >
                <EditableText
                  value={data.carrierName}
                  onChange={(v) => update({ carrierName: v })}
                  className="text-[7px]"
                  disabled={false}
                  style={{ letterSpacing: "0.14px" }}
                />
                <EditableText
                  value={data.carrierAddress}
                  onChange={(v) => update({ carrierAddress: v })}
                  className="text-[7px]"
                  disabled={false}
                  style={{ letterSpacing: "0.14px" }}
                />
              </div>
            )}
          </div>
          <div
            className={`${CELL} w-[113px] border-t-[0.5px] border-solid border-black border-l-[0.5px] border-l-dashed`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[5px] ov-gray shrink-0"
              style={{ padding: "0 2px", letterSpacing: "0.2px" }}
            >
              NIP
            </span>
            <span
              className="text-[7px]"
              style={{ paddingLeft: "18px", letterSpacing: "0.21px" }}
            >
              {data.carrierNip}
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 6. TYP AUTA (editable)                                           */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[24px]`}>
          <div
            className={`${LABEL_98} border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-end`}
            style={{ padding: "5px 1px" }}
          >
            TYP AUTA:
          </div>
          <div
            className={`${CELL} w-[314px] border-t-[0.5px] border-l-[0.5px] border-solid border-black`}
          >
            <span
              className="text-[5px] ov-gray shrink-0"
              style={{ padding: "0 2px", letterSpacing: "0.35px" }}
            >
              OPIS
            </span>
            <div style={{ paddingLeft: "25px", flex: 1 }}>
              <EditableText
                value={data.vehicleType}
                onChange={(v) => update({ vehicleType: v })}
                className="text-[7px]"
                disabled={disabled}
                style={{ letterSpacing: "0.14px" }}
              />
            </div>
          </div>
          <div
            className={`${CELL} w-[113px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[5px] ov-gray shrink-0"
              style={{ padding: "0 4px", letterSpacing: "0.2px" }}
            >
              m3
            </span>
            <div style={{ paddingLeft: "11px", flex: 1 }}>
              <EditableNumber
                value={data.vehicleVolumeM3}
                onChange={(v) => update({ vehicleVolumeM3: v })}
                className="text-[7px]"
                disabled={disabled}
                style={{ letterSpacing: "0.21px" }}
              />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 7. ASORTYMENT HEADER                                             */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[17px]`}>
          <div
            className={`${LABEL_98} border-t-[0.5px] border-solid border-black text-[7px] font-bold items-end`}
            style={{ padding: "4px 1px" }}
          >
            ASORTYMENT:
          </div>
          <div
            className={`${CELL} w-[136px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
          />
          <div
            className={`${CELL} w-[178px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{
              borderLeftStyle: "dashed",
              justifyContent: "center",
            }}
          >
            <span
              className="text-[6px] ov-gray2"
              style={{ letterSpacing: "0.12px" }}
            >
              UWAGI
            </span>
          </div>
          <div
            className={`${CELL} w-[33px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[6px] ov-gray2"
              style={{ letterSpacing: "-0.3px" }}
            >
              LUZEM
            </span>
          </div>
          <div
            className={`${CELL} w-[28px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[6px] ov-gray2"
              style={{ letterSpacing: "-0.3px" }}
            >
              BIGBAG
            </span>
          </div>
          <div
            className={`${CELL} w-[29px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[6px] ov-gray2"
              style={{ letterSpacing: "-0.3px" }}
            >
              PALETA
            </span>
          </div>
          <div
            className={`${CELL} w-[24px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[6px] ov-gray2"
              style={{ letterSpacing: "-0.3px" }}
            >
              INNA
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 8. ITEMS GRID (8 rows x 30px)                                    */}
        {/* ================================================================ */}
        {paddedItems.map((item, rowIdx) => {
          const isLast = rowIdx === MAX_VISIBLE_ITEMS - 1;
          const borderBottomClass = isLast
            ? "border-b-[0.5px] border-solid border-black"
            : "border-b-[0.5px] border-dashed border-black";
          const hasItem = item !== null;
          const itemIndex = hasItem ? rowIdx : -1;

          return (
            <div
              key={rowIdx}
              className="flex w-[544px] h-[30px] group"
            >
              {/* Name column */}
              <div
                className={`${CELL} w-[234px] ${borderBottomClass} border-r-[0.5px] border-r-dashed text-[7px] font-bold items-end`}
                style={{
                  padding: "7px 6px",
                  borderRightStyle: "dashed",
                }}
              >
                {hasItem ? (
                  <>
                    <span className="shrink-0 text-[7px] font-bold mr-1">
                      {rowIdx + 1}
                    </span>
                    <ProductAutocomplete
                      value={item.name}
                      onSelect={(product) =>
                        updateItem(itemIndex, {
                          name: product.name,
                          packagingType: product.defaultPackaging,
                        })
                      }
                      disabled={disabled}
                    />
                  </>
                ) : !disabled && rowIdx === data.items.length ? (
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-[7px] ov-gray hover:text-black cursor-pointer bg-transparent border-none"
                  >
                    + dodaj pozycję
                  </button>
                ) : null}
              </div>

              {/* Notes column (merged 90px + 88px) */}
              <div
                className={`${CELL} w-[178px] ${borderBottomClass} border-r-[0.5px] border-r-dashed`}
                style={{ borderRightStyle: "dashed" }}
              >
                {hasItem && (
                  <EditableText
                    value={item.notes}
                    onChange={(v) => updateItem(itemIndex, { notes: v })}
                    className="text-[7px]"
                    disabled={disabled}
                  />
                )}
              </div>

              {/* Packaging type columns */}
              {PACKAGING_TYPES.map((pt) => {
                const widthClass =
                  pt === "LUZEM"
                    ? "w-[33px]"
                    : pt === "BIGBAG"
                      ? "w-[28px]"
                      : pt === "PALETA"
                        ? "w-[29px]"
                        : "w-[24px]";
                const isSelected = hasItem && item.packagingType === pt;
                const isLastPackaging = pt === "INNA";

                return (
                  <div
                    key={pt}
                    className={`${CELL} ${widthClass} ${borderBottomClass} justify-center ${
                      !isLastPackaging
                        ? "border-r-[0.5px] border-r-dashed"
                        : ""
                    } ${!disabled && hasItem ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    style={
                      !isLastPackaging ? { borderRightStyle: "dashed" } : {}
                    }
                    onClick={() => {
                      if (disabled || !hasItem) return;
                      updateItem(itemIndex, {
                        packagingType: isSelected ? null : pt,
                      });
                    }}
                  >
                    {isSelected && (
                      <span className="text-[8px] font-bold">X</span>
                    )}
                  </div>
                );
              })}

              {/* Delete column — invisible, 18px gutter for × button */}
              <div className="w-[18px] shrink-0 flex items-center justify-center">
                {!disabled && hasItem && (
                  <button
                    type="button"
                    onClick={() => removeItem(itemIndex)}
                    className="hidden group-hover:flex items-center justify-center w-[12px] h-[12px] text-[8px] text-red-500 hover:text-red-700 bg-white rounded-full border border-red-300 cursor-pointer leading-none"
                    title="Usuń pozycję"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* ================================================================ */}
        {/* 9. STOPS (unified DnD list — LOADING + UNLOADING)                */}
        {/* ================================================================ */}
        {disabled ? (
          // ReadOnly mode: no DnD, just render stops
          data.stops.map((stop, idx) => (
            <StopRows
              key={stop.id}
              stop={stop}
              stopIndex={idx}
              disabled={disabled}
              allStops={data.stops}
              onUpdate={(patch) => updateStop(idx, patch)}
              onRemove={() => removeStop(idx)}
            />
          ))
        ) : (
          // Edit mode: DnD enabled
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {data.stops.map((stop, idx) => (
                <SortableStopWrapper
                  key={stop.id}
                  sortableId={stop.id}
                  isReadOnly={disabled}
                >
                  <StopRows
                    stop={stop}
                    stopIndex={idx}
                    disabled={disabled}
                    allStops={data.stops}
                    onUpdate={(patch) => updateStop(idx, patch)}
                    onRemove={() => removeStop(idx)}
                  />
                </SortableStopWrapper>
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Add stop buttons */}
        {!disabled && (
          <div className={`${ROW_526} h-[18px] justify-center gap-4`}>
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

        {/* ================================================================ */}
        {/* 10. GAP 8px                                                      */}
        {/* ================================================================ */}
        <div className="h-[8px]" />

        {/* ================================================================ */}
        {/* 11. CENA ZA FRAHT (editable)                                     */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[24px]`}>
          <div
            className={`${LABEL_98} border-t-[0.5px] border-b-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold`}
            style={{ padding: "0 2px" }}
          >
            CENA ZA FRAHT:
          </div>
          <div className="flex flex-1 border-t-[0.5px] border-b-[0.5px] border-solid border-black items-center">
            {/* KWOTA */}
            <div className="flex flex-col items-center" style={{ padding: "4px 10px" }}>
              <span
                className="text-[5px] font-bold ov-gray"
                style={{ letterSpacing: "0.2px" }}
              >
                KWOTA
              </span>
              <EditableNumber
                value={data.priceAmount}
                onChange={(v) => update({ priceAmount: v })}
                className="text-[7px] font-bold text-center"
                disabled={disabled}
                style={{ letterSpacing: "0.28px", width: "40px" }}
              />
            </div>

            {/* Currency selector */}
            <div
              className="flex items-center gap-[3px]"
              style={{ marginLeft: "26px" }}
            >
              {CURRENCIES.map((cur) => {
                const isSelected = data.currencyCode === cur;
                return (
                  <div
                    key={cur}
                    className={`flex items-center ${!disabled ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (!disabled) update({ currencyCode: cur });
                    }}
                  >
                    <span
                      className="text-[5px] font-bold ov-gray"
                      style={{
                        padding: "0 10px",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {cur}
                    </span>
                    <span
                      className={`text-[7px] font-bold ${isSelected ? "text-black" : "text-transparent"}`}
                      style={{ letterSpacing: "0.28px" }}
                    >
                      X
                    </span>
                  </div>
                );
              })}
            </div>

            {/* TERMIN PLATNOSCI + FORMA PLATNOSCI */}
            <div
              className="flex items-center"
              style={{ marginLeft: "13px", gap: "23px" }}
            >
              {/* Termin */}
              <div className="flex items-center">
                <div
                  className="flex flex-col"
                  style={{ padding: "0 4px" }}
                >
                  <span
                    className="text-[5px] font-bold ov-gray"
                    style={{ lineHeight: "5px", letterSpacing: "0.2px" }}
                  >
                    TERMIN
                  </span>
                  <span
                    className="text-[5px] font-bold ov-gray"
                    style={{ lineHeight: "5px", letterSpacing: "0.2px" }}
                  >
                    PŁATNOŚCI
                  </span>
                </div>
                <div className="flex items-center">
                  <EditableNumber
                    value={data.paymentTermDays}
                    onChange={(v) => update({ paymentTermDays: v })}
                    className="text-[7px] font-bold text-center"
                    disabled={disabled}
                    style={{
                      letterSpacing: "0.28px",
                      width: "20px",
                    }}
                  />
                  <span
                    className="text-[7px] font-bold"
                    style={{ letterSpacing: "0.28px" }}
                  >
                    {" "}
                    DNI
                  </span>
                </div>
              </div>

              {/* Forma platnosci */}
              <div className="flex items-center relative" ref={paymentRef}>
                <span
                  className="text-[5px] font-bold ov-gray leading-[6px]"
                  style={{
                    padding: "0 10px",
                    letterSpacing: "0.2px",
                  }}
                >
                  FORMA
                  <br />
                  PŁATNOŚCI
                </span>
                {disabled ? (
                  <span
                    className="text-[7px] font-bold"
                    style={{ letterSpacing: "0.28px" }}
                  >
                    {data.paymentMethod ?? ""}
                  </span>
                ) : (
                  <span
                    className="text-[7px] font-bold cursor-pointer hover:underline"
                    style={{ letterSpacing: "0.28px" }}
                    onClick={() => setPaymentOpen(!paymentOpen)}
                  >
                    {data.paymentMethod ?? "---"}
                  </span>
                )}
                {paymentOpen && !disabled && (
                  <div className="absolute top-full left-0 z-50 bg-white border border-gray-300 shadow-md rounded text-[7px]">
                    {PAYMENT_METHODS.map((method) => (
                      <div
                        key={method}
                        className={`px-2 py-1 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${
                          data.paymentMethod === method
                            ? "font-bold bg-gray-50"
                            : ""
                        }`}
                        onClick={() => {
                          update({ paymentMethod: method });
                          setPaymentOpen(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 12. DOKUMENTY DLA KIEROWCY (editable)                            */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[20px]`}>
          <div
            className={`${CELL} w-[98px] shrink-0 border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold`}
            style={{ padding: "0 2px" }}
          >
            Dokumenty dla kierowcy:
          </div>
          <div
            className={`${CELL} w-[427px] border-t-[0.5px] border-solid border-black text-[7px] font-bold items-start relative`}
            style={{ padding: "3px 2px" }}
            ref={docsRef}
          >
            {disabled ? (
              <span>{data.documentsText}</span>
            ) : (
              <span
                className="cursor-pointer hover:underline"
                onClick={() => setDocsOpen(!docsOpen)}
              >
                {data.documentsText || "---"}
              </span>
            )}
            {docsOpen && !disabled && (
              <div className="absolute top-full left-0 z-50 bg-white border border-gray-300 shadow-md rounded text-[7px]">
                {DOCUMENTS_OPTIONS.map((opt) => (
                  <div
                    key={opt}
                    className={`px-2 py-1 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${
                      data.documentsText === opt
                        ? "font-bold bg-gray-50"
                        : ""
                    }`}
                    onClick={() => {
                      update({ documentsText: opt });
                      setDocsOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 13. GAP 8px                                                      */}
        {/* ================================================================ */}
        <div className="h-[8px]" />

        {/* ================================================================ */}
        {/* 14. UWAGI DODATKOWE (editable)                                   */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[46px]`}>
          <div
            className={`${CELL} w-[98px] shrink-0 border-t-[0.5px] border-b-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-start`}
            style={{ padding: "7px 2px" }}
          >
            Uwagi dodatkowe:
          </div>
          <div
            className="w-[427px] border-t-[0.5px] border-b-[0.5px] border-solid border-black text-[7px] items-start"
            style={{ display: "block", padding: "3px 2px" }}
          >
            <EditableTextarea
              value={data.generalNotes}
              onChange={(v) => update({ generalNotes: v.slice(0, 500) })}
              className="text-[7px] leading-[1.4]"
              disabled={disabled}
              rows={4}
              maxLength={500}
              style={{ height: "38px" }}
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* 15. KLAUZULA O ZACHOWANIU POUFNOSCI (editable)                   */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[64px]`}>
          <div
            className={`${CELL} w-[98px] shrink-0 border-t-[0.5px] border-b-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-start`}
            style={{ padding: "7px 2px" }}
          >
            Klauzula o zachowaniu
            <br />
            poufności
          </div>
          <div
            className="w-[427px] border-t-[0.5px] border-b-[0.5px] border-solid border-black text-[6.5px] items-start"
            style={{
              display: "block",
              padding: "3px 2px",
              lineHeight: "8px",
            }}
          >
            <EditableTextarea
              value={data.confidentialityClause}
              onChange={(v) => update({ confidentialityClause: v })}
              className="text-[6.5px]"
              disabled={disabled}
              rows={7}
              style={{ height: "56px", lineHeight: "8px" }}
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* 16. OSOBA ZLECAJACA (readonly)                                   */}
        {/* ================================================================ */}
        <div className="w-[191px] ml-[335px]">
          {/* Header row */}
          <div
            className="flex flex-col border-l-[0.5px] border-solid border-black h-[31px]"
            style={{ padding: "6px 7px", gap: "4px" }}
          >
            <div className="text-[7px] font-bold">OSOBA ZLECAJĄCA:</div>
            <div className="text-[7px]">{data.personName}</div>
          </div>

          {/* Email row */}
          <div
            className="flex h-[15px] border-t-[0.5px] border-dashed border-black text-[7px]"
            style={{ padding: "3px 7px" }}
          >
            <div className="w-[40px] shrink-0 text-[6px] ov-gray2">
              E-MAIL
            </div>
            <div
              className="flex-1 border-l-[0.5px] border-dashed border-black"
              style={{ paddingLeft: "7px" }}
            >
              {data.personEmail}
            </div>
          </div>

          {/* Phone row */}
          <div
            className="flex h-[12px] border-t-[0.5px] border-dashed border-black border-b-[0.5px] border-b-solid text-[7px]"
            style={{ padding: "3px 7px", borderBottomStyle: "solid" }}
          >
            <div className="w-[40px] shrink-0 text-[6px] ov-gray2">
              TELEFON
            </div>
            <div
              className="flex-1 border-l-[0.5px] border-dashed border-black"
              style={{ paddingLeft: "7px" }}
            >
              {data.personPhone}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

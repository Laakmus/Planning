import React, { useCallback, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
  TestProduct,
} from "./types";
import {
  COMPANY_NAME,
  CONDITIONS_HEADER,
  DOCUMENTS_OPTIONS,
  LOGO_BASE64,
  MAX_VISIBLE_ITEMS,
  PAYMENT_METHODS,
} from "./constants";
import { TEST_PRODUCTS } from "./test-data";

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

function createEmptyStop(): OrderViewStop {
  return { id: generateId(), date: null, time: null, place: "", country: "PL" };
}

// ---------------------------------------------------------------------------
// Shared cell/row style fragments (Tailwind arbitrary values)
// ---------------------------------------------------------------------------

const CELL = "flex items-center px-1 overflow-hidden";
const LABEL_98 = `${CELL} w-[98px] shrink-0 bg-[#E9E9E9]`;
const LABEL_98_E7 = `${CELL} w-[98px] shrink-0 bg-[#E7E7E7]`;
const LABEL_98_ORANGE = `${CELL} w-[98px] shrink-0 bg-[#F59444]`;
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

  const updateLoading = useCallback(
    (patch: Partial<OrderViewStop>) => {
      onChange({ ...data, loading: { ...data.loading, ...patch } });
    },
    [data, onChange],
  );

  const updateUnloading = useCallback(
    (patch: Partial<OrderViewStop>) => {
      onChange({ ...data, unloading: { ...data.unloading, ...patch } });
    },
    [data, onChange],
  );

  const updateIntermediateStop = useCallback(
    (index: number, patch: Partial<OrderViewStop>) => {
      const stops = data.intermediateStops.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      );
      onChange({ ...data, intermediateStops: stops });
    },
    [data, onChange],
  );

  const addIntermediateStop = useCallback(() => {
    onChange({
      ...data,
      intermediateStops: [...data.intermediateStops, createEmptyStop()],
    });
  }, [data, onChange]);

  const removeIntermediateStop = useCallback(
    (index: number) => {
      onChange({
        ...data,
        intermediateStops: data.intermediateStops.filter(
          (_, i) => i !== index,
        ),
      });
    },
    [data, onChange],
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

  return (
    <div className="w-[210mm] h-[297mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] overflow-hidden flex items-start justify-center">
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
            className={`${CELL} w-[235px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
          />
          <div
            className={`${CELL} w-[90px] border-t-[0.5px] border-solid border-black border-l-[0.5px] border-l-dashed`}
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
            className={`${CELL} w-[88px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          />
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
              className={`${ROW_526} h-[30px] group relative`}
            >
              {/* Name column */}
              <div
                className={`${CELL} w-[235px] ${borderBottomClass} border-r-[0.5px] border-r-dashed text-[7px] font-bold items-end`}
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

              {/* Delete button (hover) */}
              {!disabled && hasItem && (
                <button
                  type="button"
                  onClick={() => removeItem(itemIndex)}
                  className="absolute right-[-14px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-[12px] h-[12px] text-[8px] text-red-500 hover:text-red-700 bg-white rounded-full border border-red-300 cursor-pointer leading-none"
                  title="Usuń pozycję"
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}

        {/* ================================================================ */}
        {/* 9. DATA ZALADUNKU (editable)                                     */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[17px]`}>
          <div
            className={`${LABEL_98_E7} border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-end`}
            style={{ padding: "5px 2px" }}
          >
            DATA ZAŁADUNKU
          </div>
          <div
            className={`${CELL} w-[314px] border-t-[0.5px] border-l-[0.5px] border-solid border-black`}
            style={{ paddingLeft: "12px" }}
          >
            <EditableText
              value={data.loading.date ?? ""}
              onChange={(v) => updateLoading({ date: v || null })}
              className="text-[7px] font-bold"
              disabled={disabled}
              style={{ letterSpacing: "0.14px" }}
            />
          </div>
          <div
            className={`${CELL} w-[113px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[5.5px] font-bold ov-gray shrink-0"
              style={{ padding: "0 4px", letterSpacing: "0.22px" }}
            >
              GODZINA
            </span>
            <EditableText
              value={data.loading.time ?? ""}
              onChange={(v) => updateLoading({ time: v || null })}
              className="text-[7px] font-bold"
              disabled={disabled}
              style={{ letterSpacing: "0.21px" }}
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* 10. MIEJSCE ZALADUNKU (editable)                                 */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[17px]`}>
          <div
            className={`${LABEL_98_E7} border-b-[0.5px] border-dashed border-black border-r-[0.5px] text-[7px] font-bold items-end`}
            style={{ padding: "5px 2px", borderRightStyle: "solid" }}
          >
            MIEJSCE ZAŁADUNKU
          </div>
          <div
            className={`${CELL} w-[314px] border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
            style={{ paddingLeft: "12px", borderLeftStyle: "solid" }}
          >
            <EditableText
              value={data.loading.place}
              onChange={(v) => updateLoading({ place: v })}
              className="text-[7px] font-bold"
              disabled={disabled}
              style={{ letterSpacing: "0.14px" }}
            />
          </div>
          <div
            className={`${CELL} w-[113px] border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[5.5px] font-bold ov-gray shrink-0"
              style={{ padding: "0 4px", letterSpacing: "0.22px" }}
            >
              KRAJ
            </span>
            <div style={{ paddingLeft: "15px", flex: 1 }}>
              <EditableText
                value={data.loading.country}
                onChange={(v) => updateLoading({ country: v })}
                className="text-[7px] font-bold"
                disabled={disabled}
                style={{ letterSpacing: "0.21px" }}
              />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 11. DOLADUNKI (intermediate stops, dynamic, editable)            */}
        {/* ================================================================ */}
        {data.intermediateStops.map((stop, stopIdx) => (
          <div key={stop.id} className="relative group/stop">
            {/* DATA DOLADUNKU N */}
            <div className={`${ROW_526} h-[17px] bg-[#F8F8F8]`}>
              <div
                className={`${CELL} w-[98px] shrink-0 bg-[#F8F8F8] border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-end`}
                style={{ padding: "5px 2px" }}
              >
                DATA DOŁADUNKU {stopIdx + 1}:
              </div>
              <div
                className={`${CELL} w-[314px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
                style={{ paddingLeft: "12px" }}
              >
                <EditableText
                  value={stop.date ?? ""}
                  onChange={(v) =>
                    updateIntermediateStop(stopIdx, { date: v || null })
                  }
                  className="text-[7px] font-bold"
                  disabled={disabled}
                  style={{ letterSpacing: "0.14px" }}
                />
              </div>
              <div
                className={`${CELL} w-[113px] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
                style={{ borderLeftStyle: "dashed" }}
              >
                <span
                  className="text-[5.5px] font-bold ov-gray shrink-0"
                  style={{ padding: "0 4px", letterSpacing: "0.22px" }}
                >
                  GODZINA
                </span>
                <EditableText
                  value={stop.time ?? ""}
                  onChange={(v) =>
                    updateIntermediateStop(stopIdx, { time: v || null })
                  }
                  className="text-[7px] font-bold"
                  disabled={disabled}
                  style={{ letterSpacing: "0.21px" }}
                />
              </div>
            </div>

            {/* MIEJSCE DOLADUNKU N */}
            <div className={`${ROW_526} h-[17px] bg-[#F8F8F8]`}>
              <div
                className={`${CELL} w-[98px] shrink-0 bg-[#F8F8F8] border-b-[0.5px] border-dashed border-black border-r-[0.5px] text-[7px] font-bold items-end`}
                style={{ padding: "5px 2px", borderRightStyle: "solid" }}
              >
                MIEJSCE DOŁADUNKU {stopIdx + 1}:
              </div>
              <div
                className={`${CELL} w-[314px] border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
                style={{ paddingLeft: "12px", borderLeftStyle: "solid" }}
              >
                <EditableText
                  value={stop.place}
                  onChange={(v) =>
                    updateIntermediateStop(stopIdx, { place: v })
                  }
                  className="text-[7px] font-bold"
                  disabled={disabled}
                  style={{ letterSpacing: "0.14px" }}
                />
              </div>
              <div
                className={`${CELL} w-[113px] border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
                style={{ borderLeftStyle: "dashed" }}
              >
                <span
                  className="text-[5.5px] font-bold ov-gray shrink-0"
                  style={{ padding: "0 4px", letterSpacing: "0.22px" }}
                >
                  KRAJ
                </span>
                <div style={{ paddingLeft: "15px", flex: 1 }}>
                  <EditableText
                    value={stop.country}
                    onChange={(v) =>
                      updateIntermediateStop(stopIdx, { country: v })
                    }
                    className="text-[7px] font-bold"
                    disabled={disabled}
                    style={{ letterSpacing: "0.21px" }}
                  />
                </div>
              </div>
            </div>

            {/* Delete stop button */}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeIntermediateStop(stopIdx)}
                className="absolute right-[-14px] top-1/2 -translate-y-1/2 hidden group-hover/stop:flex items-center justify-center w-[12px] h-[12px] text-[8px] text-red-500 hover:text-red-700 bg-white rounded-full border border-red-300 cursor-pointer leading-none"
                title="Usuń doładunek"
              >
                &times;
              </button>
            )}
          </div>
        ))}

        {/* Add intermediate stop button */}
        {!disabled && (
          <div className={`${ROW_526} h-[14px] justify-center`}>
            <button
              type="button"
              onClick={addIntermediateStop}
              className="text-[6px] ov-gray hover:text-black cursor-pointer bg-transparent border-none"
            >
              + dodaj doładunek
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* 12. DATA ROZLADUNKU (editable, orange)                           */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[17px]`}>
          <div
            className={`${LABEL_98_ORANGE} border-t-[0.5px] border-solid border-black border-r-[0.5px] text-[7px] font-bold items-end`}
            style={{ padding: "5px 2px" }}
          >
            DATA ROZŁADUNKU:
          </div>
          <div
            className={`${CELL} w-[314px] bg-[#FAD1A5] border-t-[0.5px] border-l-[0.5px] border-solid border-black`}
            style={{ paddingLeft: "12px" }}
          >
            <EditableText
              value={data.unloading.date ?? ""}
              onChange={(v) => updateUnloading({ date: v || null })}
              className="text-[7px] font-bold"
              disabled={disabled}
              style={{ letterSpacing: "0.14px" }}
            />
          </div>
          <div
            className={`${CELL} w-[114px] bg-[#FAD1A5] border-t-[0.5px] border-solid border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[5.5px] font-bold ov-gray shrink-0"
              style={{ padding: "0 4px", letterSpacing: "0.22px" }}
            >
              GODZINA
            </span>
            <EditableText
              value={data.unloading.time ?? ""}
              onChange={(v) => updateUnloading({ time: v || null })}
              className="text-[7px] font-bold"
              disabled={disabled}
              style={{ letterSpacing: "0.21px" }}
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* 13. MIEJSCE ROZLADUNKU (editable, orange)                        */}
        {/* ================================================================ */}
        <div className={`${ROW_526} h-[17px]`}>
          <div
            className={`${LABEL_98_ORANGE} border-b-[0.5px] border-dashed border-black border-r-[0.5px] text-[7px] font-bold items-end`}
            style={{ padding: "5px 2px", borderRightStyle: "solid" }}
          >
            MIEJSCE ROZŁADUNKU:
          </div>
          <div
            className={`${CELL} w-[314px] bg-[#FAD1A5] border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
            style={{ paddingLeft: "12px", borderLeftStyle: "solid" }}
          >
            <EditableText
              value={data.unloading.place}
              onChange={(v) => updateUnloading({ place: v })}
              className="text-[7px] font-bold"
              disabled={disabled}
              style={{ letterSpacing: "0.14px" }}
            />
          </div>
          <div
            className={`${CELL} w-[114px] bg-[#FAD1A5] border-b-[0.5px] border-dashed border-black border-l-[0.5px]`}
            style={{ borderLeftStyle: "dashed" }}
          >
            <span
              className="text-[5.5px] font-bold ov-gray shrink-0"
              style={{ padding: "0 4px", letterSpacing: "0.22px" }}
            >
              KRAJ
            </span>
            <div style={{ paddingLeft: "15px", flex: 1 }}>
              <EditableText
                value={data.unloading.country}
                onChange={(v) => updateUnloading({ country: v })}
                className="text-[7px] font-bold"
                disabled={disabled}
                style={{ letterSpacing: "0.21px" }}
              />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 14. GAP 8px                                                      */}
        {/* ================================================================ */}
        <div className="h-[8px]" />

        {/* ================================================================ */}
        {/* 15. CENA ZA FRAHT (editable)                                     */}
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
        {/* 16. DOKUMENTY DLA KIEROWCY (editable)                            */}
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
        {/* 17. GAP 8px                                                      */}
        {/* ================================================================ */}
        <div className="h-[8px]" />

        {/* ================================================================ */}
        {/* 18. UWAGI DODATKOWE (editable)                                   */}
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
        {/* 19. KLAUZULA O ZACHOWANIU POUFNOSCI (editable)                   */}
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
        {/* 20. OSOBA ZLECAJACA (readonly)                                   */}
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

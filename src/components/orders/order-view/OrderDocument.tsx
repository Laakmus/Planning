// OrderDocument — layout dokumentu A4 z edycja inline

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { formatDateFromTimestamp } from "@/lib/format-utils";
import type { OrderViewData, OrderViewItem, PackagingType } from "./types";
import {
  CELL,
  LABEL_98,
  ROW_526,
  ROW_449,
  COMPANY_NAME,
  CONDITIONS_HEADER,
  LOGO_BASE64,
  DOCUMENTS_OPTIONS,
  PAYMENT_METHODS,
  PACKAGING_TYPES,
  CURRENCIES,
  MIN_VISIBLE_ITEMS,
  MAX_VISIBLE_ITEMS,
  createEmptyItem,
} from "./constants";
import { EditableText, EditableNumber, EditableTextarea } from "./inline-editors";
import { DatePickerPopover, TimePickerPopover } from "./date-time-pickers";
import {
  ProductAutocomplete,
  CarrierAutocomplete,
  DocumentsAutocomplete,
  VehicleTypeAutocomplete,
} from "./autocompletes";
import StopRowsSection from "./StopRows";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrderDocumentProps {
  data: OrderViewData;
  onChange: (data: OrderViewData) => void;
  isReadOnly: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderDocument({
  data,
  onChange,
  isReadOnly,
}: OrderDocumentProps) {
  const { companies, locations, products, vehicleVariants } =
    useDictionaries();

  // Unikalne typy pojazdow z slownika
  const vehicleTypes = useMemo(
    () => [...new Set(vehicleVariants.map((v) => v.vehicleType))],
    [vehicleVariants],
  );

  // -- Responsywne skalowanie A4 --
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomFactor, setZoomFactor] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      // A4 base = 595px, padding = 2*16px
      const available = width - 32;
      const factor = Math.min(available / 595, 1.4);
      setZoomFactor(factor);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // -- Helpery mutacji (immutable updates) --

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

  // -- Stan forma platnosci --
  const [paymentOpen, setPaymentOpen] = useState(false);
  const paymentRef = useRef<HTMLDivElement>(null);

  // -- Render --

  const disabled = isReadOnly;

  // Budowanie tablicy towarow z paddingiem (min 8, rośnie do 15)
  const extraSlotForAddButton =
    data.items.length < MAX_VISIBLE_ITEMS ? 1 : 0;
  const totalVisualSlots = Math.max(
    MIN_VISIBLE_ITEMS,
    data.items.length + extraSlotForAddButton,
  );
  const paddedItems: (OrderViewItem | null)[] = [
    ...data.items,
    ...Array(totalVisualSlots - data.items.length).fill(null),
  ];

  return (
    <div
      ref={containerRef}
      className="order-a4-page-container w-full flex items-start justify-center"
    >
      {/* Style wymuszajace czarny tekst na dokumencie A4 */}
      <style>{`
        .order-a4-page, .order-a4-page * { color: #000; }
        .order-a4-page input, .order-a4-page textarea { color: #000; }
        .order-a4-page .ov-gray { color: #9A9A9A !important; }
        .order-a4-page .ov-gray2 { color: #8D8D8D !important; }
        .order-a4-page .ov-orange { color: #F59444 !important; }

        @media print {
          .order-a4-page svg.lucide { display: none !important; }
          .order-a4-page [aria-label="Przeciągnij"] { display: none !important; }
          .order-a4-page button[title="Usuń stop"],
          .order-a4-page button[title="Usuń pozycję"] { display: none !important; }
          [data-no-print] { display: none !important; }
          .order-a4-page button { cursor: default !important; }
          .order-a4-page { box-shadow: none !important; }
        }
      `}</style>
      <div
        className="order-a4-page relative w-[595px] min-h-[842px] p-[32px_34px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
        style={{
          zoom: zoomFactor,
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
              {formatDateFromTimestamp(data.createdAt)}
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
              <div
                className="flex flex-col leading-[1.4] flex-1 min-w-0"
                style={{ paddingLeft: "19px", letterSpacing: "0.14px" }}
              >
                <span className="text-[7px] font-bold truncate">
                  {data.carrierName}
                </span>
                <span className="text-[7px] truncate">
                  {data.carrierAddress}
                </span>
              </div>
            ) : (
              <div
                className="flex-1 min-w-0"
                style={{ paddingLeft: "19px" }}
              >
                <CarrierAutocomplete
                  carrierName={data.carrierName}
                  carrierAddress={data.carrierAddress}
                  onSelect={(company) => {
                    // Rozwiaz adres z lokalizacji
                    const loc = locations.find(
                      (l) =>
                        l.companyId === company.id && l.isActive,
                    );
                    update({
                      carrierName: company.name,
                      carrierAddress: loc
                        ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`
                        : "",
                      carrierNip: company.taxId ?? "",
                    });
                  }}
                  onClear={() =>
                    update({
                      carrierName: "",
                      carrierAddress: "",
                      carrierNip: "",
                    })
                  }
                  companies={companies}
                  locations={locations}
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
            <div style={{ paddingLeft: "25px", flex: 1, minWidth: 0 }}>
              {disabled ? (
                <span
                  className="text-[7px] font-bold"
                  style={{ letterSpacing: "0.14px" }}
                >
                  {data.vehicleType}
                </span>
              ) : (
                <VehicleTypeAutocomplete
                  value={data.vehicleType}
                  onSelect={(type) => update({ vehicleType: type })}
                  onClear={() => update({ vehicleType: "" })}
                  vehicleTypes={vehicleTypes}
                />
              )}
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
        {/* 8. ITEMS GRID (min 8 rows, rośnie do 15)                         */}
        {/* ================================================================ */}
        {paddedItems.map((item, rowIdx) => {
          const isLast = rowIdx === paddedItems.length - 1;
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
              {/* Kolumna nazwy */}
              <div
                className={`${CELL} w-[234px] ${borderBottomClass} text-[7px] font-bold items-end`}
                style={{ padding: "7px 6px" }}
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
                        })
                      }
                      disabled={disabled}
                      products={products}
                    />
                  </>
                ) : !disabled && rowIdx === data.items.length ? (
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-[7px] ov-gray hover:text-black cursor-pointer bg-transparent border-none"
                    data-no-print
                  >
                    + dodaj pozycję
                  </button>
                ) : null}
              </div>

              {/* Kolumna uwag */}
              <div
                className={`${CELL} w-[178px] ${borderBottomClass} border-l-[0.5px]`}
                style={{ borderLeftStyle: "dashed" }}
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

              {/* Kolumny typu pakowania */}
              {PACKAGING_TYPES.map((pt) => {
                const widthClass =
                  pt === "LUZEM"
                    ? "w-[33px]"
                    : pt === "BIGBAG"
                      ? "w-[28px]"
                      : pt === "PALETA"
                        ? "w-[29px]"
                        : "w-[24px]";
                const isSelected =
                  hasItem && item.packagingType === pt;

                return (
                  <div
                    key={pt}
                    className={`${CELL} ${widthClass} ${borderBottomClass} justify-center border-l-[0.5px] ${
                      !disabled && hasItem
                        ? "cursor-pointer hover:bg-gray-50"
                        : ""
                    }`}
                    style={{ borderLeftStyle: "dashed" }}
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

              {/* Kolumna usuwania — 18px gutter */}
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
        {/* 9. STOPS (DnD lista — LOADING + UNLOADING)                       */}
        {/* ================================================================ */}
        <StopRowsSection
          stops={data.stops}
          onStopsChange={(stops) => update({ stops })}
          isReadOnly={disabled}
          companies={companies}
          locations={locations}
        />

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
            <div
              className="flex flex-col items-center"
              style={{ padding: "4px 10px" }}
            >
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

            {/* Selektor waluty — radio cells z X */}
            <div
              className="flex items-center"
              style={{ marginLeft: "26px" }}
            >
              {CURRENCIES.map((cur) => {
                const isSelected = data.currencyCode === cur;
                return (
                  <div key={cur} className="flex items-center">
                    <span
                      className="text-[5px] font-bold ov-gray"
                      style={{
                        padding: "0 4px",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {cur}
                    </span>
                    <div
                      className={`flex items-center justify-center w-[14px] h-[14px] ${
                        !disabled
                          ? "cursor-pointer hover:bg-gray-50"
                          : ""
                      }`}
                      onClick={() => {
                        if (!disabled) update({ currencyCode: cur as any });
                      }}
                    >
                      {isSelected && (
                        <span className="text-[8px] font-bold">X</span>
                      )}
                    </div>
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
                    style={{
                      lineHeight: "5px",
                      letterSpacing: "0.2px",
                    }}
                  >
                    TERMIN
                  </span>
                  <span
                    className="text-[5px] font-bold ov-gray"
                    style={{
                      lineHeight: "5px",
                      letterSpacing: "0.2px",
                    }}
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
              <div
                className="flex items-center relative"
                ref={paymentRef}
              >
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
            className={`${CELL} w-[427px] border-t-[0.5px] border-solid border-black text-[7px] font-bold items-start`}
            style={{ padding: "3px 2px" }}
          >
            {disabled ? (
              <span>{data.documentsText}</span>
            ) : (
              <DocumentsAutocomplete
                value={data.documentsText}
                onSelect={(doc) => update({ documentsText: doc })}
              />
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
              onChange={(v) =>
                update({ generalNotes: v.slice(0, 500) })
              }
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
          {/* Naglowek */}
          <div
            className="flex flex-col border-l-[0.5px] border-solid border-black h-[31px]"
            style={{ padding: "6px 7px", gap: "4px" }}
          >
            <div className="text-[7px] font-bold">
              OSOBA ZLECAJĄCA:
            </div>
            <div className="text-[7px]">{data.personName}</div>
          </div>

          {/* Email */}
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

          {/* Telefon */}
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

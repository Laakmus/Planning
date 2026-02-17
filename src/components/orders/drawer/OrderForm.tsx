/**
 * Formularz zlecenia z 7 sekcjami (Sekcja 0–6).
 * Zarządza lokalnym stanem formularza i flagą isDirty.
 */

import { useEffect, useRef, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { formatDate } from "@/lib/format-utils";
import type { CurrencyCode, OrderFormData, OrderFormItem, OrderFormStop, OrderStatusCode, TransportTypeCode } from "@/lib/view-models";
import type { OrderDetailDto, OrderItemDto, OrderStopDto } from "@/types";

import { StatusBadge } from "../StatusBadge";
import { CargoSection } from "./CargoSection";
import { CarrierSection } from "./CarrierSection";
import { FinanceSection } from "./FinanceSection";
import { NotesSection } from "./NotesSection";
import { RouteSection } from "./RouteSection";
import { StatusSection } from "./StatusSection";

interface OrderFormProps {
  order: OrderDetailDto;
  stops: OrderStopDto[];
  items: OrderItemDto[];
  isReadOnly: boolean;
  onDirtyChange: (isDirty: boolean) => void;
  onSave: (data: OrderFormData, pendingStatus: OrderStatusCode | null, complaintReason: string | null) => Promise<void>;
  /** Przekazywany przez OrderDrawer aby wywołać submit z zewnątrz */
  submitRef: React.MutableRefObject<(() => void) | null>;
}

// ---------------------------------------------------------------------------
// Helpers — mapowanie DTO → stan formularza
// ---------------------------------------------------------------------------

function mapStopsToForm(stops: OrderStopDto[]): OrderFormStop[] {
  return stops.map((s) => ({
    id: s.id,
    kind: s.kind as "LOADING" | "UNLOADING",
    sequenceNo: s.sequenceNo,
    dateLocal: s.dateLocal,
    timeLocal: s.timeLocal,
    locationId: s.locationId,
    locationNameSnapshot: s.locationNameSnapshot,
    companyNameSnapshot: s.companyNameSnapshot,
    addressSnapshot: s.addressSnapshot,
    notes: s.notes,
    _deleted: false,
  }));
}

function mapItemsToForm(items: OrderItemDto[]): OrderFormItem[] {
  return items.map((it) => ({
    id: it.id,
    productId: it.productId,
    productNameSnapshot: it.productNameSnapshot,
    defaultLoadingMethodSnapshot: it.defaultLoadingMethodSnapshot,
    loadingMethodCode: it.loadingMethodCode,
    quantityTons: it.quantityTons,
    notes: it.notes,
    _deleted: false,
  }));
}

function buildInitialForm(order: OrderDetailDto, stops: OrderStopDto[], items: OrderItemDto[]): OrderFormData {
  return {
    transportTypeCode: (order.transportTypeCode as TransportTypeCode) ?? "PL",
    currencyCode: (order.currencyCode as CurrencyCode) ?? "PLN",
    priceAmount: order.priceAmount,
    paymentTermDays: order.paymentTermDays,
    paymentMethod: order.paymentMethod,
    totalLoadTons: order.totalLoadTons,
    totalLoadVolumeM3: order.totalLoadVolumeM3,
    carrierCompanyId: order.carrierCompanyId,
    shipperLocationId: order.shipperLocationId,
    receiverLocationId: order.receiverLocationId,
    vehicleVariantCode: order.vehicleVariantCode,
    specialRequirements: order.specialRequirements,
    requiredDocumentsText: order.requiredDocumentsText,
    generalNotes: order.generalNotes,
    complaintReason: order.complaintReason,
    senderContactName: order.senderContactName,
    senderContactPhone: order.senderContactPhone,
    senderContactEmail: order.senderContactEmail,
    stops: mapStopsToForm(stops),
    items: mapItemsToForm(items),
  };
}

// ---------------------------------------------------------------------------
// Sekcja nagłówkowa (readonly)
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponent główny
// ---------------------------------------------------------------------------

export function OrderForm({
  order,
  stops,
  items,
  isReadOnly,
  onDirtyChange,
  onSave,
  submitRef,
}: OrderFormProps) {
  const { companies, locations, products, transportTypes, vehicleVariants } = useDictionaries();

  const [formData, setFormData] = useState<OrderFormData>(() =>
    buildInitialForm(order, stops, items)
  );
  const [pendingStatusCode, setPendingStatusCode] = useState<OrderStatusCode | null>(null);
  const [complaintReason, setComplaintReason] = useState<string | null>(order.complaintReason);

  // Śledź isDirty przez porównanie z oryginalnym snapshoten
  const originalRef = useRef(buildInitialForm(order, stops, items));
  const [isDirty, setIsDirty] = useState(false);

  // Przebuduj formularz gdy order/stops/items się zmienią (np. po przeładowaniu detali)
  useEffect(() => {
    const initial = buildInitialForm(order, stops, items);
    originalRef.current = initial;
    setFormData(initial);
    setPendingStatusCode(null);
    setComplaintReason(order.complaintReason);
    setIsDirty(false);
  }, [order.id]); // reset przy zmianie zlecenia

  function patch(update: Partial<OrderFormData>) {
    setFormData((prev) => {
      const next = { ...prev, ...update };
      const dirty = JSON.stringify(next) !== JSON.stringify(originalRef.current) || pendingStatusCode !== null;
      setIsDirty(dirty);
      onDirtyChange(dirty);
      return next;
    });
  }

  // Rejestruj submit ref dla OrderDrawer
  useEffect(() => {
    submitRef.current = () => {
      onSave(formData, pendingStatusCode, complaintReason);
    };
  }, [formData, pendingStatusCode, complaintReason, onSave, submitRef]);

  // Status name lookup
  const statusName = order.statusCode
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-6 py-4 space-y-8">

        {/* Sekcja 0 – Nagłówek */}
        <section>
          <SectionHeader title="Nagłówek" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Nr zlecenia</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{order.orderNo}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Status</p>
              <StatusBadge statusCode={order.statusCode} statusName={statusName} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Data wystawienia</p>
              <p className="text-slate-700 dark:text-slate-300">
                {formatDate(order.createdAt.substring(0, 10))}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Tydzień</p>
              <p className="text-slate-700 dark:text-slate-300">
                {order.transportYear ? `${order.transportYear}` : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Sekcja 1 – Trasa */}
        <section>
          <SectionHeader title="Trasa" />
          <RouteSection
            formData={formData}
            transportTypes={transportTypes}
            companies={companies}
            locations={locations}
            isReadOnly={isReadOnly}
            onChange={patch}
          />
        </section>

        {/* Sekcja 2 – Towar */}
        <section>
          <SectionHeader title="Towar" />
          <CargoSection
            formData={formData}
            products={products}
            isReadOnly={isReadOnly}
            onChange={patch}
          />
        </section>

        {/* Sekcja 3 – Firma transportowa */}
        <section>
          <SectionHeader title="Firma transportowa" />
          <CarrierSection
            formData={formData}
            companies={companies}
            vehicleVariants={vehicleVariants}
            isReadOnly={isReadOnly}
            onChange={patch}
          />
        </section>

        {/* Sekcja 4 – Finanse */}
        <section>
          <SectionHeader title="Finanse" />
          <FinanceSection
            formData={formData}
            isReadOnly={isReadOnly}
            onChange={patch}
          />
        </section>

        {/* Sekcja 5 – Uwagi */}
        <section>
          <SectionHeader title="Uwagi" />
          <NotesSection
            formData={formData}
            isReadOnly={isReadOnly}
            onChange={patch}
          />
        </section>

        {/* Sekcja 6 – Zmiana statusu (tylko edycja) */}
        {!isReadOnly && (
          <section>
            <SectionHeader title="Zmiana statusu" />
            <StatusSection
              currentStatusCode={order.statusCode}
              currentStatusName={statusName}
              pendingStatusCode={pendingStatusCode}
              complaintReason={complaintReason}
              onStatusChange={(code) => {
                setPendingStatusCode(code);
                const dirty = code !== null || JSON.stringify(formData) !== JSON.stringify(originalRef.current);
                setIsDirty(dirty);
                onDirtyChange(dirty);
              }}
              onComplaintReasonChange={setComplaintReason}
            />
          </section>
        )}

      </div>
    </ScrollArea>
  );
}

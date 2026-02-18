/**
 * Formularz zlecenia z 7 sekcjami (Sekcja 0–6).
 * Zarządza lokalnym stanem formularza i flagą isDirty.
 */

import { useEffect, useRef, useState } from "react";

import { ArrowLeftRight, Banknote, MessageSquare, Package, Route, Truck } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useDictionaries } from "@/contexts/DictionaryContext";
import type { CurrencyCode, OrderFormData, OrderFormItem, OrderFormStop, OrderStatusCode, TransportTypeCode } from "@/lib/view-models";

/** Mapowanie starych kodów transportu na aktualne (dane seed/historyczne). */
const LEGACY_TRANSPORT_CODE_MAP: Record<string, TransportTypeCode> = {
  KRAJ: "PL", MIEDZY: "EXP", EKSPRES: "IMP",
};
import type { OrderDetailDto, OrderItemDto, OrderStopDto } from "@/types";

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
    transportTypeCode: (LEGACY_TRANSPORT_CODE_MAP[order.transportTypeCode] ?? order.transportTypeCode as TransportTypeCode) ?? "PL",
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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
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
      <div className="p-6 space-y-8">

        {/* Sekcja 1 – Trasa */}
        <section>
          <SectionHeader icon={<Route className="w-4 h-4 text-primary" />} title="Sekcja 1: Trasa" />
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
          <SectionHeader icon={<Package className="w-4 h-4 text-amber-500" />} title="Sekcja 2: Towar" />
          <CargoSection
            formData={formData}
            products={products}
            isReadOnly={isReadOnly}
            onChange={patch}
          />
        </section>

        {/* Sekcja 3 – Firma transportowa */}
        <section>
          <SectionHeader icon={<Truck className="w-4 h-4 text-violet-500" />} title="Sekcja 3: Firma transportowa" />
          <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-slate-800">
            <CarrierSection
              formData={formData}
              companies={companies}
              vehicleVariants={vehicleVariants}
              isReadOnly={isReadOnly}
              onChange={patch}
            />
          </div>
        </section>

        {/* Sekcja 4 – Finanse */}
        <section>
          <SectionHeader icon={<Banknote className="w-4 h-4 text-yellow-500" />} title="Sekcja 4: Finanse" />
          <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-slate-800">
            <FinanceSection
              formData={formData}
              isReadOnly={isReadOnly}
              onChange={patch}
            />
          </div>
        </section>

        {/* Sekcja 5 – Uwagi */}
        <section>
          <SectionHeader icon={<MessageSquare className="w-4 h-4 text-slate-400" />} title="Sekcja 5: Uwagi" />
          <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-slate-800">
            <NotesSection
              formData={formData}
              isReadOnly={isReadOnly}
              onChange={patch}
            />
          </div>
        </section>

        {/* Sekcja 6 – Zmiana statusu (tylko edycja) */}
        {!isReadOnly && (
          <section>
            <SectionHeader icon={<ArrowLeftRight className="w-4 h-4 text-indigo-500" />} title="Sekcja 6: Zmiana statusu" />
            <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-slate-800">
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
            </div>
          </section>
        )}

      </div>
    </ScrollArea>
  );
}

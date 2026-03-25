/**
 * Formularz zlecenia z 7 sekcjami (Sekcja 0–6).
 * Zarządza lokalnym stanem formularza i flagą isDirty.
 */

import { useEffect, useRef, useState, useTransition } from "react";

import { ArrowLeftRight, Banknote, MessageSquare, Package, Route, Truck, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { STATUS_NAMES } from "@/lib/view-models";
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
  submitRef: React.RefObject<(() => void) | null>;
  /** Ref do odczytu aktualnego stanu formData (dla OrderView) */
  formDataRef: React.RefObject<OrderFormData | null>;
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
    _clientKey: crypto.randomUUID(),
  }));
}

function buildInitialForm(
  order: OrderDetailDto,
  stops: OrderStopDto[],
  items: OrderItemDto[],
  currentUser: { fullName: string | null; phone: string | null; email: string } | null,
): OrderFormData {
  return {
    transportTypeCode: (LEGACY_TRANSPORT_CODE_MAP[order.transportTypeCode] ?? order.transportTypeCode as TransportTypeCode) ?? "PL",
    currencyCode: (order.currencyCode as CurrencyCode) ?? "PLN",
    priceAmount: order.priceAmount,
    paymentTermDays: order.paymentTermDays ?? 21,
    paymentMethod: order.paymentMethod,
    totalLoadTons: order.totalLoadTons,
    totalLoadVolumeM3: order.totalLoadVolumeM3,
    carrierCompanyId: order.carrierCompanyId,
    shipperLocationId: order.shipperLocationId,
    receiverLocationId: order.receiverLocationId,
    vehicleTypeText: order.vehicleTypeText,
    vehicleCapacityVolumeM3: order.vehicleCapacityVolumeM3,
    specialRequirements: order.specialRequirements,
    requiredDocumentsText: order.requiredDocumentsText,
    generalNotes: order.generalNotes,
    notificationDetails: order.notificationDetails,
    confidentialityClause: order.confidentialityClause,
    complaintReason: order.complaintReason,
    // Osoba kontaktowa = zawsze zalogowany użytkownik
    senderContactName: currentUser?.fullName ?? order.senderContactName,
    senderContactPhone: currentUser?.phone ?? order.senderContactPhone,
    senderContactEmail: currentUser?.email ?? order.senderContactEmail,
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
  formDataRef,
}: OrderFormProps) {
  const { user } = useAuth();
  const { companies, locations, products, transportTypes } = useDictionaries();

  const [formData, setFormData] = useState<OrderFormData>(() =>
    buildInitialForm(order, stops, items, user)
  );
  const [pendingStatusCode, setPendingStatusCode] = useState<OrderStatusCode | null>(null);
  const [complaintReason, setComplaintReason] = useState<string | null>(order.complaintReason);

  // Flaga isDirty — ustawiana przy każdym patch(), resetowana przy zmianie zlecenia
  const formDataDirtyRef = useRef(false);
  const originalComplaintReasonRef = useRef<string | null>(order.complaintReason);
  const [isDirty, setIsDirty] = useState(false);

  // Przebuduj formularz gdy order/stops/items się zmienią (np. po przeładowaniu detali)
  useEffect(() => {
    const initial = buildInitialForm(order, stops, items, user);
    originalComplaintReasonRef.current = order.complaintReason;
    setFormData(initial);
    setPendingStatusCode(null);
    setComplaintReason(order.complaintReason);
    formDataDirtyRef.current = false;
    setIsDirty(false);
    onDirtyChange(false); // synchronizuj stan dirty z rodzicem przy resecie formularza
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.updatedAt]); // reset przy zmianie zlecenia LUB po aktualizacji danych

  /** Sprawdza czy formularz ma niezapisane zmiany */
  function computeDirty(
    formDataChanged: boolean,
    status: OrderStatusCode | null,
    cr: string | null,
  ): boolean {
    return formDataChanged || status !== null || cr !== originalComplaintReasonRef.current;
  }

  function patch(update: Partial<OrderFormData>) {
    // Auto-fill dokumentów i waluty przy zmianie typu transportu
    if (update.transportTypeCode) {
      const code = update.transportTypeCode;
      if (code === "PL") {
        update.requiredDocumentsText = "WZ, KPO, kwit wagowy";
        update.currencyCode = "PLN";
      } else if (code === "EXP" || code === "EXP_K" || code === "IMP") {
        update.requiredDocumentsText = "WZE, Aneks VII, CMR";
        update.currencyCode = "EUR";
      }
    }

    // Ustaw flagę i dirty PRZED setFormData — side-effecty nie mogą być w updater function
    // (wywołania setState wewnątrz updater są batched i mogą nie dotrzeć do innych komponentów
    // zanim użytkownik zdąży wywołać handleCloseRequest)
    formDataDirtyRef.current = true;
    const dirty = computeDirty(true, pendingStatusCode, complaintReason);
    setFormData((prev) => ({ ...prev, ...update }));
    setIsDirty(dirty);
    onDirtyChange(dirty);
  }

  // Rejestruj submit ref dla OrderDrawer
  useEffect(() => {
    submitRef.current = () => {
      onSave(formData, pendingStatusCode, complaintReason);
    };
  }, [formData, pendingStatusCode, complaintReason, onSave, submitRef]);

  // Skrót klawiszowy Ctrl+S / Cmd+S — zapis formularza
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isReadOnly) {
          submitRef.current?.();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isReadOnly, submitRef]);

  // Udostępnij aktualny formData przez ref (dla OrderView)
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData, formDataRef]);

  const statusName = STATUS_NAMES[order.statusCode as OrderStatusCode] ?? order.statusCode;

  // Faza 4: Progressive rendering — sekcje 2–6 renderują się po pierwszej ramce,
  // żeby nie blokować main thread przy montowaniu drawera
  const [secondaryReady, setSecondaryReady] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => {
    // Po zamontowaniu pierwszych sekcji (kontakt + trasa), oddaj kontrolę przeglądarce
    // i wyrenderuj pozostałe sekcje w low-priority transition
    const id = requestAnimationFrame(() => {
      startTransition(() => setSecondaryReady(true));
    });
    return () => {
      cancelAnimationFrame(id);
      setSecondaryReady(false);
    };
  }, [order.id]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="py-6 pl-6 pr-8 space-y-8">

        {/* Osoba kontaktowa */}
        <section className="animate-section-in">
          <SectionHeader icon={<User className="w-4 h-4 text-slate-400 dark:text-slate-500" />} title="Osoba kontaktowa" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Imię i nazwisko</Label>
              <Input
                value={formData.senderContactName ?? ""}
                onChange={(e) => patch({ senderContactName: e.target.value || null })}
                disabled={isReadOnly}
                className="h-8 text-sm"
                placeholder="Jan Kowalski"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input
                value={formData.senderContactPhone ?? ""}
                onChange={(e) => patch({ senderContactPhone: e.target.value || null })}
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
                onChange={(e) => patch({ senderContactEmail: e.target.value || null })}
                disabled={isReadOnly}
                className="h-8 text-sm"
                placeholder="kontakt@firma.pl"
              />
            </div>
          </div>
        </section>

        {/* Sekcja 1 – Trasa */}
        <section className="animate-section-in" style={{ animationDelay: "50ms" }}>
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

        {/* Sekcje 2–6: renderowane po pierwszej ramce (progressive rendering) */}
        {secondaryReady && (
          <>
            {/* Sekcja 2 – Towar */}
            <section className="animate-section-in" style={{ animationDelay: "60ms" }}>
              <SectionHeader icon={<Package className="w-4 h-4 text-amber-500" />} title="Sekcja 2: Towar" />
              <CargoSection
                formData={formData}
                products={products}
                isReadOnly={isReadOnly}
                onChange={patch}
              />
            </section>

            {/* Sekcja 3 – Firma transportowa */}
            <section className="animate-section-in" style={{ animationDelay: "120ms" }}>
              <SectionHeader icon={<Truck className="w-4 h-4 text-violet-500" />} title="Sekcja 3: Firma transportowa" />
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 transition-colors">
                <CarrierSection
                  formData={formData}
                  companies={companies}
                  isReadOnly={isReadOnly}
                  onChange={patch}
                />
              </div>
            </section>

            {/* Sekcja 4 – Finanse */}
            <section className="animate-section-in" style={{ animationDelay: "180ms" }}>
              <SectionHeader icon={<Banknote className="w-4 h-4 text-yellow-500" />} title="Sekcja 4: Finanse" />
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-yellow-500/50 transition-colors">
                <FinanceSection
                  formData={formData}
                  isReadOnly={isReadOnly}
                  onChange={patch}
                />
              </div>
            </section>

            {/* Sekcja 5 – Uwagi */}
            <section className="animate-section-in" style={{ animationDelay: "240ms" }}>
              <SectionHeader icon={<MessageSquare className="w-4 h-4 text-slate-400 dark:text-slate-500" />} title="Sekcja 5: Uwagi" />
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400/50 transition-colors">
                <NotesSection
                  formData={formData}
                  isReadOnly={isReadOnly}
                  onChange={patch}
                />
              </div>
            </section>

            {/* Sekcja 6 – Zmiana statusu (tylko edycja) */}
            {!isReadOnly && (
              <section className="animate-section-in" style={{ animationDelay: "300ms" }}>
                <SectionHeader icon={<ArrowLeftRight className="w-4 h-4 text-indigo-500" />} title="Sekcja 6: Zmiana statusu" />
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors">
                  <StatusSection
                    currentStatusCode={order.statusCode}
                    currentStatusName={statusName}
                    pendingStatusCode={pendingStatusCode}
                    complaintReason={complaintReason}
                    isReadOnly={isReadOnly}
                    onStatusChange={(code) => {
                      setPendingStatusCode(code);
                      const dirty = computeDirty(formDataDirtyRef.current, code, complaintReason);
                      setIsDirty(dirty);
                      onDirtyChange(dirty);
                    }}
                    onComplaintReasonChange={(reason) => {
                      setComplaintReason(reason);
                      const dirty = computeDirty(formDataDirtyRef.current, pendingStatusCode, reason);
                      setIsDirty(dirty);
                      onDirtyChange(dirty);
                    }}
                  />
                </div>
              </section>
            )}
          </>
        )}

      </div>
    </ScrollArea>
  );
}

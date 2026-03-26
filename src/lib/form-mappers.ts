/**
 * Wspólny mapper DTO → OrderFormData.
 *
 * Zunifikowana logika używana w:
 * - OrderForm.tsx (otwarcie drawera, budowanie stanu formularza)
 * - useOrderDrawer.ts (budowanie formData do podglądu A4 z detali)
 *
 * Eliminuje duplikację i rozbieżności (legacy code fallback, user override).
 */

import type {
  CurrencyCode,
  OrderFormData,
  OrderFormItem,
  OrderFormStop,
  TransportTypeCode,
} from "@/lib/view-models";
import type { OrderDetailDto, OrderItemDto, OrderStopDto } from "@/types";

// ---------------------------------------------------------------------------
// Legacy transport code fallback (dane seed/historyczne)
// ---------------------------------------------------------------------------

const LEGACY_TRANSPORT_CODE_MAP: Record<string, TransportTypeCode> = {
  KRAJ: "PL",
  MIEDZY: "EXP",
  EKSPRES: "IMP",
};

// ---------------------------------------------------------------------------
// Helpers
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

function resolveTransportCode(raw: string): TransportTypeCode {
  return (LEGACY_TRANSPORT_CODE_MAP[raw] ?? raw as TransportTypeCode) ?? "PL";
}

// ---------------------------------------------------------------------------
// Główny mapper
// ---------------------------------------------------------------------------

interface MapDetailToFormDataOptions {
  order: OrderDetailDto;
  stops: OrderStopDto[];
  items: OrderItemDto[];
  /** Zalogowany użytkownik — nadpisuje dane kontaktowe (senderContact). */
  currentUser?: {
    fullName: string | null;
    phone: string | null;
    email: string;
  } | null;
}

/**
 * Mapuje DTO z API na OrderFormData (stan formularza).
 *
 * Uwzględnia:
 * - Legacy transport code fallback (KRAJ→PL, MIEDZY→EXP, EKSPRES→IMP)
 * - Override danych kontaktowych zalogowanym użytkownikiem (opcjonalnie)
 * - Generowanie _clientKey dla items (React keys)
 */
export function mapDetailToFormData({
  order,
  stops,
  items,
  currentUser,
}: MapDetailToFormDataOptions): OrderFormData {
  return {
    transportTypeCode: resolveTransportCode(order.transportTypeCode),
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
    // Osoba kontaktowa = zalogowany użytkownik (jeśli podany), fallback do danych z DTO
    senderContactName: currentUser?.fullName ?? order.senderContactName,
    senderContactPhone: currentUser?.phone ?? order.senderContactPhone,
    senderContactEmail: currentUser?.email ?? order.senderContactEmail,
    stops: mapStopsToForm(stops),
    items: mapItemsToForm(items),
  };
}

// Order View - Typy i mappery dla podgladu dokumentu A4

import type { CompanyDto, LocationDto, ProductDto } from "@/types";
import type {
  OrderFormData,
  OrderFormStop,
  OrderFormItem,
  CurrencyCode,
  StopKind,
} from "@/lib/view-models";

// ---------------------------------------------------------------------------
// Typy pakowania (widok A4)
// ---------------------------------------------------------------------------

export type PackagingType = "LUZEM" | "BIGBAG" | "PALETA" | "INNA";

// ---------------------------------------------------------------------------
// Modele danych OrderView
// ---------------------------------------------------------------------------

export interface OrderViewItem {
  id: string;
  name: string;
  notes: string;
  packagingType: PackagingType | null;
}

export interface OrderViewStop {
  id: string;
  kind: StopKind;
  sequenceNo: number;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  companyId: string | null;
  companyName: string | null;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  country: string;
  place: string; // fallback display text
}

export interface OrderViewData {
  // Sekcja 1 - Naglowek (readonly)
  orderNo: string;
  createdAt: string; // YYYY-MM-DD

  // Sekcja 4 - Firma transportowa (editable)
  carrierName: string;
  carrierAddress: string;
  carrierNip: string;

  // Sekcja 5 - Pojazd (editable)
  vehicleType: string;
  vehicleVolumeM3: number | null;

  // Sekcja 6 - Towary (editable, dynamiczne wiersze)
  items: OrderViewItem[];

  // Sekcja 7-9 - Punkty trasy (LOADING + UNLOADING z DnD)
  stops: OrderViewStop[];

  // Sekcja 10 - Cena (editable)
  priceAmount: number | null;
  currencyCode: CurrencyCode;
  paymentTermDays: number | null;
  paymentMethod: string | null;

  // Sekcja 11 - Dokumenty (editable)
  documentsText: string;

  // Sekcja 12 - Uwagi (editable, max 500 znakow)
  generalNotes: string;

  // Sekcja 13 - Klauzula poufnosci (editable)
  confidentialityClause: string;

  // Sekcja 14 - Osoba zlecajaca (readonly)
  personName: string;
  personEmail: string;
  personPhone: string;
}

// ---------------------------------------------------------------------------
// Props komponentu OrderView
// ---------------------------------------------------------------------------

export interface OrderViewProps {
  initialData: OrderViewData;
  isReadOnly?: boolean;
  onSave?: (data: OrderViewData) => void;
  onCancel?: () => void;
  onGeneratePdf?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

// ---------------------------------------------------------------------------
// Mapowanie packaging <-> loadingMethodCode (bidirectional)
// ---------------------------------------------------------------------------

const LOADING_TO_PACKAGING: Record<string, PackagingType> = {
  LUZEM: "LUZEM",
  PALETA_BIGBAG: "BIGBAG",
  PALETA: "PALETA",
  KOSZE: "INNA",
};

const PACKAGING_TO_LOADING: Record<PackagingType, string> = {
  LUZEM: "LUZEM",
  BIGBAG: "PALETA_BIGBAG",
  PALETA: "PALETA",
  INNA: "KOSZE",
};

export function mapLoadingMethodToPackaging(
  code: string | null,
): PackagingType | null {
  if (!code) return null;
  return LOADING_TO_PACKAGING[code] ?? null;
}

export function mapPackagingToLoadingMethod(
  packaging: PackagingType | null,
): string | null {
  if (!packaging) return null;
  return PACKAGING_TO_LOADING[packaging] ?? null;
}

// ---------------------------------------------------------------------------
// Helpery adresowe
// ---------------------------------------------------------------------------

/** Szukaj pierwszej aktywnej lokalizacji firmy transportowej */
export function resolveCarrierAddress(
  carrierCompanyId: string | null,
  locations: LocationDto[],
): string {
  if (!carrierCompanyId) return "";
  const loc = locations.find(
    (l) => l.companyId === carrierCompanyId && l.isActive,
  );
  if (!loc) return "";
  return `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`;
}

/** Zbuduj fallback place text ze stopu */
export function buildPlaceFallback(
  stop: OrderFormStop,
  loc: LocationDto | null | undefined,
): string {
  if (loc) {
    return `${loc.companyName ?? ""} ${loc.city} ${loc.postalCode}, ${loc.streetAndNumber}`;
  }
  if (stop.companyNameSnapshot && stop.addressSnapshot) {
    return `${stop.companyNameSnapshot} ${stop.addressSnapshot}`;
  }
  return stop.companyNameSnapshot ?? stop.locationNameSnapshot ?? "";
}

// ---------------------------------------------------------------------------
// Helper: generowanie ID
// ---------------------------------------------------------------------------

function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Forward mapper: formData -> viewData
// ---------------------------------------------------------------------------

function mapItemForward(item: OrderFormItem): OrderViewItem {
  return {
    id: item.id ?? generateId(),
    name: item.productNameSnapshot ?? "",
    notes: item.notes ?? "",
    packagingType: mapLoadingMethodToPackaging(item.loadingMethodCode),
  };
}

function mapStopForward(
  stop: OrderFormStop,
  locations: LocationDto[],
): OrderViewStop {
  const loc = stop.locationId
    ? locations.find((l) => l.id === stop.locationId)
    : null;
  return {
    id: stop.id ?? generateId(),
    kind: stop.kind,
    sequenceNo: stop.sequenceNo,
    date: stop.dateLocal,
    time: stop.timeLocal,
    companyId: loc?.companyId ?? null,
    companyName: stop.companyNameSnapshot ?? loc?.companyName ?? null,
    locationId: stop.locationId,
    locationName: stop.locationNameSnapshot ?? loc?.name ?? null,
    address:
      stop.addressSnapshot ??
      (loc
        ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`
        : null),
    country: loc?.country ?? "",
    place: buildPlaceFallback(stop, loc),
  };
}

export function formDataToViewData(
  formData: OrderFormData,
  orderNo: string,
  createdAt: string,
  personName: string,
  personEmail: string,
  personPhone: string,
  locations: LocationDto[],
  companies: CompanyDto[],
): OrderViewData {
  // Rozwiaz dane firmy transportowej
  const carrier = formData.carrierCompanyId
    ? companies.find((c) => c.id === formData.carrierCompanyId)
    : null;
  const carrierAddr = resolveCarrierAddress(
    formData.carrierCompanyId,
    locations,
  );

  return {
    orderNo,
    createdAt,
    carrierName: carrier?.name ?? "",
    carrierAddress: carrierAddr,
    carrierNip: carrier?.taxId ?? "",
    vehicleType: formData.vehicleTypeText ?? "",
    vehicleVolumeM3: formData.vehicleCapacityVolumeM3,
    items: formData.items
      .filter((i) => !i._deleted)
      .map(mapItemForward),
    stops: formData.stops
      .filter((s) => !s._deleted)
      .map((s) => mapStopForward(s, locations)),
    priceAmount: formData.priceAmount,
    currencyCode: formData.currencyCode,
    paymentTermDays: formData.paymentTermDays,
    paymentMethod: formData.paymentMethod,
    documentsText: formData.requiredDocumentsText ?? "",
    generalNotes: formData.generalNotes ?? "",
    confidentialityClause: formData.confidentialityClause ?? "",
    personName,
    personEmail,
    personPhone,
  };
}

// ---------------------------------------------------------------------------
// Reverse mapper: viewData -> formData (merge z oryginalem)
// ---------------------------------------------------------------------------

function mapItemReverse(
  viewItem: OrderViewItem,
  originalItems: OrderFormItem[],
  products: ProductDto[],
): OrderFormItem {
  const original = originalItems.find((i) => i.id === viewItem.id);
  const product = products.find((p) => p.name === viewItem.name);
  const productChanged =
    original && product && original.productId !== product.id;

  return {
    id: original?.id ?? null,
    productId: product?.id ?? null,
    productNameSnapshot: viewItem.name || null,
    defaultLoadingMethodSnapshot:
      product?.defaultLoadingMethodCode ?? null,
    loadingMethodCode: mapPackagingToLoadingMethod(viewItem.packagingType),
    quantityTons: productChanged ? null : (original?.quantityTons ?? null),
    notes: viewItem.notes || null,
    _deleted: false,
    _clientKey: crypto.randomUUID(),
  };
}

function mapStopReverse(
  viewStop: OrderViewStop,
  originalStops: OrderFormStop[],
  locations: LocationDto[],
): OrderFormStop {
  const original = originalStops.find((s) => s.id === viewStop.id);
  const loc = viewStop.locationId
    ? locations.find((l) => l.id === viewStop.locationId)
    : null;

  return {
    id: original?.id ?? null,
    kind: viewStop.kind,
    sequenceNo: viewStop.sequenceNo,
    dateLocal: viewStop.date,
    timeLocal: viewStop.time,
    locationId: viewStop.locationId,
    locationNameSnapshot: loc?.name ?? viewStop.locationName,
    companyNameSnapshot: loc?.companyName ?? viewStop.companyName,
    addressSnapshot: loc
      ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`
      : viewStop.address,
    notes: original?.notes ?? null,
    _deleted: false,
  };
}

/** Buduj polaczona liste items (istniejace + nowe + usuniete) */
function buildMergedItems(
  viewItems: OrderViewItem[],
  originalItems: OrderFormItem[],
  products: ProductDto[],
): OrderFormItem[] {
  const result: OrderFormItem[] = viewItems.map((vi) =>
    mapItemReverse(vi, originalItems, products),
  );

  // Oznacz usuniete items (byly w oryginale, nie ma w viewData)
  const viewIds = new Set(viewItems.map((vi) => vi.id));
  for (const orig of originalItems) {
    if (orig.id && !viewIds.has(orig.id)) {
      result.push({ ...orig, _deleted: true });
    }
  }

  return result;
}

/** Buduj polaczona liste stops (istniejace + nowe + usuniete) */
function buildMergedStops(
  viewStops: OrderViewStop[],
  originalStops: OrderFormStop[],
  locations: LocationDto[],
): OrderFormStop[] {
  const result: OrderFormStop[] = viewStops.map((vs) =>
    mapStopReverse(vs, originalStops, locations),
  );

  // Oznacz usuniete stops
  const viewIds = new Set(viewStops.map((vs) => vs.id));
  for (const orig of originalStops) {
    if (orig.id && !viewIds.has(orig.id)) {
      result.push({ ...orig, _deleted: true });
    }
  }

  return result;
}

export function viewDataToFormData(
  viewData: OrderViewData,
  originalFormData: OrderFormData,
  locations: LocationDto[],
  companies: CompanyDto[],
  products: ProductDto[],
): OrderFormData {
  const carrier = companies.find((c) => c.name === viewData.carrierName);

  return {
    // Pola zachowane z oryginalu (ukryte w OrderView)
    transportTypeCode: originalFormData.transportTypeCode,
    totalLoadTons: originalFormData.totalLoadTons,
    totalLoadVolumeM3: originalFormData.totalLoadVolumeM3,
    shipperLocationId: originalFormData.shipperLocationId,
    receiverLocationId: originalFormData.receiverLocationId,
    specialRequirements: originalFormData.specialRequirements,
    complaintReason: originalFormData.complaintReason,
    senderContactName: originalFormData.senderContactName,
    senderContactPhone: originalFormData.senderContactPhone,
    senderContactEmail: originalFormData.senderContactEmail,
    notificationDetails: originalFormData.notificationDetails,

    // Pola edytowane w OrderView (konwersja "" -> null dla API)
    carrierCompanyId: carrier?.id ?? originalFormData.carrierCompanyId,
    vehicleTypeText: viewData.vehicleType || null,
    vehicleCapacityVolumeM3: viewData.vehicleVolumeM3,
    priceAmount: viewData.priceAmount,
    currencyCode: viewData.currencyCode,
    paymentTermDays: viewData.paymentTermDays,
    paymentMethod: viewData.paymentMethod || null,
    requiredDocumentsText: viewData.documentsText || null,
    generalNotes: viewData.generalNotes || null,
    confidentialityClause: viewData.confidentialityClause || null,

    // Items
    items: buildMergedItems(
      viewData.items,
      originalFormData.items,
      products,
    ),

    // Stops
    stops: buildMergedStops(
      viewData.stops,
      originalFormData.stops,
      locations,
    ),
  };
}

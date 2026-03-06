/**
 * Typy ViewModel używane po stronie frontendu (React).
 *
 * Typy DTO (komunikacja z API) znajdują się w src/types.ts.
 * Typy ViewModel opisują stan UI i lokalny stan formularzy.
 */

import type {
  CompanyDto,
  LocationDto,
  ProductDto,
  TransportTypeDto,
  OrderStatusDto,
  VehicleVariantDto,
} from "@/types";

// ---------------------------------------------------------------------------
// Enumeracje / unia literałów
// ---------------------------------------------------------------------------

/** Kod statusu zlecenia (odpowiada order_statuses.code w bazie). */
export type OrderStatusCode =
  | "robocze"
  | "wysłane"
  | "korekta"
  | "korekta wysłane"
  | "zrealizowane"
  | "reklamacja"
  | "anulowane";

/** Grupa widoku / zakładka. */
export type ViewGroup = "CURRENT" | "COMPLETED" | "CANCELLED";

/** Kod typu transportu. */
export type TransportTypeCode = "PL" | "EXP" | "EXP_K" | "IMP";

/** Kod waluty. */
export type CurrencyCode = "PLN" | "EUR" | "USD";

/** Typ punktu trasy. */
export type StopKind = "LOADING" | "UNLOADING";

/** Pole sortowania listy zleceń (api-plan 2.2). */
export type OrderSortBy =
  | "FIRST_LOADING_DATETIME"
  | "FIRST_UNLOADING_DATETIME"
  | "ORDER_NO"
  | "CARRIER_NAME";

/** Kierunek sortowania. */
export type SortDirection = "ASC" | "DESC";

/** Zasób synchronizacji słowników ERP. */
export type DictionarySyncResource = "COMPANIES" | "LOCATIONS" | "PRODUCTS";

/** Tryb widoku listy (przełącznik Trasa / Kolumny). */
export type ListViewMode = "route" | "columns";

/** Kod sposobu załadunku. */
export type LoadingMethodCode = "PALETA" | "PALETA_BIGBAG" | "LUZEM" | "KOSZE";

// ---------------------------------------------------------------------------
// Stan filtrów listy zleceń (kolejność pól zgodna z PRD 3.1.2a)
// ---------------------------------------------------------------------------

export interface OrderListFilters {
  view: ViewGroup;
  transportType?: TransportTypeCode;
  /** Kod statusu (order_statuses.code) — filtr po jednym statusie; API przyjmuje tablicę, UI wysyła max 1. */
  status?: string;
  carrierId?: string;
  productId?: string;
  /** UUID lokalizacji załadunku (L1…L8). */
  loadingLocationId?: string;
  /** UUID firmy załadunku (gdy użytkownik wybrał firmę bez konkretnej lokalizacji). */
  loadingCompanyId?: string;
  /** UUID lokalizacji rozładunku (U1…U3). */
  unloadingLocationId?: string;
  /** UUID firmy rozładunku. */
  unloadingCompanyId?: string;
  /** Numer tygodnia (np. "07" lub "2026-07") — wpis ręczny; frontend mapuje na dateFrom/dateTo. */
  weekNumber?: string;
  /** YYYY-MM-DD — obliczany z weekNumber lub ustawiany bezpośrednio. */
  dateFrom?: string;
  /** YYYY-MM-DD. */
  dateTo?: string;
  /** Wyszukiwanie pełnotekstowe. */
  search?: string;
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Stan formularza punktu trasy (drawer)
// ---------------------------------------------------------------------------

export interface OrderFormStop {
  /** null = nowy punkt (jeszcze nie zapisany w bazie). */
  id: string | null;
  kind: StopKind;
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  notes: string | null;
  /** Zaznaczony do usunięcia (dla istniejących punktów). */
  _deleted: boolean;
}

// ---------------------------------------------------------------------------
// Stan formularza pozycji towarowej (drawer)
// ---------------------------------------------------------------------------

export interface OrderFormItem {
  /** null = nowa pozycja. */
  id: string | null;
  productId: string | null;
  productNameSnapshot: string | null;
  /** Snapshot domyślnego sposobu załadunku z produktu (readonly, informacyjny). */
  defaultLoadingMethodSnapshot: string | null;
  /** Aktualny sposób załadunku (nadpisywalny; domyślnie = default z produktu). */
  loadingMethodCode: string | null;
  quantityTons: number | null;
  notes: string | null;
  /** Zaznaczony do usunięcia. */
  _deleted: boolean;
}

// ---------------------------------------------------------------------------
// Dane formularza zlecenia (lokalny stan draweru)
// ---------------------------------------------------------------------------

export interface OrderFormData {
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  priceAmount: number | null;
  paymentTermDays: number | null;
  paymentMethod: string | null;
  totalLoadTons: number | null;
  totalLoadVolumeM3: number | null;
  carrierCompanyId: string | null;
  shipperLocationId: string | null;
  receiverLocationId: string | null;
  vehicleTypeText: string | null;
  vehicleCapacityVolumeM3: number | null;
  specialRequirements: string | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  notificationDetails: string | null;
  confidentialityClause: string | null;
  complaintReason: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  stops: OrderFormStop[];
  items: OrderFormItem[];
}

// ---------------------------------------------------------------------------
// Wpis osi czasu historii (scalony ze status + changes)
// ---------------------------------------------------------------------------

export interface TimelineEntryViewModel {
  id: string;
  type: "status_change" | "field_change" | "order_created";
  changedAt: string;
  changedByUserName: string | null;
  changedByUserId: string;
  /** Dla status_change: */
  oldStatusCode?: string | null;
  newStatusCode?: string | null;
  /** Dla field_change: */
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

// ---------------------------------------------------------------------------
// Stan globalny słowników
// ---------------------------------------------------------------------------

export interface DictionaryState {
  companies: CompanyDto[];
  locations: LocationDto[];
  products: ProductDto[];
  transportTypes: TransportTypeDto[];
  orderStatuses: OrderStatusDto[];
  vehicleVariants: VehicleVariantDto[];
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Stan kontekstowego menu
// ---------------------------------------------------------------------------

export interface ContextMenuState {
  orderId: string | null;
  position: { x: number; y: number };
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// Stałe: dozwolone ręczne przejścia statusów
// ---------------------------------------------------------------------------

/**
 * Matryca dozwolonych ręcznych przejść statusów (PRD 3.1.7, api-plan 2.7).
 *
 * Statusy "wysłane" i "korekta wysłane" ustawiane są automatycznie przez prepare-email
 * i NIE są dostępne jako cel ręcznej zmiany.
 */
export const ALLOWED_MANUAL_STATUS_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  robocze: ["zrealizowane", "anulowane"],
  wysłane: ["zrealizowane", "reklamacja", "anulowane"],
  korekta: ["zrealizowane", "reklamacja", "anulowane"],
  "korekta wysłane": ["zrealizowane", "reklamacja", "anulowane"],
  reklamacja: ["zrealizowane", "anulowane"],
  // Zrealizowane i anulowane — brak ręcznych zmian, tylko "Przywróć do aktualnych"
  zrealizowane: [],
  anulowane: [],
};

// ---------------------------------------------------------------------------
// Domyślne wartości
// ---------------------------------------------------------------------------

export const DEFAULT_FILTERS: OrderListFilters = {
  view: "CURRENT",
  sortBy: "FIRST_LOADING_DATETIME",
  sortDirection: "ASC",
  pageSize: 50,
};

export const DEFAULT_PAGE_SIZES = [50, 100, 200] as const;

// ---------------------------------------------------------------------------
// Mapowanie kodów statusów → nazwy wyświetlane (DRY — M-02, M-03)
// ---------------------------------------------------------------------------

export const STATUS_NAMES: Record<OrderStatusCode, string> = {
  robocze: "Robocze",
  wysłane: "Wysłane",
  korekta: "Korekta",
  "korekta wysłane": "Korekta_w",
  zrealizowane: "Zrealizowane",
  reklamacja: "Reklamacja",
  anulowane: "Anulowane",
};

// ---------------------------------------------------------------------------
// Sprawdzenie aktywnych filtrów (DRY — M-01)
// ---------------------------------------------------------------------------

export function hasActiveFilters(filters: OrderListFilters): boolean {
  return (
    !!filters.transportType ||
    !!filters.status ||
    !!filters.carrierId ||
    !!filters.productId ||
    !!filters.loadingCompanyId ||
    !!filters.loadingLocationId ||
    !!filters.unloadingCompanyId ||
    !!filters.unloadingLocationId ||
    !!filters.weekNumber ||
    !!filters.search
  );
}

import type { Database } from "./db/database.types";

// ============================================================================
// Aliasy typów bazodanowych (Row)
// ============================================================================

type DbTransportOrder = Database["public"]["Tables"]["transport_orders"]["Row"];
type DbOrderStop = Database["public"]["Tables"]["order_stops"]["Row"];
type DbOrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type DbOrderStatus = Database["public"]["Tables"]["order_statuses"]["Row"];
type DbOrderStatusHistory = Database["public"]["Tables"]["order_status_history"]["Row"];
type DbOrderChangeLog = Database["public"]["Tables"]["order_change_log"]["Row"];
type DbCompany = Database["public"]["Tables"]["companies"]["Row"];
type DbLocation = Database["public"]["Tables"]["locations"]["Row"];
type DbProduct = Database["public"]["Tables"]["products"]["Row"];
type DbTransportType = Database["public"]["Tables"]["transport_types"]["Row"];
type DbVehicleVariant = Database["public"]["Tables"]["vehicle_variants"]["Row"];
type DbUserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

// ============================================================================
// Enumeracje
// ============================================================================

/** Kody statusów zleceń (pełne nazwy = kody techniczne) */
export type OrderStatusCode =
  | "robocze"
  | "wysłane"
  | "korekta"
  | "korekta wysłane"
  | "zrealizowane"
  | "reklamacja"
  | "anulowane";

/** Grupy widoków (zakładki) */
export type ViewGroup = "CURRENT" | "COMPLETED" | "CANCELLED";

/** Kody typów transportu */
export type TransportTypeCode = "PL" | "EXP" | "EXP_K" | "IMP";

/** Kody walut */
export type CurrencyCode = "PLN" | "EUR" | "USD";

/** Typ punktu trasy */
export type StopKind = "LOADING" | "UNLOADING";

/** Kolumna sortowania listy zleceń */
export type OrderSortBy =
  | "FIRST_LOADING_DATETIME"
  | "FIRST_UNLOADING_DATETIME"
  | "ORDER_NO"
  | "CARRIER_NAME";

/** Kierunek sortowania */
export type SortDirection = "ASC" | "DESC";

/** Zasoby do synchronizacji słowników */
export type DictionarySyncResource = "COMPANIES" | "LOCATIONS" | "PRODUCTS";

/** Role użytkowników */
export type UserRole = "ADMIN" | "PLANNER" | "READ_ONLY";

// ============================================================================
// Auth DTO (api-plan 2.1)
// ============================================================================

/** GET /api/v1/auth/me — profil zalogowanego użytkownika */
export interface AuthMeDto {
  id: DbUserProfile["id"];
  email: DbUserProfile["email"];
  fullName: DbUserProfile["full_name"];
  phone: DbUserProfile["phone"];
  role: UserRole;
}

// ============================================================================
// Słowniki DTO (api-plan 2.12)
// ============================================================================

/** GET /api/v1/companies */
export interface CompanyDto {
  id: DbCompany["id"];
  name: DbCompany["name"];
  taxId: DbCompany["tax_id"];
  erpId: DbCompany["erp_id"];
  type: DbCompany["type"];
  isActive: DbCompany["is_active"];
  notes: DbCompany["notes"];
}

/** GET /api/v1/locations */
export interface LocationDto {
  id: DbLocation["id"];
  companyId: DbLocation["company_id"];
  name: DbLocation["name"];
  streetAndNumber: DbLocation["street_and_number"];
  postalCode: DbLocation["postal_code"];
  city: DbLocation["city"];
  country: DbLocation["country"];
  erpId: DbLocation["erp_id"];
  isActive: DbLocation["is_active"];
  notes: DbLocation["notes"];
  /** Nazwa firmy dołączona z relacji (join) */
  companyName?: string;
}

/** GET /api/v1/products */
export interface ProductDto {
  id: DbProduct["id"];
  name: DbProduct["name"];
  defaultLoadingMethodCode: DbProduct["default_loading_method_code"];
  description: DbProduct["description"];
  erpId: DbProduct["erp_id"];
  isActive: DbProduct["is_active"];
}

/** GET /api/v1/transport-types */
export interface TransportTypeDto {
  code: DbTransportType["code"];
  name: DbTransportType["name"];
  description: DbTransportType["description"];
  isActive: DbTransportType["is_active"];
}

/** GET /api/v1/order-statuses */
export interface OrderStatusDto {
  code: DbOrderStatus["code"];
  name: DbOrderStatus["name"];
  isEditable: DbOrderStatus["is_editable"];
  sortOrder: DbOrderStatus["sort_order"];
  viewGroup: DbOrderStatus["view_group"];
}

/** GET /api/v1/vehicle-variants (api-plan VehicleVariantDto) */
export interface VehicleVariantDto {
  code: DbVehicleVariant["code"];
  name: DbVehicleVariant["name"];
  vehicleType: DbVehicleVariant["vehicle_type"];
  capacityTons: DbVehicleVariant["capacity_tons"];
  capacityVolumeM3: DbVehicleVariant["capacity_volume_m3"];
  description: DbVehicleVariant["description"];
  isActive: DbVehicleVariant["is_active"];
}

// ============================================================================
// Lista zleceń DTO (api-plan 2.2)
// ============================================================================

/** Uproszczony punkt trasy w odpowiedzi listy (bez id, locationId, addressSnapshot) */
export interface OrderListStopDto {
  kind: StopKind;
  sequenceNo: DbOrderStop["sequence_no"];
  companyNameSnapshot: DbOrderStop["company_name_snapshot"];
  locationNameSnapshot: DbOrderStop["location_name_snapshot"];
  dateLocal: DbOrderStop["date_local"];
  timeLocal: DbOrderStop["time_local"];
}

/** Uproszczona pozycja towarowa w odpowiedzi listy */
export interface OrderListOrderItemDto {
  productNameSnapshot: DbOrderItem["product_name_snapshot"];
  quantityTons: DbOrderItem["quantity_tons"];
  loadingMethodCode: DbOrderItem["loading_method_code"];
  notes: DbOrderItem["notes"];
}

/** Pojedynczy element listy zleceń — GET /api/v1/orders */
export interface OrderListItemDto {
  id: DbTransportOrder["id"];
  orderNo: DbTransportOrder["order_no"];
  statusCode: OrderStatusCode;
  statusName: string;
  viewGroup: ViewGroup;
  transportTypeCode: TransportTypeCode;
  transportTypeName: string;
  summaryRoute: DbTransportOrder["summary_route"];
  stops: OrderListStopDto[];
  firstLoadingDate: DbTransportOrder["first_loading_date"];
  firstLoadingTime: DbTransportOrder["first_loading_time"];
  firstUnloadingDate: DbTransportOrder["first_unloading_date"];
  firstUnloadingTime: DbTransportOrder["first_unloading_time"];
  lastLoadingDate: string | null;
  lastLoadingTime: string | null;
  lastUnloadingDate: string | null;
  lastUnloadingTime: string | null;
  /** Numer tygodnia ISO 8601 — obliczany automatycznie triggerem z firstLoadingDate */
  weekNumber: DbTransportOrder["week_number"];
  carrierCompanyId: DbTransportOrder["carrier_company_id"];
  carrierName: DbTransportOrder["carrier_name_snapshot"];
  mainProductName: string | null;
  items: OrderListOrderItemDto[];
  priceAmount: DbTransportOrder["price_amount"];
  currencyCode: CurrencyCode;
  vehicleVariantCode: DbTransportOrder["vehicle_variant_code"];
  vehicleVariantName: string;
  vehicleCapacityVolumeM3: number | null;
  requiredDocumentsText: DbTransportOrder["required_documents_text"];
  generalNotes: DbTransportOrder["general_notes"];
  sentByUserName: string | null;
  sentAt: DbTransportOrder["sent_at"];
  lockedByUserId: DbTransportOrder["locked_by_user_id"];
  lockedByUserName: string | null;
  lockedAt: DbTransportOrder["locked_at"];
  createdAt: DbTransportOrder["created_at"];
  createdByUserId: DbTransportOrder["created_by_user_id"];
  createdByUserName: string | null;
  updatedAt: DbTransportOrder["updated_at"];
  updatedByUserId: DbTransportOrder["updated_by_user_id"];
  updatedByUserName: string | null;
}

/** Paginowana odpowiedź listy zleceń */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type OrderListResponseDto = PaginatedResponse<OrderListItemDto>;

/** Parametry zapytania GET /api/v1/orders */
export interface OrderListQueryParams {
  view?: ViewGroup;
  status?: string | string[];
  transportType?: TransportTypeCode;
  carrierId?: string;
  productId?: string;
  loadingLocationId?: string;
  loadingCompanyId?: string;
  unloadingLocationId?: string;
  unloadingCompanyId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: OrderSortBy;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Szczegóły zlecenia DTO (api-plan 2.3)
// ============================================================================

/** Pełny punkt trasy — GET /api/v1/orders/{id} */
export interface OrderDetailStopDto {
  id: DbOrderStop["id"];
  kind: StopKind;
  sequenceNo: DbOrderStop["sequence_no"];
  dateLocal: DbOrderStop["date_local"];
  timeLocal: DbOrderStop["time_local"];
  locationId: DbOrderStop["location_id"];
  locationNameSnapshot: DbOrderStop["location_name_snapshot"];
  companyNameSnapshot: DbOrderStop["company_name_snapshot"];
  addressSnapshot: DbOrderStop["address_snapshot"];
  notes: DbOrderStop["notes"];
}

/** Pełna pozycja towarowa — GET /api/v1/orders/{id} */
export interface OrderDetailItemDto {
  id: DbOrderItem["id"];
  productId: DbOrderItem["product_id"];
  productNameSnapshot: DbOrderItem["product_name_snapshot"];
  defaultLoadingMethodSnapshot: DbOrderItem["default_loading_method_snapshot"];
  loadingMethodCode: DbOrderItem["loading_method_code"];
  quantityTons: DbOrderItem["quantity_tons"];
  notes: DbOrderItem["notes"];
}

/** Nagłówek zlecenia — GET /api/v1/orders/{id} */
export interface OrderDetailDto {
  id: DbTransportOrder["id"];
  orderNo: DbTransportOrder["order_no"];
  statusCode: OrderStatusCode;
  statusName: string;
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  priceAmount: DbTransportOrder["price_amount"];
  paymentTermDays: number | null;
  paymentMethod: string | null;
  totalLoadTons: DbTransportOrder["total_load_tons"];
  totalLoadVolumeM3: number | null;
  summaryRoute: DbTransportOrder["summary_route"];
  firstLoadingDate: DbTransportOrder["first_loading_date"];
  firstLoadingTime: DbTransportOrder["first_loading_time"];
  firstUnloadingDate: DbTransportOrder["first_unloading_date"];
  firstUnloadingTime: DbTransportOrder["first_unloading_time"];
  lastLoadingDate: string | null;
  lastLoadingTime: string | null;
  lastUnloadingDate: string | null;
  lastUnloadingTime: string | null;
  weekNumber: DbTransportOrder["week_number"];
  transportYear: DbTransportOrder["transport_year"];
  firstLoadingCountry: DbTransportOrder["first_loading_country"];
  firstUnloadingCountry: DbTransportOrder["first_unloading_country"];
  carrierCompanyId: DbTransportOrder["carrier_company_id"];
  carrierNameSnapshot: DbTransportOrder["carrier_name_snapshot"];
  carrierLocationNameSnapshot: DbTransportOrder["carrier_location_name_snapshot"];
  carrierAddressSnapshot: DbTransportOrder["carrier_address_snapshot"];
  shipperLocationId: DbTransportOrder["shipper_location_id"];
  shipperNameSnapshot: DbTransportOrder["shipper_name_snapshot"];
  shipperAddressSnapshot: DbTransportOrder["shipper_address_snapshot"];
  receiverLocationId: DbTransportOrder["receiver_location_id"];
  receiverNameSnapshot: DbTransportOrder["receiver_name_snapshot"];
  receiverAddressSnapshot: DbTransportOrder["receiver_address_snapshot"];
  vehicleVariantCode: DbTransportOrder["vehicle_variant_code"];
  vehicleCapacityVolumeM3: number | null;
  specialRequirements: string | null;
  requiredDocumentsText: DbTransportOrder["required_documents_text"];
  generalNotes: DbTransportOrder["general_notes"];
  complaintReason: DbTransportOrder["complaint_reason"];
  senderContactName: DbTransportOrder["sender_contact_name"];
  senderContactPhone: DbTransportOrder["sender_contact_phone"];
  senderContactEmail: DbTransportOrder["sender_contact_email"];
  sentByUserId: DbTransportOrder["sent_by_user_id"];
  sentByUserName: string | null;
  sentAt: DbTransportOrder["sent_at"];
  createdAt: DbTransportOrder["created_at"];
  createdByUserId: DbTransportOrder["created_by_user_id"];
  createdByUserName: string | null;
  updatedAt: DbTransportOrder["updated_at"];
  updatedByUserId: DbTransportOrder["updated_by_user_id"];
  updatedByUserName: string | null;
  lockedByUserId: DbTransportOrder["locked_by_user_id"];
  lockedAt: DbTransportOrder["locked_at"];
}

/** Odpowiedź GET /api/v1/orders/{id} — agregat zlecenia */
export interface OrderDetailResponseDto {
  order: OrderDetailDto;
  stops: OrderDetailStopDto[];
  items: OrderDetailItemDto[];
}

// ============================================================================
// Tworzenie zlecenia — Command & Response (api-plan 2.4)
// ============================================================================

/** Punkt trasy przy tworzeniu zlecenia */
export interface CreateOrderStopInput {
  kind: StopKind;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  notes: string | null;
}

/** Pozycja towarowa przy tworzeniu zlecenia */
export interface CreateOrderItemInput {
  productId: string | null;
  productNameSnapshot: string | null;
  loadingMethodCode: string | null;
  quantityTons: number | null;
  notes: string | null;
}

/** POST /api/v1/orders — tworzenie nowego zlecenia */
export interface CreateOrderCommand {
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  carrierCompanyId: string | null;
  shipperLocationId: string | null;
  receiverLocationId: string | null;
  vehicleVariantCode: string;
  priceAmount: number | null;
  paymentTermDays: number | null;
  paymentMethod: string | null;
  totalLoadTons: number | null;
  totalLoadVolumeM3: number | null;
  specialRequirements: string | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  stops: CreateOrderStopInput[];
  items: CreateOrderItemInput[];
}

/** Odpowiedź POST /api/v1/orders */
export interface CreateOrderResponseDto {
  id: string;
  orderNo: string;
  statusCode: OrderStatusCode;
  statusName: string;
  createdAt: string;
}

// ============================================================================
// Aktualizacja zlecenia — Command & Response (api-plan 2.5)
// ============================================================================

/** Punkt trasy przy aktualizacji (z opcjonalnym _deleted i id) */
export interface UpdateOrderStopInput {
  id: string | null;
  kind: StopKind;
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  notes: string | null;
  _deleted: boolean;
}

/** Pozycja towarowa przy aktualizacji (z opcjonalnym _deleted i id) */
export interface UpdateOrderItemInput {
  id: string | null;
  productId: string | null;
  productNameSnapshot: string | null;
  loadingMethodCode: string | null;
  quantityTons: number | null;
  notes: string | null;
  _deleted: boolean;
}

/** PUT /api/v1/orders/{id} — pełna aktualizacja zlecenia */
export interface UpdateOrderCommand {
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
  vehicleVariantCode: string;
  specialRequirements: string | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  complaintReason: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  stops: UpdateOrderStopInput[];
  items: UpdateOrderItemInput[];
}

/** Odpowiedź PUT /api/v1/orders/{id} */
export interface UpdateOrderResponseDto {
  id: string;
  statusCode: OrderStatusCode;
  updatedAt: string;
}

// ============================================================================
// Anulowanie zlecenia — Response (api-plan 2.6)
// ============================================================================

/** Odpowiedź DELETE /api/v1/orders/{id} */
export interface DeleteOrderResponseDto {
  id: string;
  statusCode: OrderStatusCode;
}

// ============================================================================
// Zmiana statusu i przywracanie — Command & Response (api-plan 2.7)
// ============================================================================

/** POST /api/v1/orders/{id}/status */
export interface ChangeStatusCommand {
  newStatusCode: OrderStatusCode;
  complaintReason: string | null;
}

/** Odpowiedź POST /api/v1/orders/{id}/status */
export interface ChangeStatusResponseDto {
  id: string;
  oldStatusCode: OrderStatusCode;
  newStatusCode: OrderStatusCode;
}

/**
 * POST /api/v1/orders/{id}/restore
 * Body puste lub {} — serwer zawsze ustawia status na "korekta"
 */
export type RestoreOrderCommand = Record<string, never>;

/** Odpowiedź POST /api/v1/orders/{id}/restore */
export interface RestoreOrderResponseDto {
  id: string;
  statusCode: OrderStatusCode;
}

// ============================================================================
// Blokada współbieżnej edycji — Response (api-plan 2.8)
// ============================================================================

/** Odpowiedź POST /api/v1/orders/{id}/lock */
export interface LockOrderResponseDto {
  id: string;
  lockedByUserId: string;
  lockedAt: string;
}

/** Odpowiedź POST /api/v1/orders/{id}/unlock */
export interface UnlockOrderResponseDto {
  id: string;
  lockedByUserId: null;
  lockedAt: null;
}

// ============================================================================
// Kopiowanie zlecenia — Command & Response (api-plan 2.9, etap 2)
// ============================================================================

/** POST /api/v1/orders/{id}/duplicate */
export interface DuplicateOrderCommand {
  includeStops: boolean;
  includeItems: boolean;
  resetStatusToDraft: boolean;
}

/** Odpowiedź POST /api/v1/orders/{id}/duplicate */
export interface DuplicateOrderResponseDto {
  id: string;
  orderNo: string;
  statusCode: OrderStatusCode;
  statusName: string;
}

// ============================================================================
// PATCH punktu trasy (api-plan 2.10, opcjonalne)
// ============================================================================

/** PATCH /api/v1/orders/{orderId}/stops/{stopId} — częściowa aktualizacja */
export interface PatchStopCommand {
  dateLocal?: string;
  timeLocal?: string;
  locationId?: string;
  notes?: string;
}

// ============================================================================
// Historia zlecenia DTO (api-plan 2.11)
// ============================================================================

/** GET /api/v1/orders/{id}/history/status */
export interface StatusHistoryItemDto {
  id: DbOrderStatusHistory["id"];
  orderId: DbOrderStatusHistory["order_id"];
  oldStatusCode: DbOrderStatusHistory["old_status_code"];
  newStatusCode: DbOrderStatusHistory["new_status_code"];
  changedAt: DbOrderStatusHistory["changed_at"];
  changedByUserId: DbOrderStatusHistory["changed_by_user_id"];
  changedByUserName: string | null;
}

/** GET /api/v1/orders/{id}/history/changes */
export interface ChangeLogItemDto {
  id: DbOrderChangeLog["id"];
  orderId: DbOrderChangeLog["order_id"];
  fieldName: DbOrderChangeLog["field_name"];
  oldValue: DbOrderChangeLog["old_value"];
  newValue: DbOrderChangeLog["new_value"];
  changedAt: DbOrderChangeLog["changed_at"];
  changedByUserId: DbOrderChangeLog["changed_by_user_id"];
  changedByUserName: string | null;
}

// ============================================================================
// Generowanie PDF — Command (api-plan 2.14)
// ============================================================================

/** POST /api/v1/orders/{id}/pdf */
export interface GeneratePdfCommand {
  regenerate?: boolean;
}

// ============================================================================
// Wspomaganie wysyłki maila — Command & Response (api-plan 2.15)
// ============================================================================

/** POST /api/v1/orders/{id}/prepare-email */
export interface PrepareEmailCommand {
  forceRegeneratePdf?: boolean;
}

/** Odpowiedź POST /api/v1/orders/{id}/prepare-email */
export interface PrepareEmailResponseDto {
  orderId: string;
  statusBefore: OrderStatusCode;
  statusAfter: OrderStatusCode;
  emailOpenUrl: string;
  pdfFileName: string;
}

// ============================================================================
// Synchronizacja słowników — Command & Response (api-plan 2.13)
// ============================================================================

/** POST /api/v1/dictionary-sync/run */
export interface DictionarySyncCommand {
  resources: DictionarySyncResource[];
}

/** Odpowiedź POST /api/v1/dictionary-sync/run */
export interface DictionarySyncResponseDto {
  jobId: string;
  status: string;
}

/** GET /api/v1/dictionary-sync/jobs/{jobId} */
export interface DictionarySyncJobDto {
  jobId: string;
  status: "STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

// ============================================================================
// Odpowiedź listowa (generyczna — dla słowników i historii)
// ============================================================================

/** Generyczna odpowiedź listy (bez paginacji) */
export interface ListResponse<T> {
  items: T[];
}

// ============================================================================
// Odpowiedź błędu API
// ============================================================================

/** Standardowa odpowiedź błędu */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, string | string[]>;
}

// ============================================================================
// Dozwolone przejścia statusów (stała runtime — nie typ)
// ============================================================================

/**
 * Mapowanie dozwolonych ręcznych przejść statusów (api-plan 2.7).
 * Przejścia automatyczne (robocze→wysłane, korekta→korekta wysłane,
 * wysłane/korekta wysłane→korekta) nie są tu zawarte — realizowane przez serwer.
 */
export const ALLOWED_MANUAL_STATUS_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  "robocze": ["zrealizowane", "anulowane"],
  "wysłane": ["zrealizowane", "reklamacja", "anulowane"],
  "korekta": ["zrealizowane", "anulowane"],
  "korekta wysłane": ["zrealizowane", "reklamacja", "anulowane"],
  "reklamacja": ["zrealizowane", "anulowane"],
  "zrealizowane": [],
  "anulowane": [],
};

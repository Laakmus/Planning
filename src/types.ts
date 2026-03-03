/**
 * Typy DTO i Command używane w REST API (api/v1).
 * Zgodne z .ai/api-plan.md i .ai/view-implementation-plan.md.
 */

/** Rola użytkownika w systemie (user_profiles.role). */
export type UserRole = "ADMIN" | "PLANNER" | "READ_ONLY";

/**
 * Profil zalogowanego użytkownika — odpowiedź GET /api/v1/auth/me.
 * Pola w camelCase dla API.
 */
export interface AuthMeDto {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
}

/** Odpowiedź paginowana (lista zleceń, itp.). */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Uproszczony punkt trasy w liście zleceń (GET /api/v1/orders). */
export interface OrderListStopDto {
  kind: string;
  sequenceNo: number;
  companyNameSnapshot: string | null;
  locationNameSnapshot: string | null;
  dateLocal: string | null;
  timeLocal: string | null;
}

/** Uproszczona pozycja towarowa w liście zleceń (GET /api/v1/orders). */
export interface OrderListItemInnerDto {
  productNameSnapshot: string | null;
  quantityTons: number | null;
  loadingMethodCode: string | null;
  notes: string | null;
}

/**
 * Jedna pozycja listy zleceń — GET /api/v1/orders.
 * Pola w camelCase dla API.
 */
export interface OrderListItemDto {
  id: string;
  orderNo: string;
  statusCode: string;
  statusName: string;
  viewGroup: string;
  transportTypeCode: string;
  transportTypeName: string;
  summaryRoute: string | null;
  stops: OrderListStopDto[];
  firstLoadingDate: string | null;
  firstLoadingTime: string | null;
  firstUnloadingDate: string | null;
  firstUnloadingTime: string | null;
  lastLoadingDate: string | null;
  lastLoadingTime: string | null;
  lastUnloadingDate: string | null;
  lastUnloadingTime: string | null;
  weekNumber: number | null;
  carrierCompanyId: string | null;
  carrierName: string | null;
  mainProductName: string | null;
  items: OrderListItemInnerDto[];
  priceAmount: number | null;
  currencyCode: string;
  vehicleTypeText: string | null;
  vehicleCapacityVolumeM3: number | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  sentByUserName: string | null;
  sentAt: string | null;
  lockedByUserId: string | null;
  lockedByUserName: string | null;
  lockedAt: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string | null;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByUserName: string | null;
  carrierCellColor: string | null;
  isEntryFixed: boolean | null;
}

/** Odpowiedź PATCH /api/v1/orders/{orderId}/entry-fixed. */
export interface EntryFixedResponseDto {
  id: string;
  isEntryFixed: boolean | null;
}

/** Odpowiedź PATCH /api/v1/orders/{orderId}/carrier-color. */
export interface CarrierColorResponseDto {
  id: string;
  carrierCellColor: string | null;
}

/** Odpowiedź GET /api/v1/orders. */
export type OrderListResponseDto = PaginatedResponse<OrderListItemDto>;

/** Odpowiedź lista (bez paginacji) — np. historia statusów, log zmian, słowniki. */
export interface ListResponse<T> {
  items: T[];
}

/** Element listy firm — GET /api/v1/companies. */
export interface CompanyDto {
  id: string;
  name: string;
  isActive: boolean;
  erpId: string | null;
  taxId: string | null;
  type: string | null;
  notes: string | null;
}

/** Element listy lokalizacji — GET /api/v1/locations (z companyName z join). */
export interface LocationDto {
  id: string;
  name: string;
  companyId: string;
  companyName: string | null;
  city: string;
  country: string;
  streetAndNumber: string;
  postalCode: string;
  isActive: boolean;
  notes: string | null;
}

/** Element listy produktów — GET /api/v1/products. */
export interface ProductDto {
  id: string;
  name: string;
  isActive: boolean;
  description: string | null;
  defaultLoadingMethodCode: string;
}

/** Element listy typów transportu — GET /api/v1/transport-types. */
export interface TransportTypeDto {
  code: string;
  name: string;
  isActive: boolean;
  description: string | null;
}

/** Element listy statusów zleceń — GET /api/v1/order-statuses. */
export interface OrderStatusDto {
  code: string;
  name: string;
  sortOrder: number | null;
  viewGroup: string;
  isEditable: boolean;
}

/** Element listy wariantów pojazdów — GET /api/v1/vehicle-variants. */
export interface VehicleVariantDto {
  code: string;
  name: string;
  isActive: boolean;
  capacityTons: number;
  capacityVolumeM3: number | null;
  vehicleType: string;
  description: string | null;
}

/** Jedna pozycja historii statusów — GET /api/v1/orders/{id}/history/status. */
export interface StatusHistoryItemDto {
  id: number;
  orderId: string;
  oldStatusCode: string;
  newStatusCode: string;
  changedAt: string;
  changedByUserId: string;
  changedByUserName: string | null;
}

/** Jedna pozycja logu zmian — GET /api/v1/orders/{id}/history/changes. */
export interface ChangeLogItemDto {
  id: number;
  orderId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedByUserId: string;
  changedByUserName: string | null;
}

/**
 * Nagłówek zlecenia w widoku szczegółowym — GET /api/v1/orders/{orderId}.
 * Pola zgodne z transport_orders (camelCase).
 */
export interface OrderDetailDto {
  id: string;
  orderNo: string;
  statusCode: string;
  transportTypeCode: string;
  currencyCode: string;
  priceAmount: number | null;
  paymentTermDays: number | null;
  paymentMethod: string | null;
  totalLoadTons: number | null;
  totalLoadVolumeM3: number | null;
  summaryRoute: string | null;
  firstLoadingDate: string | null;
  firstLoadingTime: string | null;
  firstUnloadingDate: string | null;
  firstUnloadingTime: string | null;
  lastLoadingDate: string | null;
  lastLoadingTime: string | null;
  lastUnloadingDate: string | null;
  lastUnloadingTime: string | null;
  transportYear: number | null;
  firstLoadingCountry: string | null;
  firstUnloadingCountry: string | null;
  carrierCompanyId: string | null;
  carrierNameSnapshot: string | null;
  carrierLocationNameSnapshot: string | null;
  carrierAddressSnapshot: string | null;
  shipperLocationId: string | null;
  shipperNameSnapshot: string | null;
  shipperAddressSnapshot: string | null;
  receiverLocationId: string | null;
  receiverNameSnapshot: string | null;
  receiverAddressSnapshot: string | null;
  vehicleTypeText: string | null;
  vehicleCapacityVolumeM3: number | null;
  mainProductName: string | null;
  specialRequirements: string | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  notificationDetails: string | null;
  confidentialityClause: string | null;
  complaintReason: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string | null;
  lockedByUserId: string | null;
  lockedAt: string | null;
  // Pola dodatkowe z JOINów (api-plan §2.3)
  statusName: string;
  weekNumber: number | null;
  sentAt: string | null;
  sentByUserName: string | null;
  createdByUserName: string | null;
  updatedByUserName: string | null;
  lockedByUserName: string | null;
}

/** Punkt trasy w widoku szczegółowym zlecenia. */
export interface OrderStopDto {
  id: string;
  kind: string;
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  notes: string | null;
}

/** Pozycja towarowa w widoku szczegółowym zlecenia. */
export interface OrderItemDto {
  id: string;
  productId: string | null;
  productNameSnapshot: string | null;
  defaultLoadingMethodSnapshot: string | null;
  loadingMethodCode: string | null;
  quantityTons: number | null;
  notes: string | null;
}

/** Odpowiedź GET /api/v1/orders/{orderId}. */
export interface OrderDetailResponseDto {
  order: OrderDetailDto;
  stops: OrderStopDto[];
  items: OrderItemDto[];
}

/** Odpowiedź DELETE /api/v1/orders/{orderId} (anulowanie). */
export interface DeleteOrderResponseDto {
  id: string;
  statusCode: string;
}

/** Odpowiedź POST /api/v1/orders/{orderId}/status (zmiana statusu). */
export interface ChangeStatusResponseDto {
  id: string;
  oldStatusCode: string;
  newStatusCode: string;
}

/** Odpowiedź POST /api/v1/orders (tworzenie zlecenia). */
export interface CreateOrderResponseDto {
  id: string;
  orderNo: string;
  statusCode: string;
  statusName: string;
  createdAt: string;
}

/** Odpowiedź PUT /api/v1/orders/{orderId} (pełna aktualizacja zlecenia). */
export interface UpdateOrderResponseDto {
  id: string;
  orderNo: string;
  statusCode: string;
  updatedAt: string;
}

/** Odpowiedź POST /api/v1/orders/{orderId}/restore. */
export interface RestoreOrderResponseDto {
  id: string;
  statusCode: string;
}

/** Odpowiedź POST /api/v1/orders/{orderId}/lock. */
export interface LockOrderResponseDto {
  id: string;
  lockedByUserId: string;
  lockedAt: string;
}

/** Odpowiedź POST /api/v1/orders/{orderId}/unlock. */
export interface UnlockOrderResponseDto {
  id: string;
  lockedByUserId: string | null;
  lockedAt: string | null;
}

/** Body POST /api/v1/orders/{orderId}/prepare-email. */
export interface PrepareEmailCommand {
  forceRegeneratePdf?: boolean;
}

/** Odpowiedź POST /api/v1/orders/{orderId}/prepare-email. */
export interface PrepareEmailResponseDto {
  orderId: string;
  statusBefore: string;
  statusAfter: string;
  emailOpenUrl: string;
  pdfFileName: string | null;
}

/** Odpowiedź POST /api/v1/orders/{orderId}/duplicate (kopia zlecenia). */
export interface DuplicateOrderResponseDto {
  id: string;
  orderNo: string;
  statusCode: string;
  statusName: string;
  createdAt: string;
}

/** Body POST /api/v1/orders/{orderId}/pdf. */
export interface GeneratePdfCommand {
  regenerate?: boolean;
}

/** Body PATCH /api/v1/orders/{orderId}/stops/{stopId} — częściowa edycja (wszystkie pola opcjonalne). */
export interface PatchStopCommand {
  kind?: string;
  dateLocal?: string | null;
  timeLocal?: string | null;
  locationId?: string | null;
  notes?: string | null;
}

/** Odpowiedź PATCH /api/v1/orders/{orderId}/stops/{stopId}. */
export interface PatchStopResponseDto {
  id: string;
  orderId: string;
  kind: string;
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  notes: string | null;
}

/** Body POST /api/v1/dictionary-sync/run. */
export interface DictionarySyncCommand {
  resources: Array<"COMPANIES" | "LOCATIONS" | "PRODUCTS">;
}

/** Odpowiedź POST /api/v1/dictionary-sync/run. */
export interface DictionarySyncResponseDto {
  jobId: string;
  status: string;
}

/** Odpowiedź GET /api/v1/dictionary-sync/jobs/{jobId}. */
export interface DictionarySyncJobDto {
  jobId: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

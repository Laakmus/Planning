import type { Database } from "./db/database.types";

// ============================================================================
// Base entity row types extracted from the database schema
// ============================================================================

type Tables = Database["public"]["Tables"];

type TransportOrderRow = Tables["transport_orders"]["Row"];
type OrderStopRow = Tables["order_stops"]["Row"];
type OrderItemRow = Tables["order_items"]["Row"];
type OrderStatusRow = Tables["order_statuses"]["Row"];
type OrderStatusHistoryRow = Tables["order_status_history"]["Row"];
type OrderChangeLogRow = Tables["order_change_log"]["Row"];
type CompanyRow = Tables["companies"]["Row"];
type LocationRow = Tables["locations"]["Row"];
type ProductRow = Tables["products"]["Row"];
type TransportTypeRow = Tables["transport_types"]["Row"];
type VehicleVariantRow = Tables["vehicle_variants"]["Row"];
type UserProfileRow = Tables["user_profiles"]["Row"];

// ============================================================================
// Shared enums / union types
// ============================================================================

/** Status codes as used in `order_statuses.code` */
export type OrderStatusCode = "ROB" | "WYS" | "KOR" | "KOR_WYS" | "ZRE" | "ANL" | "REK";

/** View group tabs */
export type ViewGroup = "CURRENT" | "COMPLETED" | "CANCELLED";

/** Transport type codes */
export type TransportTypeCode = "PL" | "EXP" | "EXP_K" | "IMP";

/** Allowed currency codes */
export type CurrencyCode = "PLN" | "EUR" | "USD";

/** Stop kind */
export type StopKind = "LOADING" | "UNLOADING";

/** User role */
export type UserRole = "ADMIN" | "PLANNER" | "READ_ONLY";

/** Sort field options for order list */
export type OrderSortBy =
  | "FIRST_LOADING_DATETIME"
  | "FIRST_UNLOADING_DATETIME"
  | "ORDER_NO"
  | "CARRIER_NAME";

/** Sort direction */
export type SortDirection = "ASC" | "DESC";

/** Dictionary resource types for ERP sync */
export type DictionarySyncResource = "COMPANIES" | "LOCATIONS" | "PRODUCTS";

// ============================================================================
// 1. Auth – GET /api/v1/auth/me
// ============================================================================

/** Response DTO for the current authenticated user. Maps to `user_profiles`. */
export type AuthMeDto = Pick<UserProfileRow, "id" | "email" | "phone"> & {
  fullName: UserProfileRow["full_name"];
  role: UserRole;
};

// ============================================================================
// 2. Generic response wrappers
// ============================================================================

/** Paginated list response used by GET /orders */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Simple list response used by dictionary endpoints */
export interface ListResponse<T> {
  items: T[];
}

// ============================================================================
// 3. Orders – list: GET /api/v1/orders
// ============================================================================

/** Query parameters for GET /orders */
export interface OrderListQueryParams {
  view?: ViewGroup;
  status?: OrderStatusCode | OrderStatusCode[];
  transportType?: TransportTypeCode;
  carrierId?: string;
  productId?: string;
  loadingLocationId?: string;
  unloadingLocationId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: OrderSortBy;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
}

/**
 * Single row in the orders list view.
 * Combines fields from `transport_orders` with resolved display names
 * from related tables (statuses, transport types, users, first order item).
 */
export interface OrderListItemDto {
  /** transport_orders.id */
  id: TransportOrderRow["id"];
  orderNo: TransportOrderRow["order_no"];
  statusCode: OrderStatusCode;
  /** Resolved from order_statuses.name */
  statusName: string;
  /** Resolved from order_statuses.view_group */
  viewGroup: ViewGroup;
  transportTypeCode: TransportOrderRow["transport_type_code"];
  /** Resolved from transport_types.name */
  transportTypeName: string;
  summaryRoute: TransportOrderRow["summary_route"];
  firstLoadingDate: TransportOrderRow["first_loading_date"];
  firstLoadingTime: TransportOrderRow["first_loading_time"];
  firstUnloadingDate: TransportOrderRow["first_unloading_date"];
  firstUnloadingTime: TransportOrderRow["first_unloading_time"];
  /** Denormalized from order_stops – last loading stop */
  lastLoadingDate: string | null;
  lastLoadingTime: string | null;
  /** Denormalized from order_stops – last unloading stop */
  lastUnloadingDate: string | null;
  lastUnloadingTime: string | null;
  carrierCompanyId: TransportOrderRow["carrier_company_id"];
  /** Resolved from carrier snapshot or companies.name */
  carrierName: TransportOrderRow["carrier_name_snapshot"];
  /** Resolved from the first order_items.product_name_snapshot */
  mainProductName: string | null;
  priceAmount: TransportOrderRow["price_amount"];
  currencyCode: CurrencyCode;
  vehicleVariantCode: TransportOrderRow["vehicle_variant_code"];
  /** Resolved from vehicle_variants.name */
  vehicleVariantName: string;
  requiredDocumentsText: TransportOrderRow["required_documents_text"];
  generalNotes: TransportOrderRow["general_notes"];
  lockedByUserId: TransportOrderRow["locked_by_user_id"];
  /** Resolved from user_profiles.full_name */
  lockedByUserName: string | null;
  lockedAt: TransportOrderRow["locked_at"];
  createdAt: TransportOrderRow["created_at"];
  createdByUserId: TransportOrderRow["created_by_user_id"];
  /** Resolved from user_profiles.full_name */
  createdByUserName: string | null;
  updatedAt: TransportOrderRow["updated_at"];
  updatedByUserId: TransportOrderRow["updated_by_user_id"];
  /** Resolved from user_profiles.full_name */
  updatedByUserName: string | null;
}

export type OrderListResponseDto = PaginatedResponse<OrderListItemDto>;

// ============================================================================
// 4. Orders – detail: GET /api/v1/orders/{orderId}
// ============================================================================

/** Order header in the detail view. Extends transport_orders with camelCase mapping. */
export interface OrderDetailDto {
  id: TransportOrderRow["id"];
  orderNo: TransportOrderRow["order_no"];
  statusCode: OrderStatusCode;
  transportTypeCode: TransportOrderRow["transport_type_code"];
  currencyCode: CurrencyCode;
  priceAmount: TransportOrderRow["price_amount"];
  /** Not in DB yet – reserved for future column `payment_term_days` */
  paymentTermDays: number | null;
  /** Not in DB yet – reserved for future column `payment_method` */
  paymentMethod: string | null;
  totalLoadTons: TransportOrderRow["total_load_tons"];
  /** Not in DB yet – reserved for future column `total_load_volume_m3` */
  totalLoadVolumeM3: number | null;
  summaryRoute: TransportOrderRow["summary_route"];
  firstLoadingDate: TransportOrderRow["first_loading_date"];
  firstLoadingTime: TransportOrderRow["first_loading_time"];
  firstUnloadingDate: TransportOrderRow["first_unloading_date"];
  firstUnloadingTime: TransportOrderRow["first_unloading_time"];
  lastLoadingDate: string | null;
  lastLoadingTime: string | null;
  lastUnloadingDate: string | null;
  lastUnloadingTime: string | null;
  transportYear: TransportOrderRow["transport_year"];
  firstLoadingCountry: TransportOrderRow["first_loading_country"];
  firstUnloadingCountry: TransportOrderRow["first_unloading_country"];
  carrierCompanyId: TransportOrderRow["carrier_company_id"];
  carrierNameSnapshot: TransportOrderRow["carrier_name_snapshot"];
  carrierLocationNameSnapshot: TransportOrderRow["carrier_location_name_snapshot"];
  carrierAddressSnapshot: TransportOrderRow["carrier_address_snapshot"];
  shipperLocationId: TransportOrderRow["shipper_location_id"];
  shipperNameSnapshot: TransportOrderRow["shipper_name_snapshot"];
  shipperAddressSnapshot: TransportOrderRow["shipper_address_snapshot"];
  receiverLocationId: TransportOrderRow["receiver_location_id"];
  receiverNameSnapshot: TransportOrderRow["receiver_name_snapshot"];
  receiverAddressSnapshot: TransportOrderRow["receiver_address_snapshot"];
  vehicleVariantCode: TransportOrderRow["vehicle_variant_code"];
  /** Not in DB yet – reserved for future column `special_requirements` */
  specialRequirements: string | null;
  requiredDocumentsText: TransportOrderRow["required_documents_text"];
  generalNotes: TransportOrderRow["general_notes"];
  complaintReason: TransportOrderRow["complaint_reason"];
  senderContactName: TransportOrderRow["sender_contact_name"];
  senderContactPhone: TransportOrderRow["sender_contact_phone"];
  senderContactEmail: TransportOrderRow["sender_contact_email"];
  createdAt: TransportOrderRow["created_at"];
  createdByUserId: TransportOrderRow["created_by_user_id"];
  updatedAt: TransportOrderRow["updated_at"];
  updatedByUserId: TransportOrderRow["updated_by_user_id"];
  lockedByUserId: TransportOrderRow["locked_by_user_id"];
  lockedAt: TransportOrderRow["locked_at"];
}

/** Single stop in the detail view. Maps directly to `order_stops`. */
export interface OrderDetailStopDto {
  id: OrderStopRow["id"];
  kind: StopKind;
  sequenceNo: OrderStopRow["sequence_no"];
  dateLocal: OrderStopRow["date_local"];
  timeLocal: OrderStopRow["time_local"];
  locationId: OrderStopRow["location_id"];
  locationNameSnapshot: OrderStopRow["location_name_snapshot"];
  companyNameSnapshot: OrderStopRow["company_name_snapshot"];
  addressSnapshot: OrderStopRow["address_snapshot"];
  notes: OrderStopRow["notes"];
}

/** Single item in the detail view. Maps directly to `order_items`. */
export interface OrderDetailItemDto {
  id: OrderItemRow["id"];
  productId: OrderItemRow["product_id"];
  productNameSnapshot: OrderItemRow["product_name_snapshot"];
  defaultLoadingMethodSnapshot: OrderItemRow["default_loading_method_snapshot"];
  quantityTons: OrderItemRow["quantity_tons"];
  notes: OrderItemRow["notes"];
}

/** Aggregate response for GET /orders/{orderId} */
export interface OrderDetailResponseDto {
  order: OrderDetailDto;
  stops: OrderDetailStopDto[];
  items: OrderDetailItemDto[];
}

// ============================================================================
// 5. Orders – create: POST /api/v1/orders
// ============================================================================

/** Input for a single stop when creating an order */
export interface CreateOrderStopInput {
  kind: StopKind;
  dateLocal?: string | null;
  timeLocal?: string | null;
  locationId?: string | null;
  notes?: string | null;
}

/** Input for a single item when creating an order */
export interface CreateOrderItemInput {
  productId?: string | null;
  productNameSnapshot?: string | null;
  quantityTons?: number | null;
  notes?: string | null;
}

/**
 * Command model for creating a new transport order (draft).
 * Fields map to `transport_orders` Insert type; server sets `order_no`,
 * `status_code`, `created_by_user_id`, timestamps, and snapshots.
 */
export interface CreateOrderCommand {
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  carrierCompanyId?: string | null;
  shipperLocationId?: string | null;
  receiverLocationId?: string | null;
  vehicleVariantCode: string;
  priceAmount?: number | null;
  paymentTermDays?: number | null;
  paymentMethod?: string | null;
  totalLoadTons?: number | null;
  totalLoadVolumeM3?: number | null;
  specialRequirements?: string | null;
  requiredDocumentsText?: string | null;
  generalNotes?: string | null;
  senderContactName?: string | null;
  senderContactPhone?: string | null;
  senderContactEmail?: string | null;
  stops?: CreateOrderStopInput[];
  items?: CreateOrderItemInput[];
}

/** Response after successfully creating a draft order */
export interface CreateOrderResponseDto {
  id: TransportOrderRow["id"];
  orderNo: TransportOrderRow["order_no"];
  statusCode: "ROB";
  createdAt: TransportOrderRow["created_at"];
}

// ============================================================================
// 6. Orders – update: PUT /api/v1/orders/{orderId}
// ============================================================================

/**
 * Input for a stop in the update payload.
 * - `id: null` → new stop (server creates)
 * - `id: uuid` + `_deleted: true` → server deletes this stop
 * - `id: uuid` + `_deleted: false/undefined` → update existing
 */
export interface UpdateOrderStopInput {
  id?: string | null;
  kind: StopKind;
  sequenceNo: number;
  dateLocal?: string | null;
  timeLocal?: string | null;
  locationId?: string | null;
  notes?: string | null;
  _deleted?: boolean;
}

/**
 * Input for an item in the update payload.
 * Uses the same `id` / `_deleted` convention as stops.
 */
export interface UpdateOrderItemInput {
  id?: string | null;
  productId?: string | null;
  productNameSnapshot?: string | null;
  quantityTons?: number | null;
  notes?: string | null;
  _deleted?: boolean;
}

/**
 * Command model for full order update (PUT).
 * Status is NOT changed by this endpoint – automatic WYS/KOR_WYS → KOR
 * transition is handled server-side when business fields change.
 */
export interface UpdateOrderCommand {
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  priceAmount?: number | null;
  paymentTermDays?: number | null;
  paymentMethod?: string | null;
  totalLoadTons?: number | null;
  totalLoadVolumeM3?: number | null;
  carrierCompanyId?: string | null;
  shipperLocationId?: string | null;
  receiverLocationId?: string | null;
  vehicleVariantCode: string;
  specialRequirements?: string | null;
  requiredDocumentsText?: string | null;
  generalNotes?: string | null;
  complaintReason?: string | null;
  senderContactName?: string | null;
  senderContactPhone?: string | null;
  senderContactEmail?: string | null;
  stops?: UpdateOrderStopInput[];
  items?: UpdateOrderItemInput[];
}

/** Response after successfully updating an order */
export interface UpdateOrderResponseDto {
  id: TransportOrderRow["id"];
  statusCode: OrderStatusCode;
  updatedAt: TransportOrderRow["updated_at"];
}

// ============================================================================
// 7. Orders – delete (cancel): DELETE /api/v1/orders/{orderId}
// ============================================================================

export interface DeleteOrderResponseDto {
  id: TransportOrderRow["id"];
  statusCode: "ANL";
}

// ============================================================================
// 8. Orders – status change: POST /api/v1/orders/{orderId}/status
// ============================================================================

/** Command model for manual status change */
export interface ChangeStatusCommand {
  newStatusCode: "ROB" | "ZRE" | "REK" | "ANL";
  /** Required when newStatusCode is "REK" */
  complaintReason?: string | null;
}

export interface ChangeStatusResponseDto {
  id: TransportOrderRow["id"];
  oldStatusCode: OrderStatusCode;
  newStatusCode: OrderStatusCode;
}

// ============================================================================
// 9. Orders – restore: POST /api/v1/orders/{orderId}/restore
// ============================================================================

/** Command model for restoring an order from COMPLETED or CANCELLED tab */
export interface RestoreOrderCommand {
  targetStatusCode: "ROB" | "WYS";
}

// ============================================================================
// 10. Orders – lock/unlock: POST /api/v1/orders/{orderId}/lock | unlock
// ============================================================================

export interface LockOrderResponseDto {
  id: TransportOrderRow["id"];
  lockedByUserId: string;
  lockedAt: string;
}

export interface UnlockOrderResponseDto {
  id: TransportOrderRow["id"];
  lockedByUserId: null;
  lockedAt: null;
}

// ============================================================================
// 11. Orders – duplicate: POST /api/v1/orders/{orderId}/duplicate
// ============================================================================

export interface DuplicateOrderCommand {
  includeStops?: boolean;
  includeItems?: boolean;
  resetStatusToDraft?: boolean;
}

export interface DuplicateOrderResponseDto {
  id: TransportOrderRow["id"];
  orderNo: TransportOrderRow["order_no"];
  statusCode: "ROB";
}

// ============================================================================
// 12. Stops – partial update: PATCH /api/v1/orders/{orderId}/stops/{stopId}
// ============================================================================

/** Partial update for a single stop */
export interface PatchStopCommand {
  dateLocal?: string;
  timeLocal?: string;
  locationId?: string;
  notes?: string;
}

// ============================================================================
// 13. History – GET /api/v1/orders/{orderId}/history/status
// ============================================================================

/** Single entry in the status history timeline. Maps to `order_status_history`. */
export interface StatusHistoryItemDto {
  id: OrderStatusHistoryRow["id"];
  oldStatusCode: OrderStatusHistoryRow["old_status_code"];
  newStatusCode: OrderStatusHistoryRow["new_status_code"];
  changedAt: OrderStatusHistoryRow["changed_at"];
  changedByUserId: OrderStatusHistoryRow["changed_by_user_id"];
  /** Resolved from user_profiles.full_name */
  changedByUserName: string | null;
}

// ============================================================================
// 14. History – GET /api/v1/orders/{orderId}/history/changes
// ============================================================================

/** Single entry in the field change log. Maps to `order_change_log`. */
export interface ChangeLogItemDto {
  id: OrderChangeLogRow["id"];
  fieldName: OrderChangeLogRow["field_name"];
  oldValue: OrderChangeLogRow["old_value"];
  newValue: OrderChangeLogRow["new_value"];
  changedAt: OrderChangeLogRow["changed_at"];
  changedByUserId: OrderChangeLogRow["changed_by_user_id"];
  /** Resolved from user_profiles.full_name */
  changedByUserName: string | null;
}

// ============================================================================
// 15. Dictionaries – GET endpoints
// ============================================================================

/** GET /api/v1/companies – company autocomplete DTO */
export interface CompanyDto {
  id: CompanyRow["id"];
  name: CompanyRow["name"];
  taxId: CompanyRow["tax_id"];
  erpId: CompanyRow["erp_id"];
  type: CompanyRow["type"];
  isActive: CompanyRow["is_active"];
  notes: CompanyRow["notes"];
}

/** GET /api/v1/locations – location autocomplete DTO */
export interface LocationDto {
  id: LocationRow["id"];
  name: LocationRow["name"];
  companyId: LocationRow["company_id"];
  streetAndNumber: LocationRow["street_and_number"];
  city: LocationRow["city"];
  postalCode: LocationRow["postal_code"];
  country: LocationRow["country"];
  erpId: LocationRow["erp_id"];
  isActive: LocationRow["is_active"];
  notes: LocationRow["notes"];
}

/** GET /api/v1/products – product autocomplete DTO */
export interface ProductDto {
  id: ProductRow["id"];
  name: ProductRow["name"];
  description: ProductRow["description"];
  erpId: ProductRow["erp_id"];
  defaultLoadingMethodCode: ProductRow["default_loading_method_code"];
  isActive: ProductRow["is_active"];
}

/** GET /api/v1/transport-types */
export interface TransportTypeDto {
  code: TransportTypeRow["code"];
  name: TransportTypeRow["name"];
  description: TransportTypeRow["description"];
  isActive: TransportTypeRow["is_active"];
}

/** GET /api/v1/order-statuses */
export interface OrderStatusDto {
  code: OrderStatusRow["code"];
  name: OrderStatusRow["name"];
  viewGroup: OrderStatusRow["view_group"];
  isEditable: OrderStatusRow["is_editable"];
  sortOrder: OrderStatusRow["sort_order"];
}

/** GET /api/v1/vehicle-variants */
export interface VehicleVariantDto {
  code: VehicleVariantRow["code"];
  name: VehicleVariantRow["name"];
  description: VehicleVariantRow["description"];
  vehicleType: VehicleVariantRow["vehicle_type"];
  capacityTons: VehicleVariantRow["capacity_tons"];
  isActive: VehicleVariantRow["is_active"];
}

// ============================================================================
// 16. Dictionary sync – POST /api/v1/dictionary-sync/run
// ============================================================================

export interface DictionarySyncCommand {
  resources: DictionarySyncResource[];
}

export interface DictionarySyncResponseDto {
  jobId: string;
  status: "STARTED";
}

export interface DictionarySyncJobDto {
  jobId: string;
  status: "STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

// ============================================================================
// 17. PDF – POST /api/v1/orders/{orderId}/pdf
// ============================================================================

export interface GeneratePdfCommand {
  regenerate?: boolean;
}

// ============================================================================
// 18. Email – POST /api/v1/orders/{orderId}/prepare-email
// ============================================================================

export interface PrepareEmailCommand {
  forceRegeneratePdf?: boolean;
}

export interface PrepareEmailResponseDto {
  orderId: TransportOrderRow["id"];
  statusBefore: OrderStatusCode;
  statusAfter: "WYS" | "KOR_WYS";
  emailOpenUrl: string;
  pdfFileName: string;
}

// ============================================================================
// 19. Error response (shared)
// ============================================================================

/** Standard API error body returned for 4xx / 5xx responses */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    /** Field-level validation errors (for 400/422) */
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

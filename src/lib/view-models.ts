import type {
  ViewGroup,
  TransportTypeCode,
  CurrencyCode,
  StopKind,
  OrderSortBy,
  SortDirection,
  OrderListItemDto,
  CompanyDto,
  LocationDto,
  ProductDto,
  TransportTypeDto,
  OrderStatusDto,
  VehicleVariantDto,
} from "@/types";

// ============================================================================
// List view
// ============================================================================

/** Display mode for the orders table */
export type ListViewMode = "route" | "columns";

/** Page size options */
export type PageSize = 50 | 100 | 200;

/** Complete filter/sort/view state for the orders list */
export interface OrderListFilters {
  view: ViewGroup;
  transportType?: TransportTypeCode;
  carrierId?: string;
  productId?: string;
  loadingLocationId?: string;
  unloadingLocationId?: string;
  loadingDateFrom?: string; // YYYY-MM-DD
  loadingDateTo?: string;
  unloadingDateFrom?: string;
  unloadingDateTo?: string;
  search?: string;
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  pageSize: PageSize;
}

/** Default filter state */
export const DEFAULT_FILTERS: OrderListFilters = {
  view: "CURRENT",
  sortBy: "FIRST_LOADING_DATETIME",
  sortDirection: "ASC",
  pageSize: 50,
};

// ============================================================================
// Order form (drawer)
// ============================================================================

/** Local state for a route point in the form */
export interface OrderFormStop {
  id: string | null; // null = new
  kind: StopKind;
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  locationId: string | null;
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  notes: string | null;
  _deleted: boolean;
}

/** Local state for a cargo item in the form */
export interface OrderFormItem {
  id: string | null; // null = new
  productId: string | null;
  productNameSnapshot: string | null;
  defaultLoadingMethodSnapshot: string | null;
  quantityTons: number | null;
  notes: string | null;
  _deleted: boolean;
}

/** Complete form data for order editing */
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
  vehicleVariantCode: string;
  specialRequirements: string | null;
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  complaintReason: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  stops: OrderFormStop[];
  items: OrderFormItem[];
}

// ============================================================================
// History timeline
// ============================================================================

/** Merged timeline entry (status change + field change + creation) */
export interface TimelineEntryViewModel {
  id: string;
  type: "status_change" | "field_change" | "order_created";
  changedAt: string; // ISO timestamp
  changedByUserName: string | null;
  changedByUserId: string;
  // For status_change:
  oldStatusCode?: string | null;
  newStatusCode?: string | null;
  // For field_change:
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

// ============================================================================
// Dictionary state
// ============================================================================

/** Global dictionary cache state */
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

// ============================================================================
// Context menu
// ============================================================================

/** State for the row context menu */
export interface ContextMenuState {
  orderId: string | null;
  order: OrderListItemDto | null;
  position: { x: number; y: number };
  isOpen: boolean;
}

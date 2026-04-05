/**
 * Typy DTO dla słowników (firmy, lokalizacje, produkty, statusy, transporty, pojazdy).
 */

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

/** Combined response GET /api/v1/dictionaries — wszystkie słowniki w jednym zapytaniu. */
export interface DictionariesResponse {
  companies: CompanyDto[];
  locations: LocationDto[];
  products: ProductDto[];
  transportTypes: TransportTypeDto[];
  orderStatuses: OrderStatusDto[];
  vehicleVariants: VehicleVariantDto[];
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

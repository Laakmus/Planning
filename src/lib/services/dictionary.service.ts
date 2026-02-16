/**
 * Serwis słowników — firmy, lokalizacje, produkty, typy transportu, statusy, warianty pojazdów.
 * Zwraca ListResponse<XDto> z polami w camelCase (zgodnie z planem API).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type {
  CompanyDto,
  LocationDto,
  ListResponse,
  OrderStatusDto,
  ProductDto,
  TransportTypeDto,
  VehicleVariantDto,
} from "../../types";

type CompaniesRow = Database["public"]["Tables"]["companies"]["Row"];
type LocationsRow = Database["public"]["Tables"]["locations"]["Row"];
type ProductsRow = Database["public"]["Tables"]["products"]["Row"];
type TransportTypesRow = Database["public"]["Tables"]["transport_types"]["Row"];
type OrderStatusesRow = Database["public"]["Tables"]["order_statuses"]["Row"];
type VehicleVariantsRow = Database["public"]["Tables"]["vehicle_variants"]["Row"];

function mapCompany(row: CompaniesRow): CompanyDto {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    erpId: row.erp_id,
    taxId: row.tax_id,
    type: row.type,
    notes: row.notes,
  };
}

/** Lokalizacja z joinem companies — companyName z companies.name. */
type LocationWithCompany = LocationsRow & {
  companies: { name: string } | null;
};

function mapLocation(row: LocationWithCompany): LocationDto {
  return {
    id: row.id,
    name: row.name,
    companyId: row.company_id,
    companyName: row.companies?.name ?? null,
    city: row.city,
    country: row.country,
    streetAndNumber: row.street_and_number,
    postalCode: row.postal_code,
    isActive: row.is_active,
    notes: row.notes,
  };
}

function mapProduct(row: ProductsRow): ProductDto {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    description: row.description,
    defaultLoadingMethodCode: row.default_loading_method_code,
  };
}

function mapTransportType(row: TransportTypesRow): TransportTypeDto {
  return {
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    description: row.description,
  };
}

function mapOrderStatus(row: OrderStatusesRow): OrderStatusDto {
  return {
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
    viewGroup: row.view_group,
    isEditable: row.is_editable,
  };
}

function mapVehicleVariant(row: VehicleVariantsRow): VehicleVariantDto {
  return {
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    capacityTons: row.capacity_tons,
    capacityVolumeM3: row.capacity_volume_m3,
    vehicleType: row.vehicle_type,
    description: row.description,
  };
}

/**
 * Firmy (companies) — aktywne, opcjonalnie filtrowane po search (nazwa).
 */
export async function getCompanies(
  supabase: SupabaseClient<Database>,
  search?: string
): Promise<ListResponse<CompanyDto>> {
  let query = supabase
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return { items: (data ?? []).map(mapCompany) };
}

/**
 * Lokalizacje (locations) — aktywne, join z companies (companyName), opcjonalnie search / companyId.
 */
export async function getLocations(
  supabase: SupabaseClient<Database>,
  opts?: { search?: string; companyId?: string }
): Promise<ListResponse<LocationDto>> {
  let query = supabase
    .from("locations")
    .select("*, companies(name)")
    .eq("is_active", true)
    .order("name");
  if (opts?.search?.trim()) {
    query = query.ilike("name", `%${opts.search.trim()}%`);
  }
  if (opts?.companyId) {
    query = query.eq("company_id", opts.companyId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return { items: (data ?? []).map(mapLocation) };
}

/**
 * Produkty (products) — aktywne, opcjonalnie search po nazwie.
 */
export async function getProducts(
  supabase: SupabaseClient<Database>,
  search?: string
): Promise<ListResponse<ProductDto>> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return { items: (data ?? []).map(mapProduct) };
}

/**
 * Typy transportu (transport_types) — aktywne.
 */
export async function getTransportTypes(
  supabase: SupabaseClient<Database>
): Promise<ListResponse<TransportTypeDto>> {
  const { data, error } = await supabase
    .from("transport_types")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return { items: (data ?? []).map(mapTransportType) };
}

/**
 * Statusy zleceń (order_statuses) — wszystkie, ORDER BY sort_order.
 */
export async function getOrderStatuses(
  supabase: SupabaseClient<Database>
): Promise<ListResponse<OrderStatusDto>> {
  const { data, error } = await supabase
    .from("order_statuses")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return { items: (data ?? []).map(mapOrderStatus) };
}

/**
 * Warianty pojazdów (vehicle_variants) — aktywne.
 */
export async function getVehicleVariants(
  supabase: SupabaseClient<Database>
): Promise<ListResponse<VehicleVariantDto>> {
  const { data, error } = await supabase
    .from("vehicle_variants")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return { items: (data ?? []).map(mapVehicleVariant) };
}

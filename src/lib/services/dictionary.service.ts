import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  CompanyDto,
  LocationDto,
  ProductDto,
  TransportTypeDto,
  OrderStatusDto,
  VehicleVariantDto,
} from "../../types";

// ---------------------------------------------------------------------------
// Helpers — sanitize ILIKE special characters to prevent injection
// ---------------------------------------------------------------------------

/**
 * Escapes special ILIKE characters (%, _, \) so user input is treated literally.
 */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function listCompanies(
  supabase: SupabaseClient<Database>,
  options: { search?: string; activeOnly: boolean }
): Promise<CompanyDto[]> {
  let query = supabase
    .from("companies")
    .select("id, name, tax_id, erp_id, type, is_active, notes")
    .order("name", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  if (options.search) {
    query = query.ilike("name", `%${escapeIlike(options.search)}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    taxId: row.tax_id,
    erpId: row.erp_id,
    type: row.type,
    isActive: row.is_active,
    notes: row.notes,
  }));
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function listLocations(
  supabase: SupabaseClient<Database>,
  options: { search?: string; activeOnly: boolean; companyId?: string }
): Promise<LocationDto[]> {
  let query = supabase
    .from("locations")
    .select(
      "id, name, company_id, street_and_number, city, postal_code, country, erp_id, is_active, notes"
    )
    .order("name", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  if (options.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options.search) {
    query = query.ilike("name", `%${escapeIlike(options.search)}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    companyId: row.company_id,
    streetAndNumber: row.street_and_number,
    city: row.city,
    postalCode: row.postal_code,
    country: row.country,
    erpId: row.erp_id,
    isActive: row.is_active,
    notes: row.notes,
  }));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts(
  supabase: SupabaseClient<Database>,
  options: { search?: string; activeOnly: boolean }
): Promise<ProductDto[]> {
  let query = supabase
    .from("products")
    .select(
      "id, name, description, erp_id, default_loading_method_code, is_active"
    )
    .order("name", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  if (options.search) {
    query = query.ilike("name", `%${escapeIlike(options.search)}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    erpId: row.erp_id,
    defaultLoadingMethodCode: row.default_loading_method_code,
    isActive: row.is_active,
  }));
}

// ---------------------------------------------------------------------------
// Transport Types
// ---------------------------------------------------------------------------

export async function listTransportTypes(
  supabase: SupabaseClient<Database>,
  options: { activeOnly: boolean }
): Promise<TransportTypeDto[]> {
  let query = supabase
    .from("transport_types")
    .select("code, name, description, is_active")
    .order("code", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
  }));
}

// ---------------------------------------------------------------------------
// Order Statuses
// ---------------------------------------------------------------------------

export async function listOrderStatuses(
  supabase: SupabaseClient<Database>
): Promise<OrderStatusDto[]> {
  const { data, error } = await supabase
    .from("order_statuses")
    .select("code, name, view_group, is_editable, sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    viewGroup: row.view_group,
    isEditable: row.is_editable,
    sortOrder: row.sort_order,
  }));
}

// ---------------------------------------------------------------------------
// Vehicle Variants
// ---------------------------------------------------------------------------

export async function listVehicleVariants(
  supabase: SupabaseClient<Database>,
  options: { activeOnly: boolean }
): Promise<VehicleVariantDto[]> {
  let query = supabase
    .from("vehicle_variants")
    .select("code, name, description, vehicle_type, capacity_tons, is_active")
    .order("name", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    vehicleType: row.vehicle_type,
    capacityTons: row.capacity_tons,
    isActive: row.is_active,
  }));
}

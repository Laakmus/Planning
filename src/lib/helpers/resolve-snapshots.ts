import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";

/**
 * Snapshot data resolved from a company (carrier).
 */
export interface CarrierSnapshot {
  carrierNameSnapshot: string | null;
  carrierLocationNameSnapshot: string | null;
  carrierAddressSnapshot: string | null;
}

/**
 * Snapshot data resolved from a location (shipper or receiver).
 */
export interface LocationSnapshot {
  nameSnapshot: string | null;
  addressSnapshot: string | null;
}

/**
 * Snapshot data resolved for an order stop.
 */
export interface StopSnapshot {
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  country: string | null;
}

/**
 * Resolves carrier company name and address snapshot from the companies table.
 */
export async function resolveCarrierSnapshot(
  supabase: SupabaseClient<Database>,
  carrierCompanyId: string | null | undefined
): Promise<CarrierSnapshot> {
  if (!carrierCompanyId) {
    return {
      carrierNameSnapshot: null,
      carrierLocationNameSnapshot: null,
      carrierAddressSnapshot: null,
    };
  }

  const { data } = await supabase
    .from("companies")
    .select("name")
    .eq("id", carrierCompanyId)
    .single();

  return {
    carrierNameSnapshot: data?.name ?? null,
    carrierLocationNameSnapshot: null, // No default location for company
    carrierAddressSnapshot: null,
  };
}

/**
 * Resolves location name and address snapshot from the locations table.
 * Used for shipper and receiver locations.
 */
export async function resolveLocationSnapshot(
  supabase: SupabaseClient<Database>,
  locationId: string | null | undefined
): Promise<LocationSnapshot> {
  if (!locationId) {
    return { nameSnapshot: null, addressSnapshot: null };
  }

  const { data } = await supabase
    .from("locations")
    .select("name, street_and_number, city, postal_code, country, company_id, companies!locations_company_id_fkey(name)")
    .eq("id", locationId)
    .single();

  if (!data) {
    return { nameSnapshot: null, addressSnapshot: null };
  }

  const companyInfo = data.companies as unknown as { name: string } | null;
  const address = [data.street_and_number, data.postal_code, data.city, data.country]
    .filter(Boolean)
    .join(", ");

  return {
    nameSnapshot: companyInfo?.name ? `${companyInfo.name} — ${data.name}` : data.name,
    addressSnapshot: address || null,
  };
}

/**
 * Resolves snapshot data for an order stop from the locations table.
 */
export async function resolveStopSnapshot(
  supabase: SupabaseClient<Database>,
  locationId: string | null | undefined
): Promise<StopSnapshot> {
  if (!locationId) {
    return {
      locationNameSnapshot: null,
      companyNameSnapshot: null,
      addressSnapshot: null,
      country: null,
    };
  }

  const { data } = await supabase
    .from("locations")
    .select("name, street_and_number, city, postal_code, country, companies!locations_company_id_fkey(name)")
    .eq("id", locationId)
    .single();

  if (!data) {
    return {
      locationNameSnapshot: null,
      companyNameSnapshot: null,
      addressSnapshot: null,
      country: null,
    };
  }

  const companyInfo = data.companies as unknown as { name: string } | null;
  const address = [data.street_and_number, data.postal_code, data.city, data.country]
    .filter(Boolean)
    .join(", ");

  return {
    locationNameSnapshot: data.name,
    companyNameSnapshot: companyInfo?.name ?? null,
    addressSnapshot: address || null,
    country: data.country,
  };
}

/**
 * Resolves product name snapshot from the products table.
 */
export async function resolveProductSnapshot(
  supabase: SupabaseClient<Database>,
  productId: string | null | undefined
): Promise<{ productNameSnapshot: string | null; defaultLoadingMethodSnapshot: string | null }> {
  if (!productId) {
    return { productNameSnapshot: null, defaultLoadingMethodSnapshot: null };
  }

  const { data } = await supabase
    .from("products")
    .select("name, default_loading_method_code")
    .eq("id", productId)
    .single();

  return {
    productNameSnapshot: data?.name ?? null,
    defaultLoadingMethodSnapshot: data?.default_loading_method_code ?? null,
  };
}

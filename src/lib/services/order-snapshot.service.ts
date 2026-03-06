/**
 * Helpery snapshoty, denormalizacja, walidacja FK, generowanie numeru zlecenia.
 * Wyekstrahowane z order.service.ts — funkcje wspólne dla create/update/misc.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";

export const STATUS_ROBOCZE = "robocze";

export const MAX_LOADING_STOPS = 8;
export const MAX_UNLOADING_STOPS = 3;

/** Pobiera snapshot przewoźnika (firma + adres z głównej lokalizacji). */
export async function buildSnapshotsForCarrier(
  supabase: SupabaseClient<Database>,
  companyId: string
): Promise<{
  carrier_name_snapshot: string | null;
  carrier_address_snapshot: string | null;
  carrier_location_name_snapshot: string | null;
}> {
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  // Pobierz pierwszą lokalizację przewoźnika (adres + nazwa lokalizacji)
  const { data: location } = await supabase
    .from("locations")
    .select("name, street_and_number, postal_code, city, country")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();

  let carrierAddress: string | null = null;
  if (location) {
    carrierAddress = [location.street_and_number, `${location.postal_code} ${location.city}`, location.country]
      .filter(Boolean)
      .join(", ") || null;
  }

  return {
    carrier_name_snapshot: company?.name ?? null,
    carrier_address_snapshot: carrierAddress,
    carrier_location_name_snapshot: location?.name ?? null,
  };
}

/** Pobiera snapshot lokalizacji (nazwa lokalizacji, nazwa firmy, adres). */
export async function buildSnapshotsForLocation(
  supabase: SupabaseClient<Database>,
  locationId: string
): Promise<{
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  country: string | null;
}> {
  const { data: loc } = await supabase
    .from("locations")
    .select("name, city, country, street_and_number, postal_code, company_id, companies(name)")
    .eq("id", locationId)
    .maybeSingle();

  if (!loc) {
    return { locationNameSnapshot: null, companyNameSnapshot: null, addressSnapshot: null, country: null };
  }

  const companyName = (loc.companies as { name: string } | null)?.name ?? null;
  const address = [loc.street_and_number, `${loc.postal_code} ${loc.city}`, loc.country]
    .filter(Boolean)
    .join(", ");

  return {
    locationNameSnapshot: loc.name,
    companyNameSnapshot: companyName,
    addressSnapshot: address || null,
    country: loc.country,
  };
}

/** Pobiera snapshot shipper/receiver (nazwa firmy + adres z lokalizacji). */
export async function buildSnapshotsForShipperReceiver(
  supabase: SupabaseClient<Database>,
  locationId: string
): Promise<{ nameSnapshot: string | null; addressSnapshot: string | null }> {
  const snap = await buildSnapshotsForLocation(supabase, locationId);
  return {
    nameSnapshot: snap.companyNameSnapshot,
    addressSnapshot: snap.addressSnapshot,
  };
}

/** Batch: pobiera snapshoty lokalizacji dla wielu locationId naraz (1 query zamiast N). */
export async function batchBuildSnapshotsForLocations(
  supabase: SupabaseClient<Database>,
  locationIds: string[]
): Promise<Map<string, { locationNameSnapshot: string | null; companyNameSnapshot: string | null; addressSnapshot: string | null; country: string | null }>> {
  const result = new Map<string, { locationNameSnapshot: string | null; companyNameSnapshot: string | null; addressSnapshot: string | null; country: string | null }>();
  if (locationIds.length === 0) return result;

  const uniqueIds = [...new Set(locationIds)];
  const { data: locs } = await supabase
    .from("locations")
    .select("id, name, city, country, street_and_number, postal_code, company_id, companies(name)")
    .in("id", uniqueIds);

  for (const loc of locs ?? []) {
    const companyName = (loc.companies as { name: string } | null)?.name ?? null;
    const address = [loc.street_and_number, `${loc.postal_code} ${loc.city}`, loc.country]
      .filter(Boolean)
      .join(", ");
    result.set(loc.id, {
      locationNameSnapshot: loc.name,
      companyNameSnapshot: companyName,
      addressSnapshot: address || null,
      country: loc.country,
    });
  }
  return result;
}

/** Batch: pobiera snapshoty produktów dla wielu productId naraz (1 query zamiast N). */
export async function batchBuildSnapshotsForItems(
  supabase: SupabaseClient<Database>,
  productIds: string[]
): Promise<Map<string, { productNameSnapshot: string | null; defaultLoadingMethodSnapshot: string | null }>> {
  const result = new Map<string, { productNameSnapshot: string | null; defaultLoadingMethodSnapshot: string | null }>();
  if (productIds.length === 0) return result;

  const uniqueIds = [...new Set(productIds)];
  const { data: products } = await supabase
    .from("products")
    .select("id, name, default_loading_method_code")
    .in("id", uniqueIds);

  for (const p of products ?? []) {
    result.set(p.id, {
      productNameSnapshot: p.name ?? null,
      defaultLoadingMethodSnapshot: p.default_loading_method_code ?? null,
    });
  }
  return result;
}

/**
 * Oblicza pola denormalizowane z listy stops:
 * first/last loading/unloading date/time, first loading/unloading country, summary_route.
 */
export function computeDenormalizedFields(
  stops: Array<{
    kind: string;
    dateLocal: string | null;
    timeLocal: string | null;
    locationNameSnapshot?: string | null;
    country?: string | null;
  }>,
  items: Array<{ productNameSnapshot: string | null }>
): {
  first_loading_date: string | null;
  first_loading_time: string | null;
  first_unloading_date: string | null;
  first_unloading_time: string | null;
  last_loading_date: string | null;
  last_loading_time: string | null;
  last_unloading_date: string | null;
  last_unloading_time: string | null;
  first_loading_country: string | null;
  first_unloading_country: string | null;
  summary_route: string | null;
  main_product_name: string | null;
  transport_year: number | null;
} {
  const loading = stops.filter((s) => s.kind === "LOADING");
  const unloading = stops.filter((s) => s.kind === "UNLOADING");

  const firstLoadingCountry = loading[0]?.country ?? null;
  const firstUnloadingCountry = unloading[0]?.country ?? null;

  // summary_route: "PL: Kęty → DE: Hamburg"
  const routeParts: string[] = [];
  for (const s of stops) {
    const name = s.locationNameSnapshot ?? "?";
    const country = s.country ?? "";
    routeParts.push(country ? `${country}: ${name}` : name);
  }
  const summaryRoute = routeParts.length > 0 ? routeParts.join(" → ") : null;

  const mainProductName = items.find((i) => i.productNameSnapshot?.trim())?.productNameSnapshot ?? null;

  const firstLoadingDate = loading[0]?.dateLocal ?? null;
  const transportYear = firstLoadingDate
    ? parseInt(firstLoadingDate.substring(0, 4), 10)
    : new Date().getFullYear();

  return {
    first_loading_date: loading[0]?.dateLocal ?? null,
    first_loading_time: loading[0]?.timeLocal ?? null,
    first_unloading_date: unloading[0]?.dateLocal ?? null,
    first_unloading_time: unloading[0]?.timeLocal ?? null,
    last_loading_date: loading.length > 0 ? loading[loading.length - 1]?.dateLocal ?? null : null,
    last_loading_time: loading.length > 0 ? loading[loading.length - 1]?.timeLocal ?? null : null,
    last_unloading_date: unloading.length > 0 ? unloading[unloading.length - 1]?.dateLocal ?? null : null,
    last_unloading_time: unloading.length > 0 ? unloading[unloading.length - 1]?.timeLocal ?? null : null,
    first_loading_country: firstLoadingCountry,
    first_unloading_country: firstUnloadingCountry,
    summary_route: summaryRoute,
    main_product_name: mainProductName,
    transport_year: transportYear,
  };
}

/** Buduje search_text z dostępnych danych zlecenia (do full-text wyszukiwania). */
export function buildSearchText(
  orderNo: string,
  carrierName: string | null,
  stops: Array<{ locationNameSnapshot?: string | null; companyNameSnapshot?: string | null }>,
  items: Array<{ productNameSnapshot: string | null }>,
  notes: string | null
): string {
  const parts: string[] = [orderNo];
  if (carrierName) parts.push(carrierName);
  for (const s of stops) {
    if (s.companyNameSnapshot) parts.push(s.companyNameSnapshot);
    if (s.locationNameSnapshot) parts.push(s.locationNameSnapshot);
  }
  for (const i of items) {
    if (i.productNameSnapshot) parts.push(i.productNameSnapshot);
  }
  if (notes) parts.push(notes);
  return parts.join(" ");
}

/**
 * Automatyczne ustawienie required_documents_text i currency_code wg typu transportu.
 * Sekcja 5 db-plan: PL → PLN, EXP/EXP_K/IMP → EUR; dokumenty wg typu.
 */
export function autoSetDocumentsAndCurrency(
  transportTypeCode: string,
  userCurrency: string
): { requiredDocumentsText: string; currencyCode: string } {
  let requiredDocumentsText = "";

  switch (transportTypeCode) {
    case "PL":
      requiredDocumentsText = "WZ, KPO, kwit wagowy";
      break;
    case "EXP":
    case "EXP_K":
    case "IMP":
      requiredDocumentsText = "WZE, Aneks VII, CMR";
      break;
  }
  return { requiredDocumentsText, currencyCode: userCurrency };
}

/**
 * Waliduje istnienie referencji FK w bazie (transportTypeCode, carrierCompanyId, itp.).
 * Zwraca obiekt z błędami walidacji lub null gdy OK.
 */
export async function validateForeignKeys(
  supabase: SupabaseClient<Database>,
  params: {
    transportTypeCode: string;
    carrierCompanyId?: string | null;
    stops: Array<{ locationId: string | null }>;
    items: Array<{ productId: string | null }>;
  }
): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {};

  // transportTypeCode
  const { data: tt } = await supabase
    .from("transport_types")
    .select("code")
    .eq("code", params.transportTypeCode)
    .eq("is_active", true)
    .maybeSingle();
  if (!tt) errors.transportTypeCode = "Typ transportu nie istnieje lub jest nieaktywny.";

  // carrierCompanyId
  if (params.carrierCompanyId) {
    const { data: cc } = await supabase
      .from("companies")
      .select("id")
      .eq("id", params.carrierCompanyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!cc) errors.carrierCompanyId = "Firma przewoźnika nie istnieje lub jest nieaktywna.";
  }

  // locationId w stops
  const locationIds = [...new Set(params.stops.map((s) => s.locationId).filter(Boolean))] as string[];
  if (locationIds.length > 0) {
    const { data: locs } = await supabase
      .from("locations")
      .select("id")
      .in("id", locationIds)
      .eq("is_active", true);
    const foundIds = new Set((locs ?? []).map((l) => l.id));
    for (const lid of locationIds) {
      if (!foundIds.has(lid)) {
        errors[`stops.locationId(${lid})`] = "Lokalizacja nie istnieje lub jest nieaktywna.";
      }
    }
  }

  // productId w items
  const productIds = [...new Set(params.items.map((i) => i.productId).filter(Boolean))] as string[];
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id")
      .in("id", productIds)
      .eq("is_active", true);
    const foundIds = new Set((prods ?? []).map((p) => p.id));
    for (const pid of productIds) {
      if (!foundIds.has(pid)) {
        errors[`items.productId(${pid})`] = "Produkt nie istnieje lub jest nieaktywny.";
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Generuje kolejny numer zlecenia w formacie ZT{year}/{seqNo 4 cyfry}.
 *
 * Używa atomowej funkcji RPC (generate_next_order_no) w PostgreSQL,
 * która stosuje pg_advisory_xact_lock do serializacji równoczesnych wywołań.
 * Eliminuje race condition, w którym dwa równoczesne POST mogłyby dostać ten sam numer.
 */
export async function generateOrderNo(
  supabase: SupabaseClient<Database>
): Promise<string> {
  // Cast needed: generated Supabase types don't include custom RPC functions.
  // RPC zdefiniowane w supabase/migrations/20260207000000_consolidated_schema.sql (sekcja 7.2).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("generate_next_order_no");

  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Unexpected result from generate_next_order_no RPC");
  }

  return data;
}

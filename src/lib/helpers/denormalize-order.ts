import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";

interface StopData {
  kind: string;
  date_local: string | null;
  time_local: string | null;
  sequence_no: number;
  location_name_snapshot: string | null;
  company_name_snapshot: string | null;
  country?: string | null;
}

interface DenormalizedFields {
  first_loading_date: string | null;
  first_loading_time: string | null;
  first_unloading_date: string | null;
  first_unloading_time: string | null;
  first_loading_country: string | null;
  first_unloading_country: string | null;
  summary_route: string | null;
  transport_year: number | null;
  search_text: string | null;
}

/**
 * Computes denormalized fields from stops and order data.
 * These fields are stored on transport_orders for fast querying and display.
 */
export function computeDenormalizedFields(
  stops: StopData[],
  orderData: {
    order_no: string;
    carrier_name_snapshot: string | null;
  }
): DenormalizedFields {
  const sorted = [...stops].sort((a, b) => a.sequence_no - b.sequence_no);

  const loadingStops = sorted.filter((s) => s.kind === "LOADING");
  const unloadingStops = sorted.filter((s) => s.kind === "UNLOADING");

  const firstLoading = loadingStops[0] ?? null;
  const firstUnloading = unloadingStops[0] ?? null;

  // Build summary route: "Location1 → Location2 → ..."
  const routeParts = sorted
    .map((s) => s.location_name_snapshot || s.company_name_snapshot)
    .filter(Boolean);
  const summaryRoute = routeParts.length > 0 ? routeParts.join(" → ") : null;

  // Transport year from first loading date
  const transportYear = firstLoading?.date_local
    ? parseInt(firstLoading.date_local.substring(0, 4), 10)
    : null;

  // Build search text — concatenation of searchable fields
  const searchParts = [
    orderData.order_no,
    orderData.carrier_name_snapshot,
    ...sorted.map((s) => s.location_name_snapshot),
    ...sorted.map((s) => s.company_name_snapshot),
  ].filter(Boolean);
  const searchText = searchParts.length > 0 ? searchParts.join(" ") : null;

  return {
    first_loading_date: firstLoading?.date_local ?? null,
    first_loading_time: firstLoading?.time_local ?? null,
    first_unloading_date: firstUnloading?.date_local ?? null,
    first_unloading_time: firstUnloading?.time_local ?? null,
    first_loading_country: firstLoading?.country ?? null,
    first_unloading_country: firstUnloading?.country ?? null,
    summary_route: summaryRoute,
    transport_year: transportYear,
    search_text: searchText,
  };
}

/**
 * Recalculates and updates denormalized fields on transport_orders.
 * Fetches all stops for the order, computes fields, and writes them back.
 */
export async function updateDenormalizedFields(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<void> {
  // Fetch order basic info
  const { data: order } = await supabase
    .from("transport_orders")
    .select("order_no, carrier_name_snapshot")
    .eq("id", orderId)
    .single();

  if (!order) return;

  // Fetch all stops
  const { data: stops } = await supabase
    .from("order_stops")
    .select("kind, date_local, time_local, sequence_no, location_name_snapshot, company_name_snapshot")
    .eq("order_id", orderId)
    .order("sequence_no", { ascending: true });

  const fields = computeDenormalizedFields(stops ?? [], order);

  await supabase
    .from("transport_orders")
    .update(fields)
    .eq("id", orderId);
}

/**
 * Rozwiązywanie danych potrzebnych do generowania PDF zlecenia.
 * Wyekstrahowane z pdf.ts API route — reużywalne w prepare-email i pdf endpoint.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../db/database.types";
import type { OrderDetailResponseDto } from "../../../types";
import type { GeneratePdfInput } from "./pdf-generator.service";

/**
 * Pobiera NIP firmy transportowej i kraje stopów, buduje GeneratePdfInput.
 *
 * @param supabase — klient Supabase
 * @param detail — pełne dane zlecenia (order + stops + items)
 */
export async function resolvePdfData(
  supabase: SupabaseClient<Database>,
  detail: OrderDetailResponseDto
): Promise<GeneratePdfInput> {
  // Pobranie NIP firmy transportowej
  let carrierTaxId: string | null = null;
  if (detail.order.carrierCompanyId) {
    const { data } = await supabase
      .from("companies")
      .select("tax_id")
      .eq("id", detail.order.carrierCompanyId)
      .maybeSingle();
    carrierTaxId = data?.tax_id ?? null;
  }

  // Rozwiązanie kraju dla każdego stopu na podstawie lokalizacji
  const locationIds = detail.stops
    .map((s) => s.locationId)
    .filter((id): id is string => id != null);

  let locationCountryMap: Record<string, string> = {};
  if (locationIds.length > 0) {
    const { data: locs } = await supabase
      .from("locations")
      .select("id, country")
      .in("id", locationIds);
    if (locs) {
      locationCountryMap = Object.fromEntries(locs.map((l) => [l.id, l.country]));
    }
  }

  return {
    order: {
      orderNo: detail.order.orderNo,
      createdAt: detail.order.createdAt,
      carrierName: detail.order.carrierNameSnapshot,
      carrierAddress: detail.order.carrierAddressSnapshot,
      carrierTaxId,
      vehicleType: detail.order.vehicleTypeText,
      vehicleVolumeM3: detail.order.vehicleCapacityVolumeM3,
      priceAmount: detail.order.priceAmount,
      currencyCode: detail.order.currencyCode,
      paymentTermDays: detail.order.paymentTermDays,
      paymentMethod: detail.order.paymentMethod,
      documentsText: detail.order.requiredDocumentsText,
      generalNotes: detail.order.generalNotes,
      confidentialityClause: detail.order.confidentialityClause,
      senderContactName: detail.order.senderContactName,
      senderContactEmail: detail.order.senderContactEmail,
      senderContactPhone: detail.order.senderContactPhone,
    },
    stops: detail.stops.map((s) => ({
      ...s,
      country: s.locationId ? (locationCountryMap[s.locationId] ?? null) : null,
    })),
    items: detail.items.map((i) => ({
      productNameSnapshot: i.productNameSnapshot,
      loadingMethodCode: i.loadingMethodCode,
      notes: i.notes,
    })),
  };
}

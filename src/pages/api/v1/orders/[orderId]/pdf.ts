/**
 * POST /api/v1/orders/{orderId}/pdf
 *
 * Generowanie PDF zlecenia transportowego.
 * Auth → pobranie danych → generacja PDF → zwrot application/pdf.
 *
 * Błędy: 400, 401, 404, 500.
 */

import type { APIRoute } from "astro";

import {
  COMMON_HEADERS,
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
  logError,
} from "../../../../../lib/api-helpers";
import { getOrderDetail } from "../../../../../lib/services/order.service";
import { generateOrderPdf } from "../../../../../lib/services/pdf/pdf-generator.service";

export const POST: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  try {
    const detail = await getOrderDetail(locals.supabase, orderId);
    if (!detail) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }

    // Pobranie NIP firmy transportowej
    let carrierTaxId: string | null = null;
    if (detail.order.carrierCompanyId) {
      const { data } = await locals.supabase
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
      const { data: locs } = await locals.supabase
        .from("locations")
        .select("id, country")
        .in("id", locationIds);
      if (locs) {
        locationCountryMap = Object.fromEntries(locs.map((l) => [l.id, l.country]));
      }
    }

    const pdfBuffer = generateOrderPdf({
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
    });

    const sanitizedName = (detail.order.orderNo || orderId).replace(/["\r\n/]/g, "-");
    const fileName = `zlecenie-${sanitizedName}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    logError("[POST /api/v1/orders/{orderId}/pdf]", err);
    return errorResponse(500, "Internal Server Error", "Nie udało się wygenerować PDF.");
  }
};

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
  requireWriteAccess,
} from "../../../../../lib/api-helpers";
import { getOrderDetail } from "../../../../../lib/services/order.service";
import { resolvePdfData } from "../../../../../lib/services/pdf/pdf-data-resolver";
import { generateOrderPdf } from "../../../../../lib/services/pdf/pdf-generator.service";

export const POST: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeCheck = requireWriteAccess(authResult);
  if (writeCheck) return writeCheck;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  try {
    const detail = await getOrderDetail(locals.supabase, orderId);
    if (!detail) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }

    const pdfInput = await resolvePdfData(locals.supabase, detail);
    const pdfBuffer = generateOrderPdf(pdfInput);

    // Allowlist: tylko bezpieczne znaki w nazwie pliku
    const sanitizedName = (detail.order.orderNo || orderId).replace(/[^a-zA-Z0-9._-]/g, "-");
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

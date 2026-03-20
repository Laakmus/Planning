/**
 * POST /api/v1/warehouse/report/pdf
 * Generuje PDF raportu tygodniowego magazynu.
 * Response: blob application/pdf.
 */

import type { APIRoute } from "astro";

import {
  COMMON_HEADERS,
  errorResponse,
  getAuthenticatedUser,
  requireWriteAccess,
  logError,
} from "../../../../../lib/api-helpers";
import {
  getWarehouseWeekOrders,
} from "../../../../../lib/services/warehouse.service";
import { generateWarehouseReportPdf } from "../../../../../lib/services/pdf/warehouse-pdf-generator.service";
import { warehouseReportPdfSchema } from "../../../../../lib/validators/warehouse-report.validator";

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.supabase) {
    return errorResponse(500, "Internal Server Error", "Brak klienta Supabase.");
  }

  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  // Parsuj body
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy body JSON.");
  }

  const parsed = warehouseReportPdfSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry raportu.");
  }

  // Ustal week/year
  const week = parsed.data.week;
  const year = parsed.data.year;

  // Ustal locationId
  const locationId = parsed.data.locationId ?? authResult.locationId;
  if (!locationId) {
    return errorResponse(403, "Forbidden", "Brak przypisanego oddziału magazynowego.");
  }

  try {
    // Pobierz nazwę lokalizacji
    const { data: location } = await locals.supabase
      .from("locations")
      .select("name")
      .eq("id", locationId)
      .maybeSingle();

    const locationName = location?.name ?? "Nieznany oddział";

    // Pobierz dane tygodnia
    const weekData = await getWarehouseWeekOrders(
      locals.supabase,
      locationId,
      week,
      year,
      locationName,
    );

    // Wygeneruj PDF
    const pdfBuffer = generateWarehouseReportPdf({ data: weekData });

    // Sanityzacja nazwy pliku
    const safeName = locationName.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "").trim().replace(/\s+/g, "-");
    const fileName = `plan-zaladunkowy-${safeName}-W${week}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    logError("[POST /api/v1/warehouse/report/pdf]", err);
    return errorResponse(500, "Internal Server Error", "Błąd generowania raportu PDF.");
  }
};

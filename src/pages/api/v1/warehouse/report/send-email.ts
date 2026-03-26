/**
 * POST /api/v1/warehouse/report/send-email
 * Wysyłka raportu magazynowego: generuje PDF, pobiera odbiorców, zwraca .eml lub PDF base64.
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
import { buildEmlWithPdfAttachment } from "../../../../../lib/services/eml/eml-builder.service";
import { warehouseReportSendEmailSchema } from "../../../../../lib/validators/warehouse-report.validator";

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.supabase) {
    return errorResponse(500, "Internal Server Error", "Brak klienta Supabase.");
  }

  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy body JSON.");
  }

  const parsed = warehouseReportSendEmailSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry raportu.");
  }

  const { week, year, outputFormat } = parsed.data;
  const locationId = parsed.data.locationId ?? authResult.locationId;
  if (!locationId) {
    return errorResponse(403, "Forbidden", "Brak przypisanego oddziału magazynowego.");
  }

  try {
    // Sprawdź czy lokalizacja istnieje i należy do firmy wewnętrznej (INTERNAL)
    const { data: location } = await (locals.supabase
      .from("locations")
      .select("id, name, companies!inner(type)")
      .eq("id", locationId)
      .eq("companies.type", "INTERNAL")
      .maybeSingle() as any);

    if (!location) {
      return errorResponse(
        400,
        "Bad Request",
        "Podana lokalizacja nie istnieje lub nie jest oddziałem wewnętrznym."
      );
    }

    const locationName = location.name ?? "Nieznany oddział";

    // Pobierz odbiorców
    const { data: recipients, error: recipientsErr } = await locals.supabase
      .from("warehouse_report_recipients")
      .select("id, email, name")
      .eq("location_id", locationId);

    if (recipientsErr) {
      logError("[POST /api/v1/warehouse/report/send-email] recipients query", recipientsErr);
      return errorResponse(500, "Internal Server Error", "Błąd pobierania odbiorców.");
    }

    if (!recipients || recipients.length === 0) {
      return errorResponse(
        422,
        "Unprocessable Entity",
        "Brak skonfigurowanych odbiorców email dla tego oddziału."
      );
    }

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

    const safeName = locationName.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "").trim().replace(/\s+/g, "-");
    const pdfFileName = `plan-zaladunkowy-${safeName}-W${week}.pdf`;

    // Format pdf-base64: JSON z danymi do Graph API
    if (outputFormat === "pdf-base64") {
      const base64 = Buffer.from(pdfBuffer).toString("base64");
      return new Response(
        JSON.stringify({
          pdfBase64: base64,
          pdfFileName,
          recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
        }),
        {
          status: 200,
          headers: { ...COMMON_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Format eml: plik .eml z PDF jako załącznik
    const toEmails = recipients.map((r) => r.email).join(", ");
    const subject = `Plan załadunkowy magazynu ${locationName} — tydzień ${week}/${year}`;
    const bodyText = `W załączniku plan załadunkowy magazynu ${locationName} na tydzień ${week} (${year}).`;

    const emlContent = buildEmlWithPdfAttachment({
      pdfBuffer,
      pdfFileName,
      subject,
      to: toEmails,
      body: bodyText,
    });

    const emlFileName = `plan-zaladunkowy-${safeName}-W${week}.eml`;
    return new Response(emlContent, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${emlFileName}"`,
      },
    });
  } catch (err) {
    logError("[POST /api/v1/warehouse/report/send-email]", err);
    return errorResponse(500, "Internal Server Error", "Błąd wysyłki raportu.");
  }
};

import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth } from "../../../../../lib/utils/auth-guard";
import { errorResponse } from "../../../../../lib/utils/api-response";
import { generateOrderPdf } from "../../../../../lib/services/pdf.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/** Optional request body schema */
const generatePdfBodySchema = z
  .object({
    regenerate: z.boolean().optional().default(false),
  })
  .optional()
  .default({});

/**
 * POST /api/v1/orders/{orderId}/pdf
 *
 * Generates a PDF document for a transport order and returns it as binary data.
 * Uses Supabase Storage as a cache — if the PDF was already generated and
 * `regenerate` is false (default), the cached version is returned.
 *
 * Request body (optional):
 *   { "regenerate": true }  — forces regeneration even if cached.
 *
 * Requires: Authorization: Bearer <jwt_token>
 * Returns: application/pdf binary (200) or error (400, 401, 404, 500)
 */
export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Validate orderId path parameter
    const orderIdResult = orderIdSchema.safeParse(params.orderId);
    if (!orderIdResult.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowy identyfikator zlecenia",
        400,
        orderIdResult.error.issues.map((i) => ({
          field: "orderId",
          message: i.message,
        }))
      );
    }
    const orderId = orderIdResult.data;

    // 3. Parse optional request body
    let requestBody: unknown = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        requestBody = JSON.parse(text);
      }
    } catch {
      return errorResponse("VALIDATION_ERROR", "Nieprawidłowy format JSON", 400);
    }

    const parsed = generatePdfBodySchema.safeParse(requestBody);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Błędy walidacji danych",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    // 4. Generate PDF
    const result = await generateOrderPdf(
      authResult.supabase,
      orderId,
      parsed.data.regenerate
    );

    // 5. Handle service-level errors
    if ("error" in result) {
      const messages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
      };
      return errorResponse(
        result.error,
        messages[result.error] ?? "Błąd generowania PDF",
        result.status
      );
    }

    // 6. Return PDF binary response
    //    Use the buffer's underlying ArrayBuffer for Web API Response compatibility.
    const pdfBody = result.buffer.buffer.slice(
      result.buffer.byteOffset,
      result.buffer.byteOffset + result.buffer.byteLength
    ) as ArrayBuffer;
    return new Response(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Content-Length": String(result.buffer.length),
      },
    });
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};

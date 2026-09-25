/**
 * POST /api/v1/orders/{orderId}/prepare-email-graph
 *
 * Wariant „prepare-email” dla flow Microsoft Graph:
 *   - zmienia status zlecenia jak `prepareEmailForOrder` (robocze→wysłane, korekta→korekta wysłane),
 *   - generuje PDF + content emaila,
 *   - tworzy draft w skrzynce Outlook usera przez Graph API,
 *   - zwraca `{ draftId, webLink }` — frontend otwiera `webLink` w nowej karcie.
 *
 * Gdy user nie ma połączenia z MS (`MS_NOT_CONNECTED`) lub refresh się nie powiódł,
 * zwracamy 412 Precondition Failed z `error: "MS_NOT_CONNECTED"`. Frontend rozpoznaje
 * ten kod i fallbackuje na .eml (`POST /prepare-email`).
 *
 * Błędy:
 *   400 — niepoprawne UUID / status nie pozwala na wysyłkę
 *   401 — brak sesji
 *   403 — READ_ONLY
 *   404 — brak zlecenia
 *   409 — race condition (status zmienił się między odczytem a UPDATE)
 *   412 — brak połączenia z MS (`MS_NOT_CONNECTED`)
 *   422 — walidacja biznesowa (brakujące pola)
 *   500 — błąd Graph lub inny wewnętrzny
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
  jsonResponse,
  logError,
  requireWriteAccess,
} from "@/lib/api-helpers";
import { buildOrderEmailContent } from "@/lib/services/email-content.service";
import {
  createDraftEmail,
  getValidAccessToken,
} from "@/lib/services/ms-graph.service";
import { getOrderDetail } from "@/lib/services/order-detail.service";
import { prepareEmailForOrder } from "@/lib/services/order.service";
import { prepareEmailGraphSchema } from "@/lib/validators/ms-oauth.validator";
import type { PrepareEmailGraphResponseDto } from "@/types";

export const POST: APIRoute = async ({ params, locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  // Body opcjonalny — placeholder na przyszłość (vide prepareEmailGraphSchema)
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy body JSON.");
  }
  const parsed = prepareEmailGraphSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry.");
  }

  try {
    // 1. Sprawdź status połączenia z MS — early-fail (przed mutacją statusu zlecenia).
    //    `getValidAccessToken` rzuca "MS_NOT_CONNECTED" lub "MS_REFRESH_FAILED".
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(locals.supabase, authResult.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "MS_NOT_CONNECTED" || msg === "MS_REFRESH_FAILED") {
        return errorResponse(
          412,
          "Precondition Failed",
          "Konto Microsoft nie jest połączone lub sesja wygasła. Połącz konto w ustawieniach.",
          { code: "MS_NOT_CONNECTED" }
        );
      }
      throw err;
    }

    // 2. Wywołaj `prepareEmailForOrder` z `outputFormat: "pdf-base64"` — robi:
    //    - walidację statusu (NOT_ALLOWED_STATUS),
    //    - walidację pól biznesowych (422),
    //    - zmianę statusu + log historii + log zmian,
    //    - generację PDF,
    //    - zwraca pdfBase64 + pdfFileName + orderNo + emailSubject.
    //    Jeśli wynik nie ma poprawnego formatu (np. orderId nie istnieje), zwracamy odpowiedni kod.
    const prepareResult = await prepareEmailForOrder(
      locals.supabase,
      authResult.id,
      orderId,
      { outputFormat: "pdf-base64" }
    );

    if (prepareResult === null) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    if (!prepareResult.success) {
      return errorResponse(
        422,
        "Unprocessable Entity",
        "Zlecenie nie spełnia wymagań do wysyłki. Uzupełnij brakujące dane.",
        { missing: prepareResult.validationErrors }
      );
    }
    if (prepareResult.format !== "pdf-base64") {
      // Świadomy guard — przy źle przekazanym `outputFormat` `prepareEmailForOrder`
      // mógłby zwrócić eml. Tu wymagamy pdf-base64.
      logError(
        "[POST /prepare-email-graph]",
        new Error(`Nieoczekiwany format wyniku: ${prepareResult.format}`)
      );
      return errorResponse(500, "Internal Server Error", "Nieoczekiwany format wyniku PDF.");
    }

    // 3. Zbuduj pełen content emaila (subject + body html). PDF już mamy z prepareResult.
    //    `buildOrderEmailContent` reuse: subject z buildEmailSubject + bodyHtml + filename.
    //    NIE generujemy PDF drugi raz — używamy `prepareResult.pdfBase64`.
    const detail = await getOrderDetail(locals.supabase, orderId);
    if (!detail) {
      // Praktycznie nieosiągalne (prepareEmailForOrder już go pobrał), ale defensywnie
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    const emailContent = await buildOrderEmailContent(locals.supabase, detail);

    // 4. Utwórz draft w Outlook + załącznik PDF
    const { draftId, webLink } = await createDraftEmail(accessToken, {
      to: emailContent.to,
      subject: emailContent.subject,
      bodyHtml: emailContent.bodyHtml,
      attachmentBase64: prepareResult.pdfBase64,
      attachmentFilename: prepareResult.pdfFileName,
    });

    const dto: PrepareEmailGraphResponseDto = { draftId, webLink };
    return jsonResponse(dto, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_ALLOWED_STATUS") {
      return errorResponse(
        400,
        "Bad Request",
        "Wysyłka niedozwolona dla zlecenia w tym statusie (zrealizowane, anulowane, reklamacja)."
      );
    }
    if (msg === "STATUS_CHANGED") {
      return errorResponse(
        409,
        "Conflict",
        "Status zlecenia zmienił się w trakcie operacji. Odśwież dane i spróbuj ponownie."
      );
    }
    logError("[POST /api/v1/orders/{orderId}/prepare-email-graph]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Błąd podczas tworzenia draftu w Microsoft Outlook."
    );
  }
};

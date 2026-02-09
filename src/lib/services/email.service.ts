import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  OrderStatusCode,
  PrepareEmailResponseDto,
} from "../../types";
import type { PrepareEmailInput } from "../schemas/prepare-email.schema";
import { getOrderById } from "./order.service";
import { generateOrderPdf } from "./pdf.service";
import { validateOrderForSending } from "../validators/order-send-validator";
import type { SendValidationError } from "../validators/order-send-validator";

// ---------------------------------------------------------------------------
// Status transition map for the prepare-email workflow
// ---------------------------------------------------------------------------

/**
 * Determines the new status after preparing an email for sending.
 *
 * Rules:
 * - ROB → WYS (first send)
 * - KOR → KOR_WYS (re-send after correction)
 * - WYS, KOR_WYS → no change (resend — keep current status)
 * - Other statuses (ZRE, ANL, REK) → not allowed (403)
 */
function resolveNewStatus(
  currentStatus: OrderStatusCode
): OrderStatusCode | { error: string } {
  switch (currentStatus) {
    case "ROB":
      return "WYS";
    case "KOR":
      return "KOR_WYS";
    case "WYS":
    case "KOR_WYS":
      return currentStatus; // Resend — no status change
    default:
      return {
        error: `Status ${currentStatus} nie pozwala na wysyłkę zlecenia`,
      };
  }
}

// ---------------------------------------------------------------------------
// Email URL builder
// ---------------------------------------------------------------------------

/**
 * Builds a mailto: URL with pre-filled subject and body.
 *
 * @param carrierEmail - Carrier contact email (if available)
 * @param orderNo - Order number for the subject line
 * @param pdfFileName - Generated PDF filename (for reference in body)
 */
function buildEmailOpenUrl(
  carrierEmail: string | null,
  orderNo: string,
  pdfFileName: string
): string {
  const to = carrierEmail ?? "";
  const subject = encodeURIComponent(`Zlecenie transportowe ${orderNo}`);
  const body = encodeURIComponent(
    `Dzień dobry,\n\nW załączeniu przesyłam zlecenie transportowe ${orderNo}.\n\nPlik: ${pdfFileName}\n\nZ poważaniem`
  );

  return `mailto:${to}?subject=${subject}&body=${body}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepares a transport order for email sending.
 *
 * Full workflow:
 * 1. Fetch order data (header + stops + items).
 * 2. Run business validation — check all required fields for sending.
 * 3. If validation fails → return 422 with list of missing fields.
 * 4. Determine status transition (ROB→WYS, KOR→KOR_WYS, etc.).
 * 5. Update order status + log in history.
 * 6. Generate/refresh PDF.
 * 7. Build mailto: URL.
 * 8. Return PrepareEmailResponseDto.
 *
 * @returns PrepareEmailResponseDto on success, or an error object on failure.
 */
export async function prepareOrderEmail(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  command: PrepareEmailInput
): Promise<
  | PrepareEmailResponseDto
  | {
      error: string;
      status: number;
      message?: string;
      details?: SendValidationError[];
    }
> {
  // 1. Fetch full order data
  const orderData = await getOrderById(supabase, orderId);

  if (!orderData) {
    return { error: "NOT_FOUND", status: 404, message: "Zlecenie nie istnieje" };
  }

  const { order, stops, items } = orderData;
  const currentStatus = order.statusCode;

  // 2. Check if current status allows sending
  const newStatusResult = resolveNewStatus(currentStatus);
  if (typeof newStatusResult === "object" && "error" in newStatusResult) {
    return {
      error: "STATUS_NOT_ALLOWED",
      status: 403,
      message: newStatusResult.error,
    };
  }
  const newStatus = newStatusResult;

  // 3. Run business validation
  const validationErrors = validateOrderForSending(order, stops, items);

  if (validationErrors.length > 0) {
    return {
      error: "VALIDATION_FAILED",
      status: 422,
      message: "Dane niekompletne do wysyłki zlecenia",
      details: validationErrors,
    };
  }

  // 4. Update status (if changed)
  const statusChanged = newStatus !== currentStatus;

  if (statusChanged) {
    const { error: updateError } = await supabase
      .from("transport_orders")
      .update({
        status_code: newStatus,
        updated_by_user_id: userId,
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    // Log status change in history
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      old_status_code: currentStatus,
      new_status_code: newStatus,
      changed_by_user_id: userId,
    });
  }

  // 5. Generate/refresh PDF
  const pdfResult = await generateOrderPdf(
    supabase,
    orderId,
    command.forceRegeneratePdf || statusChanged
  );

  if ("error" in pdfResult) {
    // PDF generation failed — this is an internal error, but order status
    // was already updated. Log and return 500.
    throw new Error(`PDF generation failed: ${pdfResult.error}`);
  }

  // 6. Resolve carrier email for the mailto: link
  let carrierEmail: string | null = null;

  if (order.carrierCompanyId) {
    // Try to get the carrier's contact email from senderContactEmail field
    // (which stores the email of the person sending the order)
    // For the mailto: link, we need the carrier's email — currently not
    // stored separately. Using senderContactEmail as a fallback or leaving empty.
    // In production, this would come from a contacts table linked to the carrier company.
    carrierEmail = order.senderContactEmail;
  }

  // 7. Build mailto: URL
  const emailOpenUrl = buildEmailOpenUrl(
    carrierEmail,
    order.orderNo,
    pdfResult.fileName
  );

  // 8. Return response
  return {
    orderId,
    statusBefore: currentStatus,
    statusAfter: newStatus as "WYS" | "KOR_WYS",
    emailOpenUrl,
    pdfFileName: pdfResult.fileName,
  };
}

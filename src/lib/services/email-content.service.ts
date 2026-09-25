/**
 * Wspólny helper budujący content emaila zlecenia (subject + body + PDF attachment).
 *
 * Wyekstrahowany z `order-misc.service.ts` (`prepareEmailForOrder`) w ramach AUTH-MIG B3,
 * aby reużywać tę samą logikę w dwóch endpointach:
 *
 *   1) POST /api/v1/orders/:id/prepare-email        — flow .eml + pdf-base64 (legacy/fallback)
 *   2) POST /api/v1/orders/:id/prepare-email-graph  — flow Graph API (draft w Outlook usera)
 *
 * Zakres: czysta logika "co ma być w mailu". NIE zmienia statusu zlecenia, NIE pisze do DB
 * (to robi `prepareEmailForOrder`). Może być wywoływana po stronie Graph flow już PO
 * skutecznej zmianie statusu w `prepareEmailForOrder` lub samodzielnie.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { OrderDetailResponseDto } from "@/types";

import { resolvePdfData } from "./pdf/pdf-data-resolver";
import { generateOrderPdf } from "./pdf/pdf-generator.service";

/**
 * Wynik `buildOrderEmailContent`:
 * - `to` — adres odbiorcy (zazwyczaj pusty — user uzupełnia w Outlook),
 * - `subject` — temat (zgodny z buildEmailSubject),
 * - `bodyHtml` — body HTML draftu (krótki tekst informacyjny),
 * - `attachmentBase64` — PDF zakodowany w base64,
 * - `attachmentFilename` — nazwa pliku PDF (sanityzowana, bezpieczna).
 */
export interface OrderEmailContent {
  to: string;
  subject: string;
  bodyHtml: string;
  attachmentBase64: string;
  attachmentFilename: string;
  orderNo: string;
}

/**
 * Buduje temat emaila wg PRD: {orderNo} -{odbiorcy} - {carrier} - {załadunki} - zał. {DD/MM/YYYY}.
 *
 * Funkcja ZNANA z `order-misc.service.ts` — duplikat zachowany świadomie, aby `email-content.service`
 * pozostał samowystarczalny (brak cyclic dependency: order-misc → email-content → order-misc).
 *
 * @param detail — pełne dane zlecenia (order + stops)
 */
export function buildEmailSubject(detail: OrderDetailResponseDto): string {
  const { order, stops } = detail;

  const orderNo = order.orderNo || "???";

  // Odbiorcy = unikalne companyNameSnapshot z UNLOADING stops
  const receivers = [
    ...new Set(
      stops
        .filter((s) => s.kind === "UNLOADING" && s.companyNameSnapshot?.trim())
        .map((s) => s.companyNameSnapshot!.trim())
    ),
  ];

  const carrier = order.carrierNameSnapshot?.trim() || "";

  // Załadunki = unikalne locationNameSnapshot z LOADING stops
  const loadings = [
    ...new Set(
      stops
        .filter((s) => s.kind === "LOADING" && s.locationNameSnapshot?.trim())
        .map((s) => s.locationNameSnapshot!.trim())
    ),
  ];

  // Data pierwszego załadunku DD/MM/YYYY
  let dateStr = "";
  if (order.firstLoadingDate) {
    const d = order.firstLoadingDate.slice(0, 10); // YYYY-MM-DD
    const [y, m, day] = d.split("-");
    dateStr = `${day}/${m}/${y}`;
  }

  // Składanie: pomijamy puste segmenty
  const parts: string[] = [orderNo];
  if (receivers.length > 0) parts.push(`-${receivers.join("+")}`);
  if (carrier) parts.push(carrier);
  if (loadings.length > 0) parts.push(loadings.join("+"));
  if (dateStr) parts.push(`zał. ${dateStr}`);

  return parts.join(" - ");
}

/**
 * Domyślne body HTML draftu — zwięzły komunikat (user uzupełni / edytuje w Outlook).
 * Trzymane jako prosty HTML, bo Graph API obsługuje `contentType: "HTML"`.
 */
function buildDefaultBodyHtml(orderNo: string): string {
  return `<p>Dzień dobry,</p><p>W załączniku zlecenie transportowe nr <strong>${escapeHtml(orderNo)}</strong>.</p><p>Pozdrawiamy</p>`;
}

/** Minimalny escape HTML — chroni przed ostrzeżeniami od Graph przy znakach typu &, <, >. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pełna budowa contentu emaila: temat + body + PDF base64 + nazwa pliku.
 *
 * @param supabase — klient Supabase (potrzebny dla resolvePdfData)
 * @param detail — `OrderDetailResponseDto` z order-detail.service
 * @returns `OrderEmailContent` gotowy do przekazania do Graph API / EML builder
 */
export async function buildOrderEmailContent(
  supabase: SupabaseClient<Database>,
  detail: OrderDetailResponseDto
): Promise<OrderEmailContent> {
  const pdfInput = await resolvePdfData(supabase, detail);
  const pdfBuffer = generateOrderPdf(pdfInput);
  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

  // Allowlist znaków w nazwie pliku — alfanumeryczne + kropka, myślnik, podkreślnik.
  const sanitizedOrderNo = (detail.order.orderNo || "zlecenie").replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );
  const attachmentFilename = `zlecenie-${sanitizedOrderNo}.pdf`;

  const subject = buildEmailSubject(detail);
  const bodyHtml = buildDefaultBodyHtml(detail.order.orderNo);

  return {
    to: "", // Brak adresu odbiorcy w DB → user uzupełnia w Outlook
    subject,
    bodyHtml,
    attachmentBase64: pdfBase64,
    attachmentFilename,
    orderNo: detail.order.orderNo,
  };
}

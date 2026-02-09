import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { OrderDetailResponseDto } from "../../types";
import { getOrderById } from "./order.service";
import type { OrderPdfData } from "../pdf/order-pdf-template";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Supabase Storage bucket name for cached order PDFs */
const PDF_BUCKET = "order-pdfs";

// ---------------------------------------------------------------------------
// Helpers — resolve additional display data for PDF
// ---------------------------------------------------------------------------

/**
 * Resolves additional display names needed for the PDF template
 * that are not part of the standard OrderDetailDto.
 */
async function resolveDisplayData(
  supabase: SupabaseClient<Database>,
  order: OrderDetailResponseDto
): Promise<OrderPdfData["resolved"]> {
  const header = order.order;

  // Fetch transport type name, vehicle variant info, and carrier NIP in parallel
  const [transportType, vehicleVariant, carrier, senderProfile] =
    await Promise.all([
      supabase
        .from("transport_types")
        .select("name")
        .eq("code", header.transportTypeCode)
        .single(),
      supabase
        .from("vehicle_variants")
        .select("name, description")
        .eq("code", header.vehicleVariantCode)
        .single(),
      header.carrierCompanyId
        ? supabase
            .from("companies")
            .select("tax_id")
            .eq("id", header.carrierCompanyId)
            .single()
        : Promise.resolve({ data: null }),
      header.createdByUserId
        ? supabase
            .from("user_profiles")
            .select("full_name, email, phone")
            .eq("id", header.createdByUserId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  return {
    transportTypeName: transportType.data?.name ?? "",
    vehicleVariantName: vehicleVariant.data?.name ?? "",
    vehicleVariantDescription: vehicleVariant.data?.description ?? null,
    carrierNip: carrier.data?.tax_id ?? null,
    senderFullName: senderProfile.data?.full_name ?? null,
    senderEmail: senderProfile.data?.email ?? null,
    senderPhone: senderProfile.data?.phone ?? null,
  };
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

/**
 * Generates a PDF document for the given transport order.
 *
 * Flow:
 * 1. Fetch full order data (header + stops + items).
 * 2. If `regenerate` is false, check Supabase Storage cache.
 * 3. If cached PDF exists → return it.
 * 4. Otherwise, render the PDF using @react-pdf/renderer.
 * 5. Upload generated PDF to Supabase Storage for caching.
 * 6. Return binary PDF data + filename.
 *
 * @returns Object with buffer, filename, and contentType; or an error object.
 */
export async function generateOrderPdf(
  supabase: SupabaseClient<Database>,
  orderId: string,
  regenerate = false
): Promise<
  | { buffer: Buffer; fileName: string; contentType: string }
  | { error: string; status: number }
> {
  // 1. Fetch full order data
  const orderData = await getOrderById(supabase, orderId);

  if (!orderData) {
    return { error: "NOT_FOUND", status: 404 };
  }

  const fileName = `${orderData.order.orderNo.replace(/\//g, "-")}.pdf`;
  const storagePath = `${orderId}/${fileName}`;

  // 2. Check cache (unless forced regeneration)
  if (!regenerate) {
    try {
      const { data: cachedFile } = await supabase.storage
        .from(PDF_BUCKET)
        .download(storagePath);

      if (cachedFile) {
        const arrayBuffer = await cachedFile.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          fileName,
          contentType: "application/pdf",
        };
      }
    } catch {
      // Cache miss — proceed with generation
    }
  }

  // 3. Resolve additional display data for the template
  const resolved = await resolveDisplayData(supabase, orderData);

  const pdfData: OrderPdfData = {
    order: orderData.order,
    stops: orderData.stops,
    items: orderData.items,
    resolved,
  };

  // 4. Render PDF using @react-pdf/renderer (dynamic import for server-side)
  //    Using dynamic import to avoid issues with SSR bundling.
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { OrderPdfDocument } = await import("../pdf/order-pdf-template");
  const React = await import("react");

  // Create the React element and cast to the type expected by renderToBuffer.
  // @react-pdf/renderer expects ReactElement<DocumentProps> but our wrapper
  // component returns a <Document> internally — the cast is safe.
  const element = React.createElement(OrderPdfDocument, { data: pdfData });
  const pdfBuffer = await renderToBuffer(
    element as unknown as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  // Convert Uint8Array to Buffer
  const buffer = Buffer.from(pdfBuffer);

  // 5. Upload to Supabase Storage for caching (fire-and-forget — don't block response)
  void supabase.storage
    .from(PDF_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    })
    .catch(() => {
      // Silently ignore cache upload errors — PDF was already generated
    });

  // 6. Return binary data
  return {
    buffer,
    fileName,
    contentType: "application/pdf",
  };
}

/**
 * Schematy Zod dla endpointów raportu magazynowego.
 */

import { z } from "zod";

/** Body POST /api/v1/warehouse/report/pdf. */
export const warehouseReportPdfSchema = z.object({
  week: z.coerce.number().int().min(1).max(53),
  year: z.coerce.number().int().min(2020).max(2099),
  locationId: z.string().uuid().optional(),
});

export type WarehouseReportPdfParams = z.infer<typeof warehouseReportPdfSchema>;

/** Body POST /api/v1/warehouse/report/send-email. */
export const warehouseReportSendEmailSchema = warehouseReportPdfSchema.extend({
  outputFormat: z.enum(["eml", "pdf-base64"]).default("eml"),
});

export type WarehouseReportSendEmailParams = z.infer<typeof warehouseReportSendEmailSchema>;

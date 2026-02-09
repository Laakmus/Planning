import { z } from "zod";

/**
 * Zod schema for POST /api/v1/orders request body.
 *
 * Creates a draft order (status ROB). Most fields are optional because
 * draft orders can be incomplete — full business validation happens only
 * at the prepare-email step.
 */

const createOrderStopSchema = z.object({
  kind: z.enum(["LOADING", "UNLOADING"]),
  dateLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD")
    .nullable()
    .optional(),
  timeLocal: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format czasu: HH:MM lub HH:MM:SS")
    .nullable()
    .optional(),
  locationId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const createOrderItemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  productNameSnapshot: z.string().max(200).nullable().optional(),
  quantityTons: z.number().min(0, "Ilość nie może być ujemna").nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const createOrderSchema = z.object({
  transportTypeCode: z.enum(["PL", "EXP", "EXP_K", "IMP"]),
  currencyCode: z.enum(["PLN", "EUR", "USD"]),
  vehicleVariantCode: z.string().min(1, "Wariant pojazdu jest wymagany"),
  carrierCompanyId: z.string().uuid().nullable().optional(),
  shipperLocationId: z.string().uuid().nullable().optional(),
  receiverLocationId: z.string().uuid().nullable().optional(),
  priceAmount: z.number().min(0).nullable().optional(),
  paymentTermDays: z.number().int().min(0).nullable().optional(),
  paymentMethod: z.string().max(100).nullable().optional(),
  totalLoadTons: z.number().min(0).nullable().optional(),
  totalLoadVolumeM3: z.number().min(0).nullable().optional(),
  specialRequirements: z.string().max(1000).nullable().optional(),
  requiredDocumentsText: z.string().max(500).nullable().optional(),
  generalNotes: z.string().max(1000).nullable().optional(),
  senderContactName: z.string().max(200).nullable().optional(),
  senderContactPhone: z.string().max(50).nullable().optional(),
  senderContactEmail: z.string().email().max(200).nullable().optional(),
  stops: z.array(createOrderStopSchema).optional().default([]),
  items: z.array(createOrderItemSchema).optional().default([]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

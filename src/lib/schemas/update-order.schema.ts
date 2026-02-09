import { z } from "zod";

/**
 * Zod schema for PUT /api/v1/orders/{orderId} request body.
 *
 * Full update of the order. Stops and items use id/_deleted convention:
 * - id: null → new record (server creates)
 * - id: uuid + _deleted: true → delete existing
 * - id: uuid + _deleted: false/undefined → update existing
 */

const updateOrderStopSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  kind: z.enum(["LOADING", "UNLOADING"]),
  sequenceNo: z.number().int().min(1),
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
  _deleted: z.boolean().optional().default(false),
});

const updateOrderItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  productNameSnapshot: z.string().max(200).nullable().optional(),
  quantityTons: z.number().min(0, "Ilość nie może być ujemna").nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  _deleted: z.boolean().optional().default(false),
});

export const updateOrderSchema = z
  .object({
    transportTypeCode: z.enum(["PL", "EXP", "EXP_K", "IMP"]),
    currencyCode: z.enum(["PLN", "EUR", "USD"]),
    vehicleVariantCode: z.string().min(1, "Wariant pojazdu jest wymagany"),
    priceAmount: z.number().min(0).nullable().optional(),
    paymentTermDays: z.number().int().min(0).nullable().optional(),
    paymentMethod: z.string().max(100).nullable().optional(),
    totalLoadTons: z.number().min(0).nullable().optional(),
    totalLoadVolumeM3: z.number().min(0).nullable().optional(),
    carrierCompanyId: z.string().uuid().nullable().optional(),
    shipperLocationId: z.string().uuid().nullable().optional(),
    receiverLocationId: z.string().uuid().nullable().optional(),
    specialRequirements: z.string().max(1000).nullable().optional(),
    requiredDocumentsText: z.string().max(500).nullable().optional(),
    generalNotes: z.string().max(1000).nullable().optional(),
    complaintReason: z.string().max(1000).nullable().optional(),
    senderContactName: z.string().max(200).nullable().optional(),
    senderContactPhone: z.string().max(50).nullable().optional(),
    senderContactEmail: z.string().email().max(200).nullable().optional(),
    stops: z.array(updateOrderStopSchema).optional(),
    items: z.array(updateOrderItemSchema).optional(),
  })
  .refine(
    (data) => {
      if (!data.stops) return true;
      // Filter out deleted stops for limit check
      const activeStops = data.stops.filter((s) => !s._deleted);
      const loadingCount = activeStops.filter((s) => s.kind === "LOADING").length;
      const unloadingCount = activeStops.filter((s) => s.kind === "UNLOADING").length;
      return loadingCount <= 8 && unloadingCount <= 3;
    },
    {
      message: "Maksymalnie 8 punktów załadunku i 3 punkty rozładunku",
      path: ["stops"],
    }
  );

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

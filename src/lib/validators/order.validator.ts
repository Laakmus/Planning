/**
 * Schematy Zod dla zleceń (lista, tworzenie, aktualizacja, status).
 */

import { z } from "zod";

import { isoDateSchema, isoTimeSchema } from "./common.validator";

/** Dozwolone kody statusu zlecenia (order_statuses.code). */
const orderStatusCodeEnum = z.enum([
  "robocze",
  "wysłane",
  "korekta",
  "korekta wysłane",
  "zrealizowane",
  "reklamacja",
  "anulowane",
]);

export const orderListQuerySchema = z.object({
  view: z.enum(["CURRENT", "COMPLETED", "CANCELLED"]).default("CURRENT"),
  status: z
    .union([orderStatusCodeEnum, z.array(orderStatusCodeEnum).min(1)])
    .optional(),
  transportType: z.enum(["PL", "EXP", "EXP_K", "IMP"]).optional(),
  carrierId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  loadingLocationId: z.string().uuid().optional(),
  loadingCompanyId: z.string().uuid().optional(),
  unloadingLocationId: z.string().uuid().optional(),
  unloadingCompanyId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  sortBy: z
    .enum([
      "FIRST_LOADING_DATETIME",
      "FIRST_UNLOADING_DATETIME",
      "ORDER_NO",
      "CARRIER_NAME",
    ])
    .default("FIRST_LOADING_DATETIME"),
  sortDirection: z.enum(["ASC", "DESC"]).default("ASC"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type OrderListQueryParams = z.infer<typeof orderListQuerySchema>;

/** Body POST /api/v1/orders/{orderId}/status — ręczna zmiana statusu. */
export const changeStatusSchema = z
  .object({
    newStatusCode: z.enum(["zrealizowane", "reklamacja", "anulowane"]),
    complaintReason: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) =>
      data.newStatusCode !== "reklamacja" ||
      (data.complaintReason != null && String(data.complaintReason).trim().length > 0),
    { message: "complaintReason jest wymagane dla statusu reklamacja", path: ["complaintReason"] }
  );

export type ChangeStatusParams = z.infer<typeof changeStatusSchema>;

/** Jedna pozycja trasy przy tworzeniu zlecenia. */
export const createOrderStopSchema = z.object({
  kind: z.enum(["LOADING", "UNLOADING"]),
  dateLocal: isoDateSchema.nullable(),
  timeLocal: isoTimeSchema.nullable(),
  locationId: z.string().uuid().nullable(),
  notes: z.string().max(500).nullable(),
});

/** Jedna pozycja towarowa przy tworzeniu zlecenia. */
export const createOrderItemSchema = z.object({
  productId: z.string().uuid().nullable(),
  productNameSnapshot: z.string().max(500).nullable(),
  loadingMethodCode: z
    .enum(["PALETA", "PALETA_BIGBAG", "LUZEM", "KOSZE"])
    .nullable()
    .optional(),
  quantityTons: z.number().nonnegative().nullable(),
  notes: z.string().max(500).nullable(),
});

/** Body POST /api/v1/orders — tworzenie zlecenia (wersja robocza). */
export const createOrderSchema = z.object({
  transportTypeCode: z.enum(["PL", "EXP", "EXP_K", "IMP"]),
  currencyCode: z.enum(["PLN", "EUR", "USD"]),
  carrierCompanyId: z.string().uuid().nullable(),
  shipperLocationId: z.string().uuid().nullable(),
  receiverLocationId: z.string().uuid().nullable(),
  vehicleVariantCode: z.string().min(1).nullable(),
  priceAmount: z.number().nonnegative().nullable(),
  paymentTermDays: z.number().int().nonnegative().nullable(),
  paymentMethod: z.string().max(100).nullable(),
  totalLoadTons: z.number().nonnegative().nullable(),
  totalLoadVolumeM3: z.number().nonnegative().nullable(),
  specialRequirements: z.string().max(500).nullable(),
  requiredDocumentsText: z.string().max(500).nullable(),
  generalNotes: z.string().max(500).nullable(),
  senderContactName: z.string().max(200).nullable(),
  senderContactPhone: z.string().max(100).nullable(),
  senderContactEmail: z.string().max(320).email().nullable(),
  stops: z.array(createOrderStopSchema).min(1).max(11),
  items: z.array(createOrderItemSchema).max(50),
});

export type CreateOrderParams = z.infer<typeof createOrderSchema>;

/** Jedna pozycja trasy przy aktualizacji (PUT) — id = null oznacza nowy, _deleted = true usuwa. */
export const updateOrderStopSchema = createOrderStopSchema.extend({
  id: z.string().uuid().nullable(),
  sequenceNo: z.number().int().min(1),
  _deleted: z.boolean(),
});

/** Jedna pozycja towarowa przy aktualizacji (PUT) — id = null nowy, _deleted = true usuwa. */
export const updateOrderItemSchema = createOrderItemSchema.extend({
  id: z.string().uuid().nullable(),
  _deleted: z.boolean(),
});

/** Body PUT /api/v1/orders/{orderId} — pełna aktualizacja zlecenia. */
export const updateOrderSchema = createOrderSchema.extend({
  vehicleVariantCode: z.string().min(1).nullable(),
  generalNotes: z.string().max(500).nullable(),
  complaintReason: z.string().max(500).nullable().optional(),
  stops: z.array(updateOrderStopSchema).min(1).max(11),
  items: z.array(updateOrderItemSchema).max(50),
});

export type UpdateOrderParams = z.infer<typeof updateOrderSchema>;

/** Body POST /api/v1/orders/{orderId}/duplicate. */
export const duplicateOrderSchema = z.object({
  includeStops: z.boolean(),
  includeItems: z.boolean(),
  resetStatusToDraft: z.boolean(),
});

export type DuplicateOrderParams = z.infer<typeof duplicateOrderSchema>;

/** Body POST /api/v1/orders/{orderId}/prepare-email. */
export const prepareEmailSchema = z.object({
  forceRegeneratePdf: z.boolean().optional().default(false),
});

export type PrepareEmailParams = z.infer<typeof prepareEmailSchema>;

/** Body POST /api/v1/orders/{orderId}/pdf. */
export const generatePdfSchema = z.object({
  regenerate: z.boolean().optional().default(false),
});

export type GeneratePdfParams = z.infer<typeof generatePdfSchema>;

/** Body PATCH /api/v1/orders/{orderId}/stops/{stopId} — wszystkie pola opcjonalne. */
export const patchStopSchema = z.object({
  kind: z.enum(["LOADING", "UNLOADING"]).optional(),
  dateLocal: isoDateSchema.nullable().optional(),
  timeLocal: isoTimeSchema.nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type PatchStopParams = z.infer<typeof patchStopSchema>;

/** Body POST /api/v1/dictionary-sync/run. */
export const dictionarySyncSchema = z.object({
  resources: z.array(z.enum(["COMPANIES", "LOCATIONS", "PRODUCTS"])).min(1),
});

export type DictionarySyncParams = z.infer<typeof dictionarySyncSchema>;

/** Allowed carrier cell colors (hex). */
export const ALLOWED_CARRIER_CELL_COLORS = [
  "#48A111",
  "#25671E",
  "#FFEF5F",
  "#EEA727",
] as const;

/** Body PATCH /api/v1/orders/{orderId}/carrier-color. */
export const carrierCellColorSchema = z.object({
  color: z.enum(ALLOWED_CARRIER_CELL_COLORS).nullable(),
});

export type CarrierCellColorParams = z.infer<typeof carrierCellColorSchema>;

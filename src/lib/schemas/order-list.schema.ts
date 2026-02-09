import { z } from "zod";

/**
 * Zod schema for GET /api/v1/orders query parameters.
 *
 * All params come as strings from URL search params — the schema
 * coerces numbers, validates enums, and sets defaults.
 */
export const orderListQuerySchema = z.object({
  view: z
    .enum(["CURRENT", "COMPLETED", "CANCELLED"])
    .optional()
    .default("CURRENT"),

  // status can appear multiple times: ?status=ROB&status=WYS
  // We handle this separately in the route (searchParams.getAll)
  status: z
    .union([
      z.enum(["ROB", "WYS", "KOR", "KOR_WYS", "ZRE", "ANL", "REK"]),
      z.array(
        z.enum(["ROB", "WYS", "KOR", "KOR_WYS", "ZRE", "ANL", "REK"])
      ),
    ])
    .optional(),

  transportType: z.enum(["PL", "EXP", "EXP_K", "IMP"]).optional(),

  carrierId: z.string().uuid().optional(),

  productId: z.string().uuid().optional(),

  loadingLocationId: z.string().uuid().optional(),

  unloadingLocationId: z.string().uuid().optional(),

  search: z.string().max(200).optional(),

  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD")
    .optional(),

  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD")
    .optional(),

  sortBy: z
    .enum([
      "FIRST_LOADING_DATETIME",
      "FIRST_UNLOADING_DATETIME",
      "ORDER_NO",
      "CARRIER_NAME",
    ])
    .optional()
    .default("FIRST_LOADING_DATETIME"),

  sortDirection: z.enum(["ASC", "DESC"]).optional().default("ASC"),

  page: z.coerce.number().int().min(1).optional().default(1),

  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type OrderListQueryInput = z.infer<typeof orderListQuerySchema>;

import { z } from "zod";

/**
 * Zod schema for POST /api/v1/orders/{orderId}/duplicate request body.
 *
 * All fields are optional with sensible defaults (all true).
 * An empty body `{}` results in a full copy including stops and items.
 */
export const duplicateOrderSchema = z.object({
  includeStops: z.boolean().optional().default(true),
  includeItems: z.boolean().optional().default(true),
  resetStatusToDraft: z.boolean().optional().default(true),
});

export type DuplicateOrderInput = z.infer<typeof duplicateOrderSchema>;

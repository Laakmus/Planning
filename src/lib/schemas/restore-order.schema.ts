import { z } from "zod";

/**
 * Zod schema for POST /api/v1/orders/{orderId}/restore request body.
 *
 * Validates the restore command. Only ROB and WYS are valid target statuses
 * when restoring an order from COMPLETED (ZRE) or CANCELLED (ANL) tab.
 */
export const restoreOrderSchema = z.object({
  targetStatusCode: z.enum(["ROB", "WYS"], {
    required_error: "Docelowy status jest wymagany",
    invalid_type_error: "Dozwolone statusy docelowe: ROB, WYS",
  }),
});

export type RestoreOrderInput = z.infer<typeof restoreOrderSchema>;

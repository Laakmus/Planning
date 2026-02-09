import { z } from "zod";

/**
 * Zod schema for POST /api/v1/orders/{orderId}/prepare-email request body.
 *
 * All fields are optional — an empty body `{}` is valid (defaults apply).
 */
export const prepareEmailSchema = z
  .object({
    forceRegeneratePdf: z.boolean().optional().default(false),
  })
  .optional()
  .default({});

export type PrepareEmailInput = z.infer<typeof prepareEmailSchema>;

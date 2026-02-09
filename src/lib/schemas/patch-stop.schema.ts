import { z } from "zod";

/**
 * Zod schema for PATCH /api/v1/orders/{orderId}/stops/{stopId} request body.
 *
 * Partial update — all fields are optional, but at least one must be provided.
 * This ensures that empty PATCH requests are rejected.
 */
export const patchStopSchema = z
  .object({
    dateLocal: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD")
      .optional(),
    timeLocal: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format czasu: HH:MM lub HH:MM:SS")
      .optional(),
    locationId: z.string().uuid("locationId musi być poprawnym UUID").optional(),
    notes: z.string().max(500, "Notatki nie mogą przekraczać 500 znaków").optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    {
      message: "Wymagane jest co najmniej jedno pole do aktualizacji",
    }
  );

export type PatchStopInput = z.infer<typeof patchStopSchema>;

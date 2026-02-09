import { z } from "zod";

/**
 * Zod schema for POST /api/v1/orders/{orderId}/status request body.
 *
 * Validates the manual status-change command. Only statuses that can be
 * set manually are allowed (ROB, ZRE, REK, ANL). Statuses WYS, KOR,
 * KOR_WYS are set automatically by prepare-email / edit auto-transition.
 *
 * When newStatusCode is "REK" (complaint), complaintReason is required
 * and must be a non-empty string.
 */
export const changeStatusSchema = z
  .object({
    newStatusCode: z.enum(["ROB", "ZRE", "REK", "ANL"], {
      required_error: "Docelowy status jest wymagany",
      invalid_type_error: "Nieprawidłowy kod statusu",
    }),
    complaintReason: z
      .string()
      .min(1, "Powód reklamacji nie może być pusty")
      .max(1000, "Powód reklamacji nie może przekraczać 1000 znaków")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      // When setting status to REK, complaintReason is mandatory
      if (data.newStatusCode === "REK") {
        return data.complaintReason != null && data.complaintReason.length > 0;
      }
      return true;
    },
    {
      message: "Powód reklamacji jest wymagany przy statusie REK",
      path: ["complaintReason"],
    }
  );

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

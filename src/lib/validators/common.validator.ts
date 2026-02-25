/**
 * Wspólne schematy Zod używane w API (UUID, paginacja, formaty daty/czasu).
 */

import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** Format YYYY-MM-DD z walidacją zakresu (miesiąc 1-12, dzień 1-31, poprawność kalendarza). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Wymagany format YYYY-MM-DD")
  .refine((val) => {
    const [y, m, d] = val.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }, "Nieprawidłowa data");

/** Format HH:MM lub HH:MM:SS z walidacją zakresu (0-23h, 0-59min, 0-59s). */
export const isoTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Wymagany format HH:MM lub HH:MM:SS")
  .refine((val) => {
    const p = val.split(":").map(Number);
    return p[0] <= 23 && p[1] <= 59 && (p[2] === undefined || p[2] <= 59);
  }, "Nieprawidłowy czas");

/**
 * Wspólne schematy Zod używane w API (UUID, paginacja, formaty daty/czasu).
 */

import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** Format YYYY-MM-DD. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Format HH:MM:SS. */
export const isoTimeSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);

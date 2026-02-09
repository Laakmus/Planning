import { z } from "zod";

/**
 * Query params shared by dictionary endpoints that support autocomplete search.
 * Used by: companies, locations, products
 */
export const dictionarySearchSchema = z.object({
  search: z.string().optional(),
  activeOnly: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((v) => v === "true"),
});

/**
 * Extended query params for the locations endpoint.
 * Adds companyId filter on top of search + activeOnly.
 */
export const locationSearchSchema = dictionarySearchSchema.extend({
  companyId: z.string().uuid().optional(),
});

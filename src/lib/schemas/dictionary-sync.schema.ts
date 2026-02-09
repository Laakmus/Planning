import { z } from "zod";

/**
 * Zod schema for POST /api/v1/dictionary-sync/run request body.
 *
 * Validates the dictionary synchronization command. The `resources` array
 * must contain at least one valid resource type to synchronize.
 */
export const dictionarySyncSchema = z.object({
  resources: z
    .array(
      z.enum(["COMPANIES", "LOCATIONS", "PRODUCTS"], {
        invalid_type_error:
          "Nieprawidłowy typ zasobu. Dozwolone: COMPANIES, LOCATIONS, PRODUCTS",
      })
    )
    .min(1, "Lista zasobów do synchronizacji nie może być pusta"),
});

export type DictionarySyncInput = z.infer<typeof dictionarySyncSchema>;

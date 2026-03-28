/**
 * Sekcja operacji bez przypisanej daty.
 */

import type { WarehouseOrderEntryDto } from "@/types";
import { OperationsTable } from "./OperationsTable";

interface NoDateSectionProps {
  entries: WarehouseOrderEntryDto[];
}

export function NoDateSection({ entries }: NoDateSectionProps) {
  return (
    <div className="rounded-xl border bg-card p-4 border-dashed border-orange-300 dark:border-orange-700">
      <h2 className="text-lg font-semibold mb-3 text-orange-600 dark:text-orange-400">
        Bez przypisanej daty
      </h2>
      <OperationsTable entries={entries} hideTimeColumn />
    </div>
  );
}

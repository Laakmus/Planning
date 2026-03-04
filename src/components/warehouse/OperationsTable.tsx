/**
 * Tabela operacji magazynowych (załadunki/rozładunki) w ramach jednego dnia.
 */

import type { WarehouseOrderEntryDto } from "@/types";
import { OperationRow } from "./OperationRow";

interface OperationsTableProps {
  entries: WarehouseOrderEntryDto[];
  hideTimeColumn?: boolean;
}

export function OperationsTable({ entries, hideTimeColumn }: OperationsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-[13px]">
        <thead className="sticky top-0 z-10 bg-slate-50/50 dark:bg-slate-800/30 font-semibold border-b border-slate-100 dark:border-slate-800">
          <tr className="text-left text-muted-foreground">
            <th className="w-[6%] py-2 px-2 text-center">Typ</th>
            {!hideTimeColumn && <th className="w-[7%] py-2 px-2">Godzina</th>}
            <th className="w-[10%] py-2 px-2">Nr zlecenia</th>
            <th className="w-[32%] py-2 px-2">Towar / Masa</th>
            <th className="w-[22%] py-2 px-2">Przewoźnik</th>
            <th className="w-[23%] py-2 px-2">Awizacja</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((entry, idx) => (
            <OperationRow key={`${entry.orderId}-${entry.stopType}-${idx}`} entry={entry} hideTimeColumn={hideTimeColumn} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

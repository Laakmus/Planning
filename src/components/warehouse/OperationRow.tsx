/**
 * Wiersz tabeli operacji — typ, godzina, nr zlecenia, towar, przewoźnik, awizacja.
 */

import type { WarehouseOrderEntryDto } from "@/types";
import { OperationTypeBadge } from "./OperationTypeBadge";
import { CargoCell } from "./CargoCell";
import { DispatchInfoCell } from "./DispatchInfoCell";

interface OperationRowProps {
  entry: WarehouseOrderEntryDto;
  hideTimeColumn?: boolean;
}

export function OperationRow({ entry, hideTimeColumn }: OperationRowProps) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
      <td className="py-1.5 px-2 text-center">
        <OperationTypeBadge type={entry.stopType} />
      </td>
      {!hideTimeColumn && (
        <td className={`py-1.5 px-2 text-sm font-bold ${entry.stopType === "LOADING" ? "text-blue-700 dark:text-blue-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {entry.timeLocal ?? "\u2014"}
          {entry.isWeekend && entry.originalDate && (
            <div className="text-[10px] font-normal text-muted-foreground">
              ({new Date(entry.originalDate).getDay() === 6 ? "sob" : "niedz"}. {entry.originalDate.slice(8, 10)}.{entry.originalDate.slice(5, 7)})
            </div>
          )}
        </td>
      )}
      <td className="py-1.5 px-2 text-sm font-medium">
        {entry.orderNo}
      </td>
      <td className="py-1.5 px-2">
        <CargoCell items={entry.items} totalWeightTons={entry.totalWeightTons} stopType={entry.stopType} />
      </td>
      <td className="py-1.5 px-2 text-sm leading-relaxed">
        <div className="font-bold">{entry.carrierName ?? "\u2014"}</div>
        {entry.vehicleType && (
          <div className="text-xs text-muted-foreground">{entry.vehicleType}</div>
        )}
      </td>
      <td className="py-1.5 px-2 leading-relaxed">
        <DispatchInfoCell entry={entry} />
      </td>
    </tr>
  );
}

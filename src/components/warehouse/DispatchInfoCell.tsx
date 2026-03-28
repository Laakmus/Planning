/**
 * Komórka awizacji — wyświetla notificationDetails jako tekst wieloliniowy.
 */

import type { WarehouseOrderEntryDto } from "@/types";

interface DispatchInfoCellProps {
  entry: WarehouseOrderEntryDto;
}

export function DispatchInfoCell({ entry }: DispatchInfoCellProps) {
  if (!entry.notificationDetails) {
    return <span className="text-[10px] text-muted-foreground">{"\u2014"}</span>;
  }

  const lines = entry.notificationDetails.split("\n").filter(Boolean);

  if (lines.length === 0) {
    return <span className="text-[10px] text-muted-foreground">{"\u2014"}</span>;
  }

  return (
    <div className="space-y-0">
      {lines.map((line, idx) => (
        <div key={idx} className={`text-[10px] text-muted-foreground leading-tight ${idx === 0 ? "font-medium" : ""}`}>
          {line}
        </div>
      ))}
    </div>
  );
}

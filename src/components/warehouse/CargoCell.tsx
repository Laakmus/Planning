/**
 * Komórka towaru — lista produktów + podsumowanie wagi.
 */

import type { WarehouseItemDto } from "@/types";

interface CargoCellProps {
  items: WarehouseItemDto[];
  totalWeightTons: number | null;
  stopType: "LOADING" | "UNLOADING";
}

export function CargoCell({ items, totalWeightTons, stopType }: CargoCellProps) {
  // Kolor podsumowania zależy od typu operacji
  // Zał (LOADING) = niebieski, Roz (UNLOADING) = zielony (spec §6.1)
  const totalColorClass = stopType === "LOADING"
    ? "text-blue-700 dark:text-blue-300"
    : "text-emerald-700 dark:text-emerald-300";

  return (
    <div className="space-y-0.5">
      {items.map((item, idx) => (
        <div key={idx}>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.productName}</span>
          {item.loadingMethod && (
            <span className="text-[10px] text-muted-foreground ml-1">({item.loadingMethod})</span>
          )}
          {item.weightTons != null && (
            <span className="text-[10px] text-muted-foreground ml-1">{item.weightTons} t</span>
          )}
        </div>
      ))}
      {totalWeightTons != null && (
        <div className={`text-xs font-bold mt-1 ${totalColorClass}`}>
          Razem: {totalWeightTons.toFixed(1).replace('.', ',')} t
        </div>
      )}
    </div>
  );
}

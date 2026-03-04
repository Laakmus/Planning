/**
 * Karta jednego dnia — nagłówek z nazwą dnia i datą + tabela operacji.
 */

import type { WarehouseDayDto } from "@/types";
import { OperationsTable } from "./OperationsTable";
import { EmptyDayMessage } from "./EmptyDayMessage";

interface DayCardProps {
  day: WarehouseDayDto;
}

/** Formatuj datę YYYY-MM-DD na DD.MM.YYYY */
function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function DayCard({ day }: DayCardProps) {
  return (
    <div className="rounded-xl border shadow-sm overflow-hidden bg-card print:break-inside-avoid print:shadow-none">
      <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-2 border-b">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          {day.dayName} {formatDate(day.date)}
        </h2>
      </div>
      {day.entries.length > 0 ? (
        <OperationsTable entries={day.entries} />
      ) : (
        <EmptyDayMessage />
      )}
    </div>
  );
}

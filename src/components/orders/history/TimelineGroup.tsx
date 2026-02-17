/**
 * Grupa wpisów historii pogrupowana według daty.
 * Nagłówek: "Dzisiaj" / "Wczoraj" / "d mmm yyyy".
 */

import type { TimelineEntryViewModel } from "@/lib/view-models";

import { TimelineEntry } from "./TimelineEntry";

interface TimelineGroupProps {
  date: string; // YYYY-MM-DD
  entries: TimelineEntryViewModel[];
}

/** Formatuje datę do polskiej etykiety nagłówka grupy */
function formatGroupDate(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const d = new Date(isoDate + "T00:00:00");

  if (d.getTime() === today.getTime()) return "Dzisiaj";
  if (d.getTime() === yesterday.getTime()) return "Wczoraj";

  // Formatowanie: "8 lut 2026"
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

export function TimelineGroup({ date, entries }: TimelineGroupProps) {
  const label = formatGroupDate(date);
  const isToday = label === "Dzisiaj";

  return (
    <div className="mb-8">
      {/* Nagłówek grupy */}
      <div className="flex items-center gap-4 mb-6">
        <span
          className={`text-xs font-bold uppercase tracking-wider ${
            isToday ? "text-primary/80" : "text-slate-400"
          }`}
        >
          {label}
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* Oś czasu z wpisami */}
      <div className="relative space-y-8">
        {/* Pionowa linia osi czasu */}
        <div className="absolute left-[17px] top-2 bottom-0 w-[2px] bg-slate-200 dark:bg-slate-800" />

        {entries.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

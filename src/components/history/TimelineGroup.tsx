import type { TimelineEntryViewModel } from "@/lib/view-models";
import { TimelineEntry } from "./TimelineEntry";

interface TimelineGroupProps {
  dateLabel: string;
  entries: TimelineEntryViewModel[];
}

/**
 * A group of timeline entries under a date label with horizontal line.
 * Matches test/history.html: "Dzisiaj" label + horizontal divider,
 * vertical timeline line, entries with larger avatars.
 */
export function TimelineGroup({ dateLabel, entries }: TimelineGroupProps) {
  const isToday = dateLabel === "Dzisiaj";

  return (
    <div className="mb-8">
      {/* Date header with horizontal line */}
      <div className="flex items-center gap-4 mb-6">
        <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-primary/80" : "text-slate-400"}`}>
          {dateLabel}
        </span>
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* Entries with vertical timeline line */}
      <div className="relative space-y-8">
        {/* Vertical line */}
        <div className="absolute left-[17px] top-2 bottom-0 w-[2px] bg-slate-200 dark:bg-slate-800" />

        {entries.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

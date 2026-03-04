/**
 * Nawigacja tygodniowa — strzałki, input numeru tygodnia, zakres dat.
 * Sticky top, widoczna przy przewijaniu.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WeekNavigationProps {
  week: number;
  year: number;
  weekStart: string | null;
  weekEnd: string | null;
  onPrev: () => void;
  onNext: () => void;
  onGoToWeek: (week: number) => void;
}

/** Formatuj datę YYYY-MM-DD na DD.MM */
function formatShortDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}`;
}

/** Formatuj datę YYYY-MM-DD na DD.MM.YYYY */
function formatFullDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function WeekNavigation({ week, year, weekStart, weekEnd, onPrev, onNext, onGoToWeek }: WeekNavigationProps) {
  const dateRange = weekStart && weekEnd
    ? `${formatShortDate(weekStart)} \u2013 ${formatFullDate(weekEnd)}`
    : "";

  return (
    <div className="sticky top-0 z-10 bg-background px-4 py-3 print:hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">
            Tydzień {week} {dateRange ? `| ${dateRange}` : ""}
          </h1>
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg shadow-sm border p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">Numer tygodnia</span>
            <Input
              type="number"
              min={1}
              max={53}
              value={week}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) onGoToWeek(v);
              }}
              className="h-10 w-16 text-sm text-center font-semibold"
            />
          </div>
          <span className="text-sm text-muted-foreground">{year}</span>
        </div>
      </div>
    </div>
  );
}

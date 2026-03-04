/**
 * Stopka podsumowania tygodnia — na dole layoutu, nie scrolluje się.
 */

interface WeekSummaryFooterProps {
  week: number;
  summary: {
    loadingCount: number;
    loadingTotalTons: number;
    unloadingCount: number;
    unloadingTotalTons: number;
  };
}

export function WeekSummaryFooter({ week, summary }: WeekSummaryFooterProps) {
  const totalTons = summary.loadingTotalTons + summary.unloadingTotalTons;

  return (
    <div className="border-t bg-background/95 backdrop-blur px-6 py-3 print:hidden">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Tydzień {week}:</span>
        <span>Załadunki:</span>
        <span className="font-bold text-blue-700 dark:text-blue-300">
          {summary.loadingCount} ({summary.loadingTotalTons.toFixed(1).replace('.', ',')} t)
        </span>
        <span>|</span>
        <span>Rozładunki:</span>
        <span className="font-bold text-emerald-700 dark:text-emerald-300">
          {summary.unloadingCount} ({summary.unloadingTotalTons.toFixed(1).replace('.', ',')} t)
        </span>
        <span>|</span>
        <span>Łącznie:</span>
        <span className="font-bold text-foreground">{totalTons.toFixed(1).replace('.', ',')} t</span>
      </div>
    </div>
  );
}

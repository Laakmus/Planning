import type { StopKind } from "@/types";

interface RouteStop {
  kind: StopKind;
  sequenceNo: number;
  cityCode: string;
}

interface RouteSummaryCellProps {
  /** Structured stops data for node-string visualization */
  stops?: RouteStop[];
  /** Pre-computed route summary string fallback, e.g. "Warszawa → Kraków" */
  summaryRoute?: string | null;
}

/**
 * Parses a summaryRoute string like "Warta → Poznań" or "KRK → BER"
 * into an array of route stops for display purposes.
 */
function parseSummaryRoute(route: string): RouteStop[] {
  const parts = route.split(/\s*→\s*/);
  const stops: RouteStop[] = [];
  let loadingSeq = 1;
  let unloadingSeq = 1;

  parts.forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    // Extract a short city code (first 3 uppercase letters)
    const cityCode = trimmed.slice(0, 3).toUpperCase();

    if (index < parts.length - 1) {
      // All but last are loading stops
      stops.push({ kind: "LOADING", sequenceNo: loadingSeq++, cityCode });
    } else {
      // Last is unloading stop
      stops.push({ kind: "UNLOADING", sequenceNo: unloadingSeq++, cityCode });
    }
  });

  return stops;
}

function RouteNode({ stop }: { stop: RouteStop }) {
  const isLoading = stop.kind === "LOADING";
  const prefix = isLoading ? "L" : "U";
  const label = `${prefix}${stop.sequenceNo}:${stop.cityCode}`;

  const dotColor = isLoading
    ? "bg-emerald-500 ring-2 ring-emerald-500/20"
    : "bg-primary ring-2 ring-primary/20";

  return (
    <span className="flex items-center space-x-1 z-10 relative">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
        {label}
      </span>
    </span>
  );
}

/**
 * Displays a route as a node-string visualization with colored dots.
 * Loading stops = emerald, Unloading stops = primary (blue).
 * Per UI Plan 6.2 and implementation plan 4.25.
 */
export function RouteSummaryCell({ stops, summaryRoute }: RouteSummaryCellProps) {
  // Use provided stops or parse from summaryRoute
  const routeStops = stops ?? (summaryRoute ? parseSummaryRoute(summaryRoute) : []);

  if (routeStops.length === 0) {
    return <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">—</span>;
  }

  return (
    <div className="flex items-center flex-wrap gap-y-1 gap-x-1.5">
      {routeStops.map((stop, index) => (
        <span key={`${stop.kind}-${stop.sequenceNo}`} className="flex items-center gap-x-1.5">
          <RouteNode stop={stop} />
          {index < routeStops.length - 1 && (
            <span className="text-slate-400 dark:text-slate-600 text-[12px]">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

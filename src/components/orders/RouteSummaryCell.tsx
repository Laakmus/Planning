/**
 * Wizualizacja trasy jako "node-string" (widok Trasa).
 * Format: L1:Nord → L2:Recykling → U1:BER
 * Max 4 węzły w linii; dłuższe trasy zawijają się do kolejnych linii (grupy po 4).
 *
 * Załadunki (L): bg-emerald-100 border border-emerald-500/30 text-emerald-700
 * Rozładunki (U): bg-blue-100 border border-blue-500/30 text-blue-700
 */

import { shortenName } from "@/lib/format-utils";
import type { OrderListStopDto } from "@/types";

interface RouteSummaryCellProps {
  stops: OrderListStopDto[];
}

const NODES_PER_LINE = 4;

export function RouteSummaryCell({ stops }: RouteSummaryCellProps) {
  if (!stops.length) {
    return <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>;
  }

  // Sortuj: LOADING zawsze przed UNLOADING, w ramach kind po sequenceNo
  const sorted = [...stops].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "LOADING" ? -1 : 1;
    return a.sequenceNo - b.sequenceNo;
  });
  let loadingCount = 0;
  let unloadingCount = 0;

  const nodes = sorted.map((stop) => {
    const isLoading = stop.kind === "LOADING";
    if (isLoading) loadingCount++;
    else unloadingCount++;

    const prefix = isLoading ? `L${loadingCount}` : `U${unloadingCount}`;
    const name = shortenName(stop.companyNameSnapshot ?? stop.locationNameSnapshot);
    const cls = isLoading
      ? "bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-500/30 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-400"
      : "bg-blue-100 dark:bg-blue-900/30 border border-blue-500/30 dark:border-blue-400/30 text-blue-700 dark:text-blue-400";

    return { prefix, name, cls };
  });

  // Podziel na grupy po NODES_PER_LINE
  const lines: typeof nodes[] = [];
  for (let i = 0; i < nodes.length; i += NODES_PER_LINE) {
    lines.push(nodes.slice(i, i + NODES_PER_LINE));
  }

  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => (
        <div key={lineIdx} className="flex items-center flex-nowrap gap-x-1">
          {line.map((node, nodeIdx) => {
            const globalIdx = lineIdx * NODES_PER_LINE + nodeIdx;
            const isLast = globalIdx === nodes.length - 1;
            return (
              <span key={nodeIdx} className="flex items-center gap-1">
                <span
                  className={`${node.cls} px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap`}
                >
                  {node.prefix}:{node.name}
                </span>
                {!isLast && (
                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">→</span>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

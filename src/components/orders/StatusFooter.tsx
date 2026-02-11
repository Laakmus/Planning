import type { OrderStatusCode } from "@/types";

interface StatusFooterProps {
  statusCounts: Record<string, number>;
  lastUpdateTime: string | null;
}

const STATUS_ITEMS: Array<{
  label: string;
  codes: OrderStatusCode[];
  valueColor: string;
}> = [
  { label: "Aktywne", codes: ["ROB", "WYS", "KOR", "KOR_WYS"], valueColor: "text-primary" },
  { label: "W trasie", codes: ["WYS"], valueColor: "text-amber-500" },
  { label: "Opóźnione", codes: ["REK"], valueColor: "text-red-500" },
  { label: "Zrealizowane", codes: ["ZRE"], valueColor: "text-emerald-500" },
];

/**
 * Sticky footer bar with status counts and system info.
 * Matches test/widok_main_skrot.html mockup footer.
 */
export function StatusFooter({ statusCounts, lastUpdateTime }: StatusFooterProps) {
  return (
    <footer className="shrink-0 h-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-30">
      {/* Left: status counts */}
      <div className="flex items-center space-x-6 text-[11px] font-medium">
        {STATUS_ITEMS.map((item) => {
          const count = item.codes.reduce(
            (sum, code) => sum + (statusCounts[code] || 0),
            0,
          );
          return (
            <div key={item.label} className="flex items-center space-x-2">
              <span className="text-slate-500">{item.label}:</span>
              <span className={`font-bold ${item.valueColor}`}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Right: system status + last update */}
      <div className="flex items-center space-x-4 text-[11px] font-medium">
        {lastUpdateTime && (
          <span className="text-slate-400">
            Aktualizacja: {lastUpdateTime}
          </span>
        )}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 relative">
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
          </div>
          <span className="text-emerald-500 uppercase tracking-tighter font-bold">
            System Live
          </span>
        </div>
      </div>
    </footer>
  );
}

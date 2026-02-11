import type { OrderStatusCode } from "@/types";

interface StatusBadgeProps {
  statusCode: OrderStatusCode;
  statusName: string;
  /** When true, display as rounded-full pill (used in columns view). Default: false (rounded tag). */
  pill?: boolean;
}

const STATUS_CONFIG: Record<
  OrderStatusCode,
  { style: string; pulse: boolean; pulseColor: string }
> = {
  ROB: { style: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600/30", pulse: false, pulseColor: "" },
  WYS: { style: "bg-primary/20 text-primary border border-primary/30", pulse: true, pulseColor: "bg-primary" },
  KOR: { style: "bg-orange-500/20 text-orange-500 border border-orange-500/30", pulse: false, pulseColor: "" },
  KOR_WYS: { style: "bg-teal-500/20 text-teal-500 border border-teal-500/30", pulse: false, pulseColor: "" },
  ZRE: { style: "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30", pulse: false, pulseColor: "" },
  ANL: { style: "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600/30", pulse: false, pulseColor: "" },
  REK: { style: "bg-red-500/20 text-red-500 border border-red-500/30", pulse: false, pulseColor: "" },
};

/**
 * Status badge with color-coded background and optional pulse dot.
 * Matches mockup: rounded tag with status code, border, and transparent bg.
 * Per UI Plan 6.4 — pulse animation for WYS status.
 */
export function StatusBadge({ statusCode, pill }: StatusBadgeProps) {
  const config = STATUS_CONFIG[statusCode] ?? STATUS_CONFIG.ROB;
  const shape = pill ? "rounded-full" : "rounded";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 ${shape} ${config.style}`}
    >
      {config.pulse && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.pulseColor} animate-pulse`}
        />
      )}
      {statusCode}
    </span>
  );
}

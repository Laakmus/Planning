/**
 * Badge statusu zlecenia.
 * BEZ animacji pulse — prosta etykieta z borderem i kolorem wg statusu.
 * Mapowanie: statusCode (pełna nazwa lowercase, np. "korekta wysłane") → klasy CSS.
 */

/** Mapowanie statusCode → klasy Tailwind CSS (plan implementacji §4.10). */
const STATUS_CLASSES: Record<string, string> = {
  robocze: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  wysłane: "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  korekta: "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
  "korekta wysłane": "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  zrealizowane: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  anulowane: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  reklamacja: "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
};

interface StatusBadgeProps {
  /** Techniczny kod statusu z API (lowercase, np. "korekta wysłane"). */
  statusCode: string;
  /** Pełna nazwa statusu do wyświetlenia (np. "Korekta wysłane"). */
  statusName: string;
}

export function StatusBadge({ statusCode, statusName }: StatusBadgeProps) {
  const colorCls = STATUS_CLASSES[statusCode] ?? "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${colorCls}`}
    >
      {statusName}
    </span>
  );
}

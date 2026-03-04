/**
 * Pasek legendy — kolory załadunków i rozładunków.
 */

export function OperationLegend() {
  return (
    <div className="px-4 py-2 flex items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="size-3 rounded-full bg-blue-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Załadunki</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="size-3 rounded-full bg-emerald-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Rozładunki</span>
      </div>
    </div>
  );
}

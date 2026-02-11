import type { ViewGroup } from "@/types";

interface OrderTabsProps {
  activeView: ViewGroup;
  onViewChange: (view: ViewGroup) => void;
}

const TAB_CONFIG: { value: ViewGroup; label: string }[] = [
  { value: "CURRENT", label: "Aktualne" },
  { value: "COMPLETED", label: "Zrealizowane" },
  { value: "CANCELLED", label: "Anulowane" },
];

/**
 * Three tabs switching between order views: Current, Completed, Cancelled.
 * Placed inside AppHeader (not above the table).
 * Style per UI Plan 6.7: bg-slate-100 rounded-lg p-1, active: bg-white shadow-sm text-primary.
 */
export function OrderTabs({ activeView, onViewChange }: OrderTabsProps) {
  return (
    <nav className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
      {TAB_CONFIG.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onViewChange(tab.value)}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeView === tab.value
              ? "bg-white dark:bg-white text-slate-900 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

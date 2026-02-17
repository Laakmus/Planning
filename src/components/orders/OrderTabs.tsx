/**
 * Trzy zakładki widoku zleceń umieszczone w AppHeader.
 * Aktualne / Zrealizowane / Anulowane.
 */

import type { ViewGroup } from "@/lib/view-models";

interface OrderTabsProps {
  activeView: ViewGroup;
  onViewChange: (view: ViewGroup) => void;
}

const TABS: { value: ViewGroup; label: string }[] = [
  { value: "CURRENT", label: "Aktualne" },
  { value: "COMPLETED", label: "Zrealizowane" },
  { value: "CANCELLED", label: "Anulowane" },
];

export default function OrderTabs({ activeView, onViewChange }: OrderTabsProps) {
  return (
    <nav
      className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
      aria-label="Widoki zleceń"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onViewChange(tab.value)}
          className={
            tab.value === activeView
              ? "px-3 py-1.5 rounded-md text-xs font-semibold text-primary bg-white dark:bg-slate-700 shadow-sm transition-all"
              : "px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-all"
          }
          aria-current={tab.value === activeView ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

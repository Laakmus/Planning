import type { ViewGroup } from "@/types";
import { OrderTabs } from "@/components/orders/OrderTabs";
import { SyncButton } from "./SyncButton";
import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  activeView: ViewGroup;
  onViewChange: (view: ViewGroup) => void;
}

/**
 * Sticky application header matching test/widok_main_skrot.html mockup.
 * Dark theme: bg-slate-900/80, backdrop-blur, border-slate-800.
 */
export function AppHeader({ activeView, onViewChange }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900/80 dark:backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 h-14 flex items-center justify-between">
      {/* Left: Logo + Title + Tabs */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
          </div>
          <h1 className="font-bold text-lg tracking-tight text-slate-800 dark:text-white">
            ZT LOGISTICS
          </h1>
        </div>

        {/* Tabs */}
        <OrderTabs activeView={activeView} onViewChange={onViewChange} />
      </div>

      {/* Right: SyncButton + UserMenu */}
      <div className="flex items-center gap-3">
        <SyncButton />
        <UserMenu />
      </div>
    </header>
  );
}

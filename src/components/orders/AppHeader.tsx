/**
 * Sticky nagłówek aplikacji (h-14).
 * Zawiera: logo + tytuł | zakładki OrderTabs (wyśrodkowane) | SyncButton + UserInfo.
 * Zgodnie z PRD 3.1.2a i ui-plan §4.2.
 */

import { Truck } from "lucide-react";

import type { ViewGroup } from "@/lib/view-models";

import OrderTabs from "./OrderTabs";
import SyncButton from "./SyncButton";
import UserInfo from "./UserInfo";

interface AppHeaderProps {
  activeView: ViewGroup;
  onViewChange: (view: ViewGroup) => void;
}

export default function AppHeader({ activeView, onViewChange }: AppHeaderProps) {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm h-14 sticky top-0 z-50 flex items-center px-4 gap-4">
      {/* Logo + tytuł */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg shadow-md flex items-center justify-center">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold tracking-tight text-slate-800 dark:text-slate-100 uppercase text-sm hidden sm:block">
          Zlecenia Transportowe
        </span>
      </div>

      {/* Zakładki — wyśrodkowane w nagłówku */}
      <div className="flex-1 flex justify-center">
        <OrderTabs activeView={activeView} onViewChange={onViewChange} />
      </div>

      {/* Prawa strona: sync + użytkownik */}
      <div className="flex items-center gap-3 shrink-0">
        <SyncButton />
        <UserInfo />
      </div>
    </header>
  );
}

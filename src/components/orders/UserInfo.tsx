/**
 * Blok użytkownika w AppHeader: imię/nazwisko, rola (tekst), przycisk Wyloguj.
 * BEZ avatara ani zdjęcia — zgodnie z PRD 3.1.2a i ui-plan.
 */

import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  PLANNER: "Planner",
  READ_ONLY: "Read only",
};

export default function UserInfo() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right border-r border-slate-200 dark:border-slate-800 pr-3">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
          {user.fullName ?? user.email}
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
          {ROLE_LABELS[user.role]}
        </div>
      </div>
      <button
        onClick={logout}
        className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-600 transition-colors whitespace-nowrap"
      >
        Wyloguj
      </button>
    </div>
  );
}

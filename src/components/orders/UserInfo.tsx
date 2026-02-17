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
      <div className="text-right">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
          {user.fullName ?? user.email}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
          {ROLE_LABELS[user.role]}
        </div>
      </div>
      <button
        onClick={logout}
        className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap"
      >
        Wyloguj
      </button>
    </div>
  );
}

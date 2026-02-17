/**
 * Pojedynczy wpis na osi czasu historii zlecenia.
 * Typy: status_change | field_change | order_created
 */

import { ArrowRight, Edit2, Plus, RefreshCw } from "lucide-react";

import { formatDate } from "@/lib/format-utils";
import type { TimelineEntryViewModel } from "@/lib/view-models";

interface TimelineEntryProps {
  entry: TimelineEntryViewModel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inicjały z imienia i nazwiska lub userId */
function getInitials(name: string | null, userId: string): string {
  if (!name) return userId.substring(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Formatuje czas: HH:MM z ISO timestamp */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** StatusBadge dla historii — uproszczone kolory */
const STATUS_COLORS: Record<string, string> = {
  robocze: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  wysłane: "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  korekta: "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
  "korekta wysłane": "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  zrealizowane: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  anulowane: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:border-slate-700",
  reklamacja: "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400",
};

function StatusPill({ code }: { code: string }) {
  const colors = STATUS_COLORS[code] ?? "bg-slate-100 text-slate-600";
  const label = code.charAt(0).toUpperCase() + code.slice(1);
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function UserAvatar({
  name,
  userId,
  isSystem,
}: {
  name: string | null;
  userId: string;
  isSystem?: boolean;
}) {
  if (isSystem) {
    return (
      <div className="absolute left-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center ring-4 ring-white dark:ring-slate-950 z-10 shadow-lg shadow-primary/20">
        <Plus className="w-4 h-4 text-white" />
      </div>
    );
  }
  const initials = getInitials(name, userId);
  return (
    <div className="absolute left-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center ring-4 ring-white dark:ring-slate-950 z-10">
      <span className="text-xs font-bold text-white">{initials}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icon Badge (małe kółko na awatarze)
// ---------------------------------------------------------------------------

function IconBadge({ type }: { type: TimelineEntryViewModel["type"] }) {
  const { bg, icon } = (() => {
    switch (type) {
      case "status_change":
        return { bg: "bg-blue-500", icon: <RefreshCw className="w-2.5 h-2.5 text-white" /> };
      case "field_change":
        return { bg: "bg-amber-500", icon: <Edit2 className="w-2.5 h-2.5 text-white" /> };
      case "order_created":
        return { bg: "bg-primary", icon: <Plus className="w-2.5 h-2.5 text-white" /> };
    }
  })();

  return (
    <div
      className={`absolute left-6 top-5 w-4 h-4 rounded-full ${bg} flex items-center justify-center ring-2 ring-white dark:ring-slate-950 z-20`}
    >
      {icon}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Główny komponent
// ---------------------------------------------------------------------------

export function TimelineEntry({ entry }: TimelineEntryProps) {
  const time = formatTime(entry.changedAt);
  const isSystem = entry.type === "order_created";

  return (
    <div className="relative pl-12">
      {/* Awatar użytkownika */}
      <UserAvatar name={entry.changedByUserName} userId={entry.changedByUserId} isSystem={isSystem} />

      {/* Ikona-badge na awatarze */}
      <IconBadge type={entry.type} />

      {/* Nagłówek wpisu */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {entry.changedByUserName ?? "System"}
          </span>
          <span className="ml-1.5 text-xs text-slate-500">
            {entry.type === "status_change" && "zmienił(a) status"}
            {entry.type === "field_change" && "zmienił(a) dane"}
            {entry.type === "order_created" && "— zlecenie utworzone"}
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0 ml-2">
          {time}
        </span>
      </div>

      {/* Treść zależna od typu */}
      {entry.type === "status_change" && (
        <div className="flex items-center gap-2 flex-wrap">
          {entry.oldStatusCode && <StatusPill code={entry.oldStatusCode} />}
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {entry.newStatusCode && <StatusPill code={entry.newStatusCode} />}
        </div>
      )}

      {entry.type === "field_change" && entry.fieldName && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] uppercase font-bold text-slate-400 mb-1.5 tracking-wide">
            {entry.fieldName}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Było</p>
              <p className="text-xs text-slate-500 line-through opacity-70">
                {entry.oldValue || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-primary mb-0.5">Jest</p>
              <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold">
                {entry.newValue || "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {entry.type === "order_created" && (
        <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3">
          <p className="text-sm font-bold text-primary mb-0.5">Zlecenie utworzone</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatDate(entry.changedAt.substring(0, 10))}
          </p>
        </div>
      )}
    </div>
  );
}

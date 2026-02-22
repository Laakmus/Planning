/**
 * Sekcja 6 – Zmiana statusu.
 * Widoczna tylko w trybie edycji (canWrite). Niewidoczna dla READ_ONLY.
 * Kolorowe przyciski zamiast select. Jeśli wybrano "reklamacja" — wymagane pole powodu.
 */

import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  type OrderStatusCode,
} from "@/lib/view-models";

import { StatusBadge } from "../StatusBadge";

interface StatusSectionProps {
  currentStatusCode: string;
  currentStatusName: string;
  pendingStatusCode: OrderStatusCode | null;
  complaintReason: string | null;
  onStatusChange: (code: OrderStatusCode | null) => void;
  onComplaintReasonChange: (reason: string | null) => void;
}

const STATUS_NAMES: Record<OrderStatusCode, string> = {
  robocze: "Robocze",
  wysłane: "Wysłane",
  korekta: "Korekta",
  "korekta wysłane": "Korekta_w",
  zrealizowane: "Zrealizowane",
  reklamacja: "Reklamacja",
  anulowane: "Anulowane",
};

/** Style per status button */
const STATUS_BUTTON_STYLES: Partial<Record<OrderStatusCode, { base: string; ring: string; icon: React.ReactNode }>> = {
  zrealizowane: {
    base: "bg-green-500/10 text-green-600 dark:text-green-500 border-2 border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50",
    ring: "ring-2 ring-offset-2 ring-green-500",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  reklamacja: {
    base: "bg-red-500/10 text-red-600 dark:text-red-500 border-2 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50",
    ring: "ring-2 ring-offset-2 ring-red-500",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  anulowane: {
    base: "bg-slate-500/10 text-slate-600 dark:text-slate-500 border-2 border-slate-500/30 hover:bg-slate-500/20 hover:border-slate-500/50",
    ring: "ring-2 ring-offset-2 ring-slate-500",
    icon: <XCircle className="w-4 h-4" />,
  },
};

const DEFAULT_BUTTON_STYLE = {
  base: "bg-slate-500/10 text-slate-600 dark:text-slate-500 border-2 border-slate-500/30 hover:bg-slate-500/20 hover:border-slate-500/50",
  ring: "ring-2 ring-offset-2 ring-slate-500",
  icon: null as React.ReactNode,
};

export function StatusSection({
  currentStatusCode,
  currentStatusName,
  pendingStatusCode,
  complaintReason,
  onStatusChange,
  onComplaintReasonChange,
}: StatusSectionProps) {
  const allowedTransitions =
    ALLOWED_MANUAL_STATUS_TRANSITIONS[currentStatusCode as OrderStatusCode] ?? [];

  const isComplaintPending =
    pendingStatusCode === "reklamacja" || currentStatusCode === "reklamacja";

  function handleStatusClick(code: OrderStatusCode) {
    if (pendingStatusCode === code) {
      onStatusChange(null); // deselect
    } else {
      onStatusChange(code);
    }
  }

  return (
    <div className="space-y-3">
      {/* Aktualny status + przyciski zmiany w jednym wierszu */}
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">Aktualny status</label>
          <StatusBadge statusCode={currentStatusCode} statusName={currentStatusName} />
        </div>

        {allowedTransitions.length > 0 && (
          <>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="min-w-0">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">Zmień na:</label>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((status) => {
                  const style = STATUS_BUTTON_STYLES[status] ?? DEFAULT_BUTTON_STYLE;
                  const isSelected = pendingStatusCode === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusClick(status)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${style.base} ${isSelected ? style.ring : ""}`}
                    >
                      {style.icon}
                      {STATUS_NAMES[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Powód reklamacji */}
      {isComplaintPending && (
        <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-1 shrink-0" />
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">
              Powód reklamacji{pendingStatusCode === "reklamacja" && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <Textarea
              value={complaintReason ?? ""}
              onChange={(e) => onComplaintReasonChange(e.target.value || null)}
              rows={3}
              maxLength={500}
              className="text-sm resize-none"
              placeholder="Wymagane przy zmianie statusu na Reklamacja..."
            />
            {pendingStatusCode === "reklamacja" && (
              <p className="text-xs text-red-500 mt-1">Pole wymagane przy przejściu na status Reklamacja</p>
            )}
          </div>
        </div>
      )}

      {/* Informacja */}
      <div className="flex items-start gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Zmiana statusu zostanie zapisana razem z całym formularzem przy kliknięciu "Zapisz" w stopce
        </p>
      </div>
    </div>
  );
}

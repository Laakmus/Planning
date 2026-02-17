/**
 * Sekcja 6 – Zmiana statusu.
 * Widoczna tylko w trybie edycji (canWrite). Niewidoczna dla READ_ONLY.
 * Jeśli wybrano "reklamacja" — wymagane pole powodu.
 */

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return (
    <div className="space-y-4">
      {/* Aktualny status */}
      <div className="space-y-1">
        <Label className="text-xs text-slate-500">Aktualny status</Label>
        <div className="pl-1">
          <StatusBadge statusCode={currentStatusCode} statusName={currentStatusName} />
        </div>
      </div>

      {/* Zmiana statusu */}
      {allowedTransitions.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs font-medium">Zmień status</Label>
          <Select
            value={pendingStatusCode ?? ""}
            onValueChange={(v) => onStatusChange((v || null) as OrderStatusCode | null)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Bez zmiany" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-sm text-slate-500">
                (bez zmiany)
              </SelectItem>
              {allowedTransitions.map((status) => (
                <SelectItem key={status} value={status} className="text-sm">
                  → {STATUS_NAMES[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Powód reklamacji */}
      {isComplaintPending && (
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            Powód reklamacji
            {pendingStatusCode === "reklamacja" && (
              <span className="text-red-500 ml-0.5">*</span>
            )}
          </Label>
          <Textarea
            value={complaintReason ?? ""}
            onChange={(e) => onComplaintReasonChange(e.target.value || null)}
            rows={3}
            maxLength={500}
            className="text-sm resize-none"
            placeholder="Opisz powód reklamacji…"
          />
          <p className="text-[10px] text-slate-400 text-right">
            {(complaintReason ?? "").length}/500
          </p>
        </div>
      )}
    </div>
  );
}

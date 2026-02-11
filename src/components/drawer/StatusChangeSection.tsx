import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderStatusCode, ChangeStatusResponseDto } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, ApiError } from "@/lib/api-client";
import { ComplaintReasonDialog } from "@/components/shared/ComplaintReasonDialog";
import { StatusBadge } from "@/components/orders/StatusBadge";

interface StatusChangeSectionProps {
  orderId: string;
  currentStatusCode: OrderStatusCode;
  isReadOnly: boolean;
  onStatusChanged: () => void;
}

/**
 * Allowed manual status transitions from the implementation plan.
 * WYS and KOR_WYS are set automatically by prepare-email.
 */
const ALLOWED_MANUAL_STATUS_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  ROB: ["ZRE", "REK", "ANL"],
  WYS: ["ROB", "ZRE", "REK", "ANL"],
  KOR: ["ZRE", "REK", "ANL"],
  KOR_WYS: ["ROB", "ZRE", "REK", "ANL"],
  ZRE: ["REK"],
  ANL: [],
  REK: ["ROB", "ZRE"],
};

const STATUS_LABELS: Record<OrderStatusCode, string> = {
  ROB: "Roboczy",
  WYS: "Wysłany",
  KOR: "Korekta",
  KOR_WYS: "Korekta wysłana",
  ZRE: "Zrealizowany",
  ANL: "Anulowany",
  REK: "Reklamacja",
};

/**
 * Status change section in the drawer form.
 * Shows current status and buttons for allowed transitions.
 */
export function StatusChangeSection({
  orderId,
  currentStatusCode,
  isReadOnly,
  onStatusChanged,
}: StatusChangeSectionProps) {
  const { user } = useAuth();
  const [isChanging, setIsChanging] = useState(false);
  const [showComplaintDialog, setShowComplaintDialog] = useState(false);

  if (isReadOnly || user?.role === "READ_ONLY") return null;

  const allowedTransitions = ALLOWED_MANUAL_STATUS_TRANSITIONS[currentStatusCode] ?? [];

  if (allowedTransitions.length === 0) return null;

  const handleStatusChange = async (newStatus: OrderStatusCode, complaintReason?: string) => {
    setIsChanging(true);
    try {
      await apiClient.post<ChangeStatusResponseDto>(
        `/api/v1/orders/${orderId}/status`,
        {
          newStatusCode: newStatus,
          ...(complaintReason ? { complaintReason } : {}),
        },
      );
      toast.success(`Status zmieniony na ${STATUS_LABELS[newStatus]}`);
      onStatusChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.body.error.message);
      } else {
        toast.error("Nie udało się zmienić statusu");
      }
    } finally {
      setIsChanging(false);
    }
  };

  const handleTransitionClick = (targetStatus: OrderStatusCode) => {
    if (targetStatus === "REK") {
      setShowComplaintDialog(true);
    } else {
      handleStatusChange(targetStatus);
    }
  };

  return (
    <>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Zmiana statusu
        </legend>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Obecny:</span>
          <StatusBadge statusCode={currentStatusCode} statusName={STATUS_LABELS[currentStatusCode]} />
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />

          {allowedTransitions.map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              onClick={() => handleTransitionClick(status)}
              disabled={isChanging}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </fieldset>

      <ComplaintReasonDialog
        isOpen={showComplaintDialog}
        onConfirm={(reason) => {
          setShowComplaintDialog(false);
          handleStatusChange("REK", reason);
        }}
        onCancel={() => setShowComplaintDialog(false)}
      />
    </>
  );
}

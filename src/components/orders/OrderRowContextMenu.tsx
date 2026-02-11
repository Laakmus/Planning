import { useEffect, useRef } from "react";
import {
  Mail,
  History,
  ArrowRightLeft,
  Copy,
  XCircle,
  RotateCcw,
} from "lucide-react";
import type {
  OrderListItemDto,
  OrderStatusCode,
  ViewGroup,
  UserRole,
} from "@/types";

/**
 * Allowed manual status transitions map.
 * Key = current status code, Value = array of allowed target status codes.
 * WYS and KOR_WYS are set automatically by prepare-email, not manually.
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

/** Human-readable status labels */
const STATUS_LABELS: Record<OrderStatusCode, string> = {
  ROB: "Roboczy",
  WYS: "Wysłany",
  KOR: "Korekta",
  KOR_WYS: "Korekta wysłana",
  ZRE: "Zrealizowany",
  ANL: "Anulowany",
  REK: "Reklamacja",
};

interface OrderRowContextMenuProps {
  order: OrderListItemDto;
  activeView: ViewGroup;
  position: { x: number; y: number };
  isOpen: boolean;
  userRole: UserRole;
  onClose: () => void;
  onSendEmail: (orderId: string) => void;
  onShowHistory: (orderId: string) => void;
  onChangeStatus: (orderId: string, newStatus: OrderStatusCode, complaintReason?: string) => void;
  onDuplicate: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onRestore: (orderId: string, targetStatus: "ROB" | "WYS") => void;
  onRequestComplaintReason: (orderId: string) => void;
}

/**
 * Context menu shown on right-click on an order row.
 * Options depend on order status, active view tab, and user role.
 * Rendered as a custom positioned menu (not shadcn ContextMenu which requires wrapper).
 */
export function OrderRowContextMenu({
  order,
  activeView,
  position,
  isOpen,
  userRole,
  onClose,
  onSendEmail,
  onShowHistory,
  onChangeStatus,
  onDuplicate,
  onCancel,
  onRestore,
  onRequestComplaintReason,
}: OrderRowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Delay adding click listener to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isReadOnly = userRole === "READ_ONLY";
  const statusCode = order.statusCode as OrderStatusCode;
  const allowedTransitions = ALLOWED_MANUAL_STATUS_TRANSITIONS[statusCode] ?? [];
  const isInCompletedOrCancelled =
    activeView === "COMPLETED" || activeView === "CANCELLED";

  // Adjust position to keep menu within viewport
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: position.y,
    left: position.x,
    zIndex: 50,
  };

  const handleStatusChange = (targetStatus: OrderStatusCode) => {
    // REK requires a complaint reason — delegate to parent
    if (targetStatus === "REK") {
      onRequestComplaintReason(order.id);
    } else {
      onChangeStatus(order.id, targetStatus);
    }
    onClose();
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      <div className="min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
        {/* Send email — visible for non-readonly in CURRENT view */}
        {!isReadOnly && activeView === "CURRENT" && (
          <MenuItem
            icon={<Mail className="h-4 w-4" />}
            label="Wyślij maila"
            onClick={() => {
              onSendEmail(order.id);
              onClose();
            }}
          />
        )}

        {/* History — always visible */}
        <MenuItem
          icon={<History className="h-4 w-4" />}
          label="Historia zmian"
          onClick={() => {
            onShowHistory(order.id);
            onClose();
          }}
        />

        {/* Status change submenu — only for non-readonly and when there are allowed transitions */}
        {!isReadOnly && allowedTransitions.length > 0 && (
          <StatusSubmenu
            allowedTransitions={allowedTransitions}
            onSelect={handleStatusChange}
          />
        )}

        {/* Duplicate — non-readonly, CURRENT view */}
        {!isReadOnly && activeView === "CURRENT" && (
          <MenuItem
            icon={<Copy className="h-4 w-4" />}
            label="Skopiuj zlecenie"
            onClick={() => {
              onDuplicate(order.id);
              onClose();
            }}
          />
        )}

        {/* Cancel — non-readonly, CURRENT view, not already ANL */}
        {!isReadOnly && activeView === "CURRENT" && statusCode !== "ANL" && (
          <>
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={<XCircle className="h-4 w-4" />}
              label="Anuluj zlecenie"
              className="text-destructive focus:text-destructive"
              onClick={() => {
                onCancel(order.id);
                onClose();
              }}
            />
          </>
        )}

        {/* Restore — non-readonly, COMPLETED or CANCELLED view */}
        {!isReadOnly && isInCompletedOrCancelled && (
          <>
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={<RotateCcw className="h-4 w-4" />}
              label="Przywróć do aktualnych"
              onClick={() => {
                onRestore(order.id, "ROB");
                onClose();
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Single menu item */
function MenuItem({
  icon,
  label,
  onClick,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Status change submenu with allowed transitions */
function StatusSubmenu({
  allowedTransitions,
  onSelect,
}: {
  allowedTransitions: OrderStatusCode[];
  onSelect: (status: OrderStatusCode) => void;
}) {
  return (
    <div className="relative group">
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
        <ArrowRightLeft className="h-4 w-4" />
        Zmień status
        <span className="ml-auto text-xs text-muted-foreground">▸</span>
      </button>
      <div className="invisible group-hover:visible absolute left-full top-0 ml-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
        {allowedTransitions.map((status) => (
          <button
            key={status}
            onClick={() => onSelect(status)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <StatusDot statusCode={status} />
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small colored dot for status indication in submenu */
function StatusDot({ statusCode }: { statusCode: OrderStatusCode }) {
  const colorMap: Record<OrderStatusCode, string> = {
    ROB: "bg-slate-400",
    WYS: "bg-blue-400",
    KOR: "bg-orange-400",
    KOR_WYS: "bg-teal-400",
    ZRE: "bg-green-400",
    ANL: "bg-gray-400",
    REK: "bg-red-400",
  };

  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colorMap[statusCode]}`} />
  );
}

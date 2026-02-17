/**
 * Menu kontekstowe wierszy tabeli (prawy klik).
 * Opakowuje zawartość wiersza w shadcn ContextMenu.
 * Opcje filtrowane wg statusu zlecenia i roli użytkownika.
 */

import { type ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAuth } from "@/contexts/AuthContext";
import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  type OrderStatusCode,
  type ViewGroup,
} from "@/lib/view-models";

/** Mapowanie kodu statusu → czytelna nazwa do wyświetlenia. */
const STATUS_NAMES: Record<OrderStatusCode, string> = {
  robocze: "Robocze",
  wysłane: "Wysłane",
  korekta: "Korekta",
  "korekta wysłane": "Korekta_w",
  zrealizowane: "Zrealizowane",
  reklamacja: "Reklamacja",
  anulowane: "Anulowane",
};

interface OrderRowContextMenuProps {
  children: ReactNode;
  orderId: string;
  statusCode: string;
  activeView: ViewGroup;
  onOpen: (orderId: string) => void;
  onSendEmail: (orderId: string) => void;
  onShowHistory: (orderId: string) => void;
  onChangeStatus: (orderId: string, newStatus: OrderStatusCode) => void;
  onCancel: (orderId: string) => void;
  onRestore: (orderId: string) => void;
}

export function OrderRowContextMenu({
  children,
  orderId,
  statusCode,
  activeView,
  onOpen,
  onSendEmail,
  onShowHistory,
  onChangeStatus,
  onCancel,
  onRestore,
}: OrderRowContextMenuProps) {
  const { user } = useAuth();
  const canWrite = user?.role !== "READ_ONLY";

  const allowedTransitions =
    ALLOWED_MANUAL_STATUS_TRANSITIONS[statusCode as OrderStatusCode] ?? [];

  const isCompleted = activeView === "COMPLETED";
  const isCancelled = activeView === "CANCELLED";
  const canRestore = isCompleted || isCancelled;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {/* Otwórz */}
        <ContextMenuItem onClick={() => onOpen(orderId)}>
          Otwórz
        </ContextMenuItem>

        {canWrite && (
          <>
            <ContextMenuSeparator />

            {/* Wyślij maila */}
            {(statusCode === "robocze" || statusCode === "korekta") && (
              <ContextMenuItem onClick={() => onSendEmail(orderId)}>
                Wyślij maila
              </ContextMenuItem>
            )}

            {/* Zmień status — podmenu */}
            {allowedTransitions.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>Zmień status</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {allowedTransitions.map((status) => (
                    <ContextMenuItem
                      key={status}
                      onClick={() => onChangeStatus(orderId, status)}
                    >
                      → {STATUS_NAMES[status]}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            {/* Przywróć do aktualnych */}
            {canRestore && (
              <ContextMenuItem onClick={() => onRestore(orderId)}>
                Przywróć do aktualnych
              </ContextMenuItem>
            )}

            {/* Anuluj zlecenie */}
            {statusCode !== "anulowane" && (
              <ContextMenuItem
                onClick={() => onCancel(orderId)}
                className="text-red-600 focus:text-red-600"
              >
                Anuluj zlecenie
              </ContextMenuItem>
            )}
          </>
        )}

        <ContextMenuSeparator />

        {/* Historia zmian */}
        <ContextMenuItem onClick={() => onShowHistory(orderId)}>
          Historia zmian
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

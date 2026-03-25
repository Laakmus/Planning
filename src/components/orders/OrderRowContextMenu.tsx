/**
 * Menu kontekstowe wierszy tabeli (prawy klik).
 * Opakowuje zawartość wiersza w shadcn ContextMenu.
 * Opcje filtrowane wg statusu zlecenia i roli użytkownika.
 */

import { type ReactNode, useRef } from "react";

import { Check, Copy } from "lucide-react";

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
  STATUS_NAMES,
  type OrderStatusCode,
  type ViewGroup,
} from "@/lib/view-models";

/** Carrier cell color options. */
const CARRIER_COLORS = [
  { hex: "#34d399", label: "Zielony" },
  { hex: "#047857", label: "Ciemnozielony" },
  { hex: "#fde047", label: "Żółty" },
  { hex: "#f97316", label: "Pomarańczowy" },
] as const;

interface OrderRowContextMenuProps {
  children: ReactNode;
  orderId: string;
  orderNo: string;
  statusCode: string;
  activeView: ViewGroup;
  carrierCellColor: string | null;
  onOpen: (orderId: string) => void;
  onSendEmail: (orderId: string) => void;
  onShowHistory: (orderId: string) => void;
  onChangeStatus: (orderId: string, orderNo: string, newStatus: OrderStatusCode) => void;
  onDuplicate: (orderId: string, orderNo: string) => void;
  onCancel: (orderId: string, orderNo: string) => void;
  onRestore: (orderId: string, orderNo: string) => void;
  onSetCarrierColor: (orderId: string, color: string | null) => void;
}

export function OrderRowContextMenu({
  children,
  orderId,
  orderNo,
  statusCode,
  activeView,
  carrierCellColor,
  onOpen,
  onSendEmail,
  onShowHistory,
  onChangeStatus,
  onDuplicate,
  onCancel,
  onRestore,
  onSetCarrierColor,
}: OrderRowContextMenuProps) {
  const { user } = useAuth();
  const canWrite = user?.role !== "READ_ONLY";

  // Ochrona przed wyścigiem zdarzeń Radix: pointerup z prawego kliknięcia
  // (button=2) może trafić w pozycję menu zanim użytkownik poruszy kursorem.
  // Radix MenuItem interpretuje pointerup bez wcześniejszego pointerdown
  // jako kliknięcie → przypadkowe triggerowanie akcji (np. "Skopiuj zlecenie").
  // Fix: blokujemy pointerup w oknie 300ms od otwarcia menu.
  const openedAtRef = useRef(0);

  const allowedTransitions =
    ALLOWED_MANUAL_STATUS_TRANSITIONS[statusCode as OrderStatusCode] ?? [];

  const isCompleted = activeView === "COMPLETED";
  const isCancelled = activeView === "CANCELLED";
  const canRestore = isCompleted || isCancelled;

  return (
    <ContextMenu onOpenChange={(open) => { if (open) openedAtRef.current = Date.now(); }}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-52"
        onPointerUpCapture={(e) => {
          if (Date.now() - openedAtRef.current < 300) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* Otwórz */}
        <ContextMenuItem onClick={() => onOpen(orderId)}>
          Otwórz
        </ContextMenuItem>

        {canWrite && (
          <>
            <ContextMenuSeparator />

            {/* Wyślij maila */}
            {(statusCode === "robocze" || statusCode === "korekta" || statusCode === "wysłane" || statusCode === "korekta wysłane") && (
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
                      onClick={() => onChangeStatus(orderId, orderNo, status)}
                    >
                      → {STATUS_NAMES[status]}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            {/* Oznacz kolorem — podmenu */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <span className="flex items-center gap-1.5">
                  <span className="flex items-center gap-px">
                    {CARRIER_COLORS.map(({ hex }) => (
                      <span
                        key={hex}
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                  Kolor
                </span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {CARRIER_COLORS.map(({ hex, label }) => (
                  <ContextMenuItem
                    key={hex}
                    onClick={() => onSetCarrierColor(orderId, hex)}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded-sm border border-slate-300 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      {label}
                      {carrierCellColor === hex && (
                        <Check className="w-3.5 h-3.5 ml-auto" />
                      )}
                    </span>
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={!carrierCellColor}
                  onClick={() => onSetCarrierColor(orderId, null)}
                >
                  Usuń kolor
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            {/* Skopiuj zlecenie */}
            <ContextMenuItem onClick={() => onDuplicate(orderId, orderNo)}>
              <Copy className="w-4 h-4 mr-2" />
              Skopiuj zlecenie
            </ContextMenuItem>

            {/* Przywróć do aktualnych */}
            {canRestore && (
              <ContextMenuItem onClick={() => onRestore(orderId, orderNo)}>
                Przywróć do aktualnych
              </ContextMenuItem>
            )}

            {/* Anuluj zlecenie */}
            {statusCode !== "anulowane" && (
              <ContextMenuItem
                onClick={() => onCancel(orderId, orderNo)}
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
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

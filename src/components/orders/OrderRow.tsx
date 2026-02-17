/**
 * Pojedynczy wiersz tabeli zleceń.
 * Kompaktowy (py-1 px-4 text-[12px]), tło wg statusu, dwa warianty widoku.
 * Owinięty w OrderRowContextMenu dla obsługi prawego kliku.
 */

import { Mail } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTimeShort } from "@/lib/format-utils";
import type { OrderListItemDto } from "@/types";
import type { ListViewMode, OrderStatusCode, ViewGroup } from "@/lib/view-models";

import { DatesCell, LocationsCell } from "./LocationsCell";
import { LockIndicator } from "./LockIndicator";
import { OrderRowContextMenu } from "./OrderRowContextMenu";
import { RouteSummaryCell } from "./RouteSummaryCell";
import { StatusBadge } from "./StatusBadge";

/** Mapowanie kodów transportu na skróty wyświetlane w tabeli (PRD §3.1.2a). */
const TRANSPORT_CODE_DISPLAY: Record<string, string> = {
  PL: "PL",
  EXP: "EXP",
  EXP_K: "EXP_K",
  IMP: "IMP",
  // Legacy codes z seed data
  KRAJ: "PL",
  MIEDZY: "EXP",
  EKSPRES: "IMP",
};

/** Tło wiersza wg statusCode (plan implementacji §4.9). */
const ROW_BG: Record<string, string> = {
  robocze: "bg-white dark:bg-slate-900",
  wysłane: "bg-blue-50/30 dark:bg-blue-900/10",
  korekta: "bg-orange-50/30 dark:bg-orange-900/10",
  "korekta wysłane": "bg-amber-50/30 dark:bg-amber-900/10",
  zrealizowane: "bg-emerald-50/30 dark:bg-emerald-900/10",
  anulowane: "bg-slate-100/50 dark:bg-slate-800/30",
  reklamacja: "bg-red-50/30 dark:bg-red-900/10",
};

interface OrderRowProps {
  order: OrderListItemDto;
  viewMode: ListViewMode;
  activeView: ViewGroup;
  onRowClick: (orderId: string) => void;
  onSendEmail: (orderId: string) => void;
  onShowHistory: (orderId: string) => void;
  onChangeStatus: (orderId: string, newStatus: OrderStatusCode) => void;
  onCancel: (orderId: string) => void;
  onRestore: (orderId: string) => void;
}

export function OrderRow({
  order,
  viewMode,
  activeView,
  onRowClick,
  onSendEmail,
  onShowHistory,
  onChangeStatus,
  onCancel,
  onRestore,
}: OrderRowProps) {
  const { user } = useAuth();
  const rowBg = ROW_BG[order.statusCode] ?? "bg-white dark:bg-slate-900";

  // Lock: pokaż tylko gdy zlecenie zablokowane przez INNEGO użytkownika
  const isLockedByOther =
    !!order.lockedByUserId && order.lockedByUserId !== user?.id;
  const lockedByName = isLockedByOther ? (order.lockedByUserName ?? "inny użytkownik") : null;

  const canWrite = user?.role !== "READ_ONLY";

  // Suma tonażu
  const totalTons = order.items.reduce((sum, it) => sum + (it.quantityTons ?? 0), 0);

  // Data rozładunku (widok Trasa: tylko U1)
  const firstUnloading = order.stops
    .filter((s) => s.kind === "UNLOADING")
    .sort((a, b) => a.sequenceNo - b.sequenceNo)[0];

  // Data załadunku (widok Trasa: tylko L1)
  const firstLoading = order.stops
    .filter((s) => s.kind === "LOADING")
    .sort((a, b) => a.sequenceNo - b.sequenceNo)[0];

  const trRow = (
    <tr
      className={`${rowBg} hover:bg-primary/5 transition-colors group cursor-pointer`}
      role="row"
      onClick={() => onRowClick(order.id)}
    >
      {/* Kolumna Lock */}
      <td className="py-1 px-4 text-center w-10">
        <LockIndicator lockedByUserName={lockedByName} />
      </td>

      {/* Nr zlecenia */}
      <td className="py-1 px-4 text-[12px] font-medium min-w-[110px] whitespace-nowrap">
        {order.orderNo}
      </td>

      {/* Status */}
      <td className="py-1 px-4 min-w-[100px]">
        <StatusBadge statusCode={order.statusCode} statusName={order.statusName} />
      </td>

      {/* Tydzień */}
      <td className="py-1 px-4 text-[12px] text-center w-12">
        {order.weekNumber ?? "—"}
      </td>

      {/* Rodzaj transportu */}
      <td className="py-1 px-4 text-[12px] min-w-[80px]">
        {TRANSPORT_CODE_DISPLAY[order.transportTypeCode] ?? order.transportTypeCode}
      </td>

      {/* Trasa lub Miejsca załadunku/rozładunku */}
      {viewMode === "route" ? (
        <td className="py-1 px-4 min-w-[220px]">
          <RouteSummaryCell stops={order.stops} />
        </td>
      ) : (
        <td className="py-1 px-4 min-w-[200px]">
          <LocationsCell stops={order.stops} kind="LOADING" />
        </td>
      )}

      {/* Data załadunku */}
      <td className="py-1 px-4 min-w-[110px]">
        {viewMode === "route" ? (
          // Widok Trasa: tylko L1 z badge'em
          firstLoading ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
                L1
              </span>
              <span className="whitespace-nowrap text-[12px]">
                {formatDateTimeShort(firstLoading.dateLocal, firstLoading.timeLocal)}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[12px]">—</span>
          )
        ) : (
          <DatesCell stops={order.stops} kind="LOADING" />
        )}
      </td>

      {/* Miejsce rozładunku (Kolumny) lub separator */}
      {viewMode === "columns" && (
        <td className="py-1 px-4 min-w-[200px]">
          <LocationsCell stops={order.stops} kind="UNLOADING" />
        </td>
      )}

      {/* Data rozładunku */}
      <td className="py-1 px-4 min-w-[110px]">
        {viewMode === "route" ? (
          firstUnloading ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold shrink-0">
                U1
              </span>
              <span className="whitespace-nowrap text-[12px]">
                {formatDateTimeShort(firstUnloading.dateLocal, firstUnloading.timeLocal)}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[12px]">—</span>
          )
        ) : (
          <DatesCell stops={order.stops} kind="UNLOADING" />
        )}
      </td>

      {/* Towar */}
      <td className="py-1 px-4 min-w-[160px]">
        {(() => {
          const validItems = order.items.filter((it) => it.productNameSnapshot);
          return (
            <div className="space-y-0.5">
              {validItems.map((item, idx) => (
                <div key={idx} className="text-[11px] whitespace-nowrap">
                  {validItems.length > 1 ? `${idx + 1}. ` : ""}{item.productNameSnapshot}
                  {item.quantityTons != null ? ` (${item.quantityTons}t` : ""}
                  {item.loadingMethodCode ? `, ${item.loadingMethodCode})` : item.quantityTons != null ? ")" : ""}
                </div>
              ))}
              {validItems.length > 1 && totalTons > 0 && (
                <div className="text-[10px] text-slate-500 font-semibold">
                  Razem: {totalTons}t
                </div>
              )}
            </div>
          );
        })()}
      </td>

      {/* Komentarz */}
      <td className="py-1 px-4 min-w-[120px]">
        <div className="space-y-0.5">
          {order.items
            .filter((it) => it.notes)
            .map((item, idx) => (
              <div key={idx} className="text-[11px] text-slate-500 whitespace-nowrap">
                {idx + 1}. {item.notes}
              </div>
            ))}
        </div>
      </td>

      {/* Firma transportowa */}
      <td className="py-1 px-4 text-[12px] min-w-[150px]">
        {order.carrierName ?? "—"}
      </td>

      {/* Typ auta */}
      <td className="py-1 px-4 text-[12px] min-w-[90px]">
        {order.vehicleVariantName}
        {order.vehicleCapacityVolumeM3 != null && (
          <span className="text-slate-500"> ({order.vehicleCapacityVolumeM3}m³)</span>
        )}
      </td>

      {/* Stawka */}
      <td className="py-1 px-4 text-[12px] font-semibold w-20 whitespace-nowrap">
        {order.priceAmount != null ? `${order.priceAmount} ${order.currencyCode}` : "—"}
      </td>

      {/* Data wysłania */}
      <td className="py-1 px-4 min-w-[90px]">
        {order.sentByUserName || order.sentAt ? (
          <div className="space-y-0.5">
            {order.sentByUserName && (
              <div className="text-[11px]">{order.sentByUserName}</div>
            )}
            {order.sentAt && (
              <div className="text-[10px] text-slate-500">
                {formatDate(order.sentAt.substring(0, 10))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-[11px]">—</span>
        )}
      </td>

      {/* Akcje — sticky right */}
      <td
        className="py-1 px-4 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 group-hover:bg-primary/5 w-12 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {canWrite && (
          <button
            onClick={() => onSendEmail(order.id)}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-primary transition-colors"
            title="Wyślij maila"
          >
            <Mail className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <OrderRowContextMenu
      orderId={order.id}
      statusCode={order.statusCode}
      activeView={activeView}
      onOpen={onRowClick}
      onSendEmail={onSendEmail}
      onShowHistory={onShowHistory}
      onChangeStatus={onChangeStatus}
      onCancel={onCancel}
      onRestore={onRestore}
    >
      {trRow}
    </OrderRowContextMenu>
  );
}

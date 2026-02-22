/**
 * Tabela zleceń transportowych.
 * min-w-[1280px] (Trasa) / min-w-[1500px] (Kolumny).
 * Sticky thead.
 * Styl hover: rgba(primary, 0.04) przez klasę group na <tr>.
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type { OrderListItemDto } from "@/types";
import type { ListViewMode, OrderSortBy, OrderStatusCode, SortDirection, ViewGroup } from "@/lib/view-models";

import { OrderRow } from "./OrderRow";

interface OrderTableProps {
  orders: OrderListItemDto[];
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  viewMode: ListViewMode;
  isLoading: boolean;
  activeView: ViewGroup;
  pendingNewOrder?: boolean;
  onSort: (sortBy: OrderSortBy) => void;
  onRowClick: (orderId: string) => void;
  onNewRowClick?: () => void;
  onSendEmail: (orderId: string) => void;
  onShowHistory: (orderId: string) => void;
  onChangeStatus: (orderId: string, newStatus: OrderStatusCode) => void;
  onDuplicate: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onRestore: (orderId: string) => void;
  onSetCarrierColor: (orderId: string, color: string | null) => void;
}

type SortableColumn = { label: string; sortKey: OrderSortBy };

const SORTABLE_COLUMNS: Record<string, SortableColumn> = {
  orderNo: { label: "Nr zlecenia", sortKey: "ORDER_NO" },
  loadingDate: { label: "Data zał.", sortKey: "FIRST_LOADING_DATETIME" },
  unloadingDate: { label: "Data rozł.", sortKey: "FIRST_UNLOADING_DATETIME" },
  carrier: { label: "Firma transp.", sortKey: "CARRIER_NAME" },
};

function SortIcon({
  column,
  sortBy,
  sortDirection,
}: {
  column: OrderSortBy;
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
}) {
  if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
  return sortDirection === "ASC" ? (
    <ArrowUp className="w-3 h-3 text-primary" />
  ) : (
    <ArrowDown className="w-3 h-3 text-primary" />
  );
}

function SortableTh({
  sortKey,
  label,
  className,
  sortBy,
  sortDirection,
  onSort,
}: {
  sortKey: OrderSortBy;
  label: string;
  className?: string;
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  onSort: (key: OrderSortBy) => void;
}) {
  return (
    <th
      className={`py-2 px-4 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
      aria-sort={
        sortBy === sortKey
          ? sortDirection === "ASC"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon column={sortKey} sortBy={sortBy} sortDirection={sortDirection} />
      </span>
    </th>
  );
}

export function OrderTable({
  orders,
  sortBy,
  sortDirection,
  viewMode,
  isLoading,
  activeView,
  pendingNewOrder,
  onSort,
  onRowClick,
  onNewRowClick,
  onSendEmail,
  onShowHistory,
  onChangeStatus,
  onDuplicate,
  onCancel,
  onRestore,
  onSetCarrierColor,
}: OrderTableProps) {
  const minWidth = viewMode === "columns" ? "1500px" : "1280px";

  return (
    <div
      className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900"
      style={{
        // Cienki, widoczny scrollbar
        scrollbarWidth: "thin",
        scrollbarColor: "#cbd5e1 transparent",
      }}
    >
      <table
        className="orders-table w-full border-collapse text-left"
        role="table"
        style={{ minWidth }}
      >
        <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
          <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <th className="py-2 px-4 w-10" />
            <SortableTh
              sortKey="ORDER_NO"
              label="Nr zlecenia"
              className="min-w-[110px]"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            <th className="py-2 px-4 min-w-[100px]">Status</th>
            <th className="py-2 px-4 w-12 text-center">Tydz.</th>
            <th className="py-2 px-4 min-w-[80px]">Rodzaj</th>

            {viewMode === "route" ? (
              <th className="py-2 px-4 min-w-[220px]">Trasa</th>
            ) : (
              <th className="py-2 px-4 min-w-[200px]">Miejsce załadunku</th>
            )}

            <SortableTh
              sortKey="FIRST_LOADING_DATETIME"
              label="Data zał."
              className="min-w-[110px]"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={onSort}
            />

            {viewMode === "columns" && (
              <th className="py-2 px-4 min-w-[200px]">Miejsce rozładunku</th>
            )}

            <SortableTh
              sortKey="FIRST_UNLOADING_DATETIME"
              label="Data rozł."
              className="min-w-[110px]"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={onSort}
            />

            <th className="py-2 px-4 min-w-[160px]">Towar</th>
            <th className="py-2 px-4 min-w-[120px]">Komentarz</th>

            <SortableTh
              sortKey="CARRIER_NAME"
              label="Firma transp."
              className="min-w-[150px]"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={onSort}
            />

            <th className="py-2 px-4 min-w-[90px]">Typ auta</th>
            <th className="py-2 px-4 w-20">Stawka</th>
            <th className="py-2 px-4 min-w-[90px]">Data wysł.</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {isLoading && orders.length === 0 ? (
            // Skeleton loading — 5 wierszy
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: viewMode === "columns" ? 15 : 14 }).map((_, j) => (
                  <td key={j} className="py-2 px-4">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                viewMode={viewMode}
                activeView={activeView}
                onRowClick={onRowClick}
                onSendEmail={onSendEmail}
                onShowHistory={onShowHistory}
                onChangeStatus={onChangeStatus}
                onDuplicate={onDuplicate}
                onCancel={onCancel}
                onRestore={onRestore}
                onSetCarrierColor={onSetCarrierColor}
              />
            ))
          )}

          {/* Pusty wiersz nowego zlecenia */}
          {pendingNewOrder && (
            <tr
              className="bg-emerald-50/40 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer transition-colors border-2 border-dashed border-emerald-300 dark:border-emerald-700"
              onClick={onNewRowClick}
            >
              <td className="py-2 px-4" />
              <td className="py-2 px-4 text-[12px] text-emerald-600 dark:text-emerald-400 font-medium italic" colSpan={viewMode === "columns" ? 14 : 13}>
                Kliknij, aby wypełnić nowe zlecenie...
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

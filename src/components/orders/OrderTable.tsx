import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import type { OrderListItemDto, OrderSortBy, SortDirection } from "@/types";
import type { ListViewMode } from "@/lib/view-models";
import { OrderRow } from "./OrderRow";

interface OrderTableProps {
  orders: OrderListItemDto[];
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  viewMode: ListViewMode;
  isLoading: boolean;
  onSort: (sortBy: OrderSortBy) => void;
  onRowClick: (orderId: string) => void;
  onRowContextMenu: (orderId: string, event: React.MouseEvent) => void;
  onSendEmail?: (orderId: string) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  sortKey?: OrderSortBy;
  className?: string;
  sticky?: boolean;
  stickyLeft?: boolean;
}

// Column definitions for "route" view mode — matches test/widok_main_skrot.html
const ROUTE_COLUMNS: ColumnDef[] = [
  { key: "orderNo", label: "ID", sortKey: "ORDER_NO", className: "w-16" },
  { key: "status", label: "Status", className: "w-24" },
  { key: "carrier", label: "Przewoźnik", sortKey: "CARRIER_NAME", className: "w-48" },
  { key: "route", label: "Trasa", className: "w-[300px]" },
  { key: "product", label: "Towar", className: "min-w-[250px]" },
  {
    key: "loadingDate",
    label: "Data Załadunku",
    sortKey: "FIRST_LOADING_DATETIME",
    className: "w-32",
  },
  { key: "actions", label: "Akcje", className: "w-24 text-center", sticky: true },
];

// Column definitions for "columns" view mode — matches test/tabele_widok.html
const COLUMNS_VIEW: ColumnDef[] = [
  { key: "orderNo", label: "ID Zlecenia", sortKey: "ORDER_NO", className: "w-24", stickyLeft: true },
  { key: "loadingLocations", label: "Miejsca Załadunków" },
  { key: "unloadingLocations", label: "Miejsca Rozładunków" },
  {
    key: "loadingDate",
    label: "Daty Załadunków",
    sortKey: "FIRST_LOADING_DATETIME",
  },
  {
    key: "unloadingDate",
    label: "Daty Rozładunków",
    sortKey: "FIRST_UNLOADING_DATETIME",
  },
  { key: "product", label: "Towar" },
  { key: "carrier", label: "Przewoźnik", sortKey: "CARRIER_NAME" },
  { key: "price", label: "Cena", className: "text-right" },
  { key: "status", label: "Status", className: "text-center" },
  { key: "actions", label: "Akcje", className: "w-32 text-center", sticky: true },
];

function SortIcon({
  column,
  currentSort,
  currentDirection,
}: {
  column: OrderSortBy;
  currentSort: OrderSortBy;
  currentDirection: SortDirection;
}) {
  if (column !== currentSort) {
    return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  }
  return currentDirection === "ASC" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

/**
 * Orders table with sortable headers, two view modes, compact styling.
 * Per UI Plan 6.3: min-w-[1280px], sticky header, sticky Actions column.
 */
export function OrderTable({
  orders,
  sortBy,
  sortDirection,
  viewMode,
  isLoading,
  onSort,
  onRowClick,
  onRowContextMenu,
  onSendEmail,
}: OrderTableProps) {
  const columns = viewMode === "route" ? ROUTE_COLUMNS : COLUMNS_VIEW;

  const isColumnsView = viewMode === "columns";

  return (
    <div className="relative overflow-x-auto custom-scrollbar">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <table className={`w-full text-left min-w-[1280px] ${isColumnsView ? "border-separate border-spacing-0 min-w-[1400px]" : "border-collapse dense-table"}`}>
        <thead className="sticky top-0 z-20">
          <tr className={isColumnsView ? "bg-slate-50 dark:bg-[#1a2530]" : "bg-slate-900 border-b border-slate-700 shadow-sm"}>
            {columns.map((col) => {
              const stickyRight = col.sticky
                ? `sticky right-0 z-40 ${isColumnsView ? "bg-slate-50 dark:bg-[#1a2530]" : "bg-slate-900"} border-l ${isColumnsView ? "border-slate-200 dark:border-[#2d3a4b]" : "border-slate-800"} shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.5)]`
                : "";
              const stickyLeft = col.stickyLeft
                ? `sticky left-0 z-40 ${isColumnsView ? "bg-slate-50 dark:bg-[#1a2530]" : "bg-slate-900"} border-r ${isColumnsView ? "border-slate-200 dark:border-[#2d3a4b]" : "border-slate-800"}`
                : "";
              const borderBottom = isColumnsView ? "border-b border-slate-200 dark:border-[#2d3a4b]" : "";

              return (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${col.className ?? ""} ${col.sortKey ? "cursor-pointer select-none hover:text-slate-200" : ""} ${stickyRight} ${stickyLeft} ${borderBottom}`}
                  onClick={col.sortKey ? () => onSort(col.sortKey!) : undefined}
                >
                  {col.label}
                  {col.sortKey && (
                    <SortIcon
                      column={col.sortKey}
                      currentSort={sortBy}
                      currentDirection={sortDirection}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={isColumnsView ? "divide-y divide-slate-100 dark:divide-[#2d3a4b]" : "divide-y divide-slate-800/50"}>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              viewMode={viewMode}
              onRowClick={onRowClick}
              onRowContextMenu={onRowContextMenu}
              onSendEmail={(orderId) => onSendEmail?.(orderId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

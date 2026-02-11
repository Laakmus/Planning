import { Eye, Edit, Printer } from "lucide-react";
import type { OrderListItemDto, OrderStatusCode } from "@/types";
import type { ListViewMode } from "@/lib/view-models";
import { StatusBadge } from "./StatusBadge";
import { RouteSummaryCell } from "./RouteSummaryCell";
import { LockIndicator } from "./LockIndicator";

interface OrderRowProps {
  order: OrderListItemDto;
  viewMode: ListViewMode;
  onRowClick: (orderId: string) => void;
  onRowContextMenu: (orderId: string, event: React.MouseEvent) => void;
  onSendEmail: (orderId: string) => void;
}

/** Format date string for display (YYYY-MM-DD → DD.MM.YYYY) */
function formatDate(date: string | null): string {
  if (!date) return "—";
  const parts = date.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return date;
}

/** Format date+time for display */
function formatDateTime(date: string | null, time: string | null): string {
  const d = formatDate(date);
  if (d === "—") return "—";
  if (time) return `${d} ${time.slice(0, 5)}`;
  return d;
}

/** Format price with currency */
function formatPrice(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return "—";
  return `${amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Row background color based on status — matches mockup tinting.
 */
const ROW_BG_STYLES: Record<OrderStatusCode, string> = {
  ROB: "",
  WYS: "bg-primary/5",
  KOR: "bg-orange-500/5",
  KOR_WYS: "bg-teal-500/5",
  ZRE: "bg-emerald-500/5",
  ANL: "bg-gray-500/5",
  REK: "bg-red-500/5",
};

/**
 * Single order row — two view modes matching mockup HTMLs.
 * Route view: test/widok_main_skrot.html
 * Columns view: test/tabele_widok.html
 */
export function OrderRow({
  order,
  viewMode,
  onRowClick,
  onRowContextMenu,
  onSendEmail,
}: OrderRowProps) {
  const handleClick = () => onRowClick(order.id);
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onRowContextMenu(order.id, e);
  };

  const rowBg = ROW_BG_STYLES[order.statusCode as OrderStatusCode] ?? "";
  const baseClass = `hover:bg-slate-800/40 transition-colors group cursor-pointer ${rowBg}`;

  if (viewMode === "route") {
    // Route view — matches test/widok_main_skrot.html
    return (
      <tr className={baseClass} onClick={handleClick} onContextMenu={handleContextMenu}>
        <td className="font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <LockIndicator
              lockedByUserId={order.lockedByUserId}
              lockedByUserName={order.lockedByUserName}
            />
            #{order.orderNo}
          </div>
        </td>
        <td>
          <StatusBadge statusCode={order.statusCode} statusName={order.statusName} />
        </td>
        <td className="text-slate-400">
          {order.carrierName ?? <span className="italic">Nieprzypisany</span>}
        </td>
        <td>
          <RouteSummaryCell summaryRoute={order.summaryRoute} />
        </td>
        <td>
          <div className="flex flex-col">
            <span className="text-slate-300 font-medium truncate">
              {order.mainProductName ?? "—"}
            </span>
          </div>
        </td>
        <td className="text-slate-300 text-[11px]">
          {formatDateTime(order.firstLoadingDate, order.firstLoadingTime)}
        </td>
        <td className="sticky right-0 bg-slate-900/80 backdrop-blur-sm border-l border-slate-800 group-hover:bg-slate-800 transition-colors">
          <div className="flex justify-center space-x-2 opacity-50 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onRowClick(order.id); }}
              className="text-slate-500 hover:text-primary transition-colors"
              title="Edytuj"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="text-slate-500 hover:text-white transition-colors"
              title="Podgląd"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSendEmail(order.id); }}
              className="text-slate-500 hover:text-white transition-colors"
              title="Drukuj / PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // "columns" view mode — matches test/tabele_widok.html
  return (
    <tr className={`row-hover transition-colors group cursor-pointer dark:bg-[#121c27]`} onClick={handleClick} onContextMenu={handleContextMenu}>
      <td className="sticky left-0 z-20 bg-inherit px-4 py-3 font-mono font-medium text-primary border-r border-slate-100 dark:border-[#2d3a4b]">
        <div className="flex items-center gap-1">
          <LockIndicator
            lockedByUserId={order.lockedByUserId}
            lockedByUserName={order.lockedByUserName}
          />
          {order.orderNo}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            {order.summaryRoute?.split("→")[0]?.trim().slice(0, 3).toUpperCase() ?? "—"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            {order.summaryRoute?.split("→").pop()?.trim().slice(0, 3).toUpperCase() ?? "—"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-slate-300">
        {formatDateTime(order.firstLoadingDate, order.firstLoadingTime)}
      </td>
      <td className="px-4 py-3 font-mono text-slate-300">
        {formatDateTime(order.firstUnloadingDate, order.firstUnloadingTime)}
      </td>
      <td className="px-4 py-3">
        {order.mainProductName ? (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1a2530] text-[10px] border border-slate-200 dark:border-[#2d3a4b]">
            {order.mainProductName}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 italic">Brak towaru</span>
        )}
      </td>
      <td className="px-4 py-3">
        {order.carrierName ? (
          <div className="flex flex-col">
            <span className="font-semibold">{order.carrierName}</span>
          </div>
        ) : (
          <span className="text-slate-500 italic">Nieprzypisany</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold">
        {formatPrice(order.priceAmount, order.currencyCode)}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <StatusBadge statusCode={order.statusCode} statusName={order.statusName} pill />
        </div>
      </td>
      <td className="sticky right-0 z-20 bg-inherit px-4 py-3 border-l border-slate-100 dark:border-[#2d3a4b]">
        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1 hover:bg-primary/10 hover:text-primary rounded text-slate-400 transition-colors"
            title="Podgląd"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRowClick(order.id); }}
            className="p-1 hover:bg-primary/10 hover:text-primary rounded text-slate-400 transition-colors"
            title="Edytuj"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSendEmail(order.id); }}
            className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-slate-400 transition-colors"
            title="Drukuj / PDF"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

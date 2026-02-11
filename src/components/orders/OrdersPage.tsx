import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type {
  ViewGroup,
  OrderStatusCode,
  PrepareEmailResponseDto,
  ChangeStatusResponseDto,
  DuplicateOrderResponseDto,
} from "@/types";
import type { ListViewMode, ContextMenuState } from "@/lib/view-models";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, ApiError } from "@/lib/api-client";
import { FilterBar } from "./FilterBar";
import { ListSettings } from "./ListSettings";
import { OrderTable } from "./OrderTable";
import { AddOrderButton } from "./AddOrderButton";
import { EmptyState } from "./EmptyState";
import { OrderRowContextMenu } from "./OrderRowContextMenu";
import { StatusFooter } from "./StatusFooter";
import { ComplaintReasonDialog } from "@/components/shared/ComplaintReasonDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { OrderDrawer } from "@/components/drawer/OrderDrawer";
import { HistoryPanel } from "@/components/history/HistoryPanel";

interface OrdersPageProps {
  activeView: ViewGroup;
  onViewChange: (view: ViewGroup) => void;
}

/**
 * Main orders page content — filters, settings, table, context menu, drawer, and empty state.
 * Tabs are in AppHeader — this component receives activeView as prop.
 */
export function OrdersPage({ activeView }: OrdersPageProps) {
  const { user } = useAuth();
  const {
    orders,
    totalItems,
    isLoading,
    filters,
    setFilters,
    resetFilters,
    refresh,
  } = useOrders();

  const [viewMode, setViewMode] = useState<ListViewMode>("route");

  // Sync activeView from props into filters
  useEffect(() => {
    if (filters.view !== activeView) {
      setFilters({ view: activeView });
    }
  }, [activeView, filters.view, setFilters]);

  // -- Context menu state --
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    orderId: null,
    order: null,
    position: { x: 0, y: 0 },
    isOpen: false,
  });

  // -- Drawer state --
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // -- Complaint reason dialog state --
  const [complaintDialog, setComplaintDialog] = useState<{
    isOpen: boolean;
    orderId: string | null;
  }>({ isOpen: false, orderId: null });

  // -- Cancel confirm dialog state --
  const [cancelDialog, setCancelDialog] = useState<{
    isOpen: boolean;
    orderId: string | null;
  }>({ isOpen: false, orderId: null });

  // -- History panel state --
  const [historyPanel, setHistoryPanel] = useState<{
    isOpen: boolean;
    orderId: string | null;
    orderNo: string;
  }>({ isOpen: false, orderId: null, orderNo: "" });

  // -- Last update time --
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  // Update last update time when orders change
  useEffect(() => {
    if (!isLoading && orders.length >= 0) {
      setLastUpdateTime(new Date().toLocaleTimeString("pl-PL"));
    }
  }, [isLoading, orders]);

  // -- Sort --
  const handleSort = useCallback(
    (sortBy: typeof filters.sortBy) => {
      if (filters.sortBy === sortBy) {
        setFilters({
          sortDirection: filters.sortDirection === "ASC" ? "DESC" : "ASC",
        });
      } else {
        setFilters({ sortBy, sortDirection: "ASC" });
      }
    },
    [filters.sortBy, filters.sortDirection, setFilters],
  );

  // -- Row click (open drawer) --
  const handleRowClick = useCallback((orderId: string) => {
    setDrawerOrderId(orderId);
    setIsDrawerOpen(true);
  }, []);

  // -- Row context menu --
  const handleRowContextMenu = useCallback(
    (orderId: string, event: React.MouseEvent) => {
      event.preventDefault();
      const order = orders.find((o) => o.id === orderId) ?? null;
      setContextMenu({
        orderId,
        order,
        position: { x: event.clientX, y: event.clientY },
        isOpen: true,
      });
    },
    [orders],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // -- Send email action --
  const handleSendEmail = useCallback(
    async (orderId: string) => {
      try {
        const result = await apiClient.post<PrepareEmailResponseDto>(
          `/api/v1/orders/${orderId}/prepare-email`,
        );
        window.open(result.emailOpenUrl, "_blank");
        toast.success("Email przygotowany — otwarto klienta poczty");
        refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 422 && err.body.error.details) {
            const missingFields = err.body.error.details
              .map((d) => d.message)
              .join("\n");
            toast.error("Nie można wysłać maila — brakujące dane", {
              description: missingFields,
              duration: 8000,
            });
          } else {
            toast.error(err.body.error.message);
          }
        } else {
          toast.error("Nie udało się przygotować maila");
        }
      }
    },
    [refresh],
  );

  // -- Change status action --
  const handleChangeStatus = useCallback(
    async (orderId: string, newStatus: OrderStatusCode, complaintReason?: string) => {
      try {
        await apiClient.post<ChangeStatusResponseDto>(
          `/api/v1/orders/${orderId}/status`,
          {
            newStatusCode: newStatus,
            ...(complaintReason ? { complaintReason } : {}),
          },
        );
        toast.success(`Status zmieniony na ${newStatus}`);
        refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.body.error.message);
        } else {
          toast.error("Nie udało się zmienić statusu");
        }
      }
    },
    [refresh],
  );

  // -- Request complaint reason --
  const handleRequestComplaintReason = useCallback((orderId: string) => {
    setComplaintDialog({ isOpen: true, orderId });
  }, []);

  const handleComplaintConfirm = useCallback(
    (reason: string) => {
      if (complaintDialog.orderId) {
        handleChangeStatus(complaintDialog.orderId, "REK", reason);
      }
      setComplaintDialog({ isOpen: false, orderId: null });
    },
    [complaintDialog.orderId, handleChangeStatus],
  );

  // -- Duplicate action --
  const handleDuplicate = useCallback(
    async (orderId: string) => {
      try {
        const result = await apiClient.post<DuplicateOrderResponseDto>(
          `/api/v1/orders/${orderId}/duplicate`,
          { includeStops: true, includeItems: true, resetStatusToDraft: true },
        );
        toast.success(`Zlecenie skopiowane: ${result.orderNo}`);
        refresh();
        setDrawerOrderId(result.id);
        setIsDrawerOpen(true);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.body.error.message);
        } else {
          toast.error("Nie udało się skopiować zlecenia");
        }
      }
    },
    [refresh],
  );

  // -- Cancel (delete) action --
  const handleCancelRequest = useCallback((orderId: string) => {
    setCancelDialog({ isOpen: true, orderId });
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    const orderId = cancelDialog.orderId;
    setCancelDialog({ isOpen: false, orderId: null });

    if (!orderId) return;

    try {
      await apiClient.delete(`/api/v1/orders/${orderId}`);
      toast.success("Zlecenie anulowane");
      refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.body.error.message);
      } else {
        toast.error("Nie udało się anulować zlecenia");
      }
    }
  }, [cancelDialog.orderId, refresh]);

  // -- Restore action --
  const handleRestore = useCallback(
    async (orderId: string, targetStatus: "ROB" | "WYS") => {
      try {
        await apiClient.post(`/api/v1/orders/${orderId}/restore`, {
          targetStatusCode: targetStatus,
        });
        toast.success("Zlecenie przywrócone do aktualnych");
        refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.body.error.message);
        } else {
          toast.error("Nie udało się przywrócić zlecenia");
        }
      }
    },
    [refresh],
  );

  // -- Show history --
  const handleShowHistory = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      setHistoryPanel({
        isOpen: true,
        orderId,
        orderNo: order?.orderNo ?? "",
      });
    },
    [orders],
  );

  // -- Add order --
  const handleOrderCreated = useCallback(
    (orderId: string) => {
      refresh();
      setDrawerOrderId(orderId);
      setIsDrawerOpen(true);
    },
    [refresh],
  );

  // -- Drawer close --
  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setDrawerOrderId(null);
  }, []);

  // -- Drawer order updated --
  const handleOrderUpdated = useCallback(() => {
    refresh();
  }, [refresh]);

  // Determine if we should show the add button
  const canCreate =
    filters.view === "CURRENT" && user?.role !== "READ_ONLY";

  // Determine empty state variant
  const hasActiveFilters =
    !!filters.transportType ||
    !!filters.carrierId ||
    !!filters.productId ||
    !!filters.loadingLocationId ||
    !!filters.unloadingLocationId ||
    !!filters.loadingDateFrom ||
    !!filters.loadingDateTo ||
    !!filters.unloadingDateFrom ||
    !!filters.unloadingDateTo ||
    !!filters.search;

  const showEmptyState = !isLoading && orders.length === 0;
  const showTooManyResults = !isLoading && orders.length > 0 && totalItems > filters.pageSize;
  const emptyVariant = hasActiveFilters ? "no_results" : "no_orders";

  // Compute status counts for footer
  const statusCounts = orders.reduce(
    (acc, order) => {
      const code = order.statusCode as OrderStatusCode;
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    },
    {} as Record<OrderStatusCode, number>,
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Filter bar — matches mockup: dark bg, border-bottom */}
      <section className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={resetFilters}
            />
          </div>
          <div className="flex items-end gap-2 pt-5">
            <ListSettings
              pageSize={filters.pageSize}
              viewMode={viewMode}
              onPageSizeChange={(size) => setFilters({ pageSize: size as 50 | 100 | 200 })}
              onViewModeChange={setViewMode}
            />
            {canCreate && <AddOrderButton onOrderCreated={handleOrderCreated} />}
          </div>
        </div>
      </section>

      {/* Table or empty state */}
      <div className="flex-1 overflow-auto">
        {showEmptyState ? (
          <EmptyState
            variant={emptyVariant}
            activeView={filters.view}
            onAddOrder={canCreate ? () => handleOrderCreated("") : undefined}
            onClearFilters={hasActiveFilters ? resetFilters : undefined}
          />
        ) : (
          <>
            <OrderTable
              orders={orders}
              sortBy={filters.sortBy}
              sortDirection={filters.sortDirection}
              viewMode={viewMode}
              isLoading={isLoading}
              onSort={handleSort}
              onRowClick={handleRowClick}
              onRowContextMenu={handleRowContextMenu}
              onSendEmail={handleSendEmail}
            />

            {/* Total items info + too many results warning */}
            {!isLoading && orders.length > 0 && showTooManyResults && (
              <div className="px-4 py-2 text-sm text-orange-600 font-medium">
                Wyświetlono {orders.length} z {totalItems} zleceń — zbyt wiele wyników, zawęź filtry
              </div>
            )}
          </>
        )}
      </div>

      {/* Status footer — sticky bottom */}
      <StatusFooter statusCounts={statusCounts} lastUpdateTime={lastUpdateTime} />

      {/* Context menu */}
      {contextMenu.isOpen && contextMenu.order && (
        <OrderRowContextMenu
          order={contextMenu.order}
          activeView={filters.view}
          position={contextMenu.position}
          isOpen={contextMenu.isOpen}
          userRole={user?.role ?? "READ_ONLY"}
          onClose={closeContextMenu}
          onSendEmail={handleSendEmail}
          onShowHistory={handleShowHistory}
          onChangeStatus={handleChangeStatus}
          onDuplicate={handleDuplicate}
          onCancel={handleCancelRequest}
          onRestore={handleRestore}
          onRequestComplaintReason={handleRequestComplaintReason}
        />
      )}

      {/* Order Drawer */}
      <OrderDrawer
        orderId={drawerOrderId}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Complaint reason dialog */}
      <ComplaintReasonDialog
        isOpen={complaintDialog.isOpen}
        onConfirm={handleComplaintConfirm}
        onCancel={() => setComplaintDialog({ isOpen: false, orderId: null })}
      />

      {/* Cancel confirm dialog */}
      <ConfirmDialog
        isOpen={cancelDialog.isOpen}
        title="Anuluj zlecenie"
        description="Czy na pewno chcesz anulować to zlecenie? Operacja zmieni status na Anulowany."
        confirmLabel="Anuluj zlecenie"
        cancelLabel="Nie, wróć"
        variant="destructive"
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelDialog({ isOpen: false, orderId: null })}
      />

      {/* History panel */}
      <HistoryPanel
        orderId={historyPanel.orderId}
        orderNo={historyPanel.orderNo}
        isOpen={historyPanel.isOpen}
        onClose={() =>
          setHistoryPanel({ isOpen: false, orderId: null, orderNo: "" })
        }
      />
    </div>
  );
}

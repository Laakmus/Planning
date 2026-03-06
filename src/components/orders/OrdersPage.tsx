/**
 * Główny kontener widoku zleceń.
 * Zarządza: filtrami, stroną, trybem widoku, wywołaniami API, stanem draweru (stub Faza 4).
 * Renderuje: FilterBar + OrderTable/EmptyState + paginacja + StatusFooter.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { useOrderActions } from "@/hooks/useOrderActions";
import { DEFAULT_FILTERS, hasActiveFilters } from "@/lib/view-models";
import type {
  ListViewMode,
  OrderListFilters,
  ViewGroup,
} from "@/lib/view-models";

import { OrderDrawer } from "./drawer/OrderDrawer";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { HistoryPanel } from "./history/HistoryPanel";
import { OrderTable } from "./OrderTable";
import StatusFooter from "./StatusFooter";

interface OrdersPageProps {
  activeView: ViewGroup;
}

export function OrdersPage({ activeView }: OrdersPageProps) {
  const { user, api } = useAuth();

  // Stan filtrów i paginacji
  const [filters, setFilters] = useState<OrderListFilters>({
    ...DEFAULT_FILTERS,
    view: activeView,
  });
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ListViewMode>("route");
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  // Stan draweru
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Stan panelu historii
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [historyOrderNo, setHistoryOrderNo] = useState<string>("");
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  // Synchronizuj activeView → filters.view
  useEffect(() => {
    setFilters((prev) => ({ ...prev, view: activeView }));
    setPage(1);
  }, [activeView]);

  // Pobierz listę zleceń
  const { data, isLoading, error, refetch } = useOrders(filters, page);

  // Akcje na zleceniach (wyekstrahowane do osobnego hooka)
  const {
    isCreatingOrder,
    cancelOrderId,
    setCancelOrderId,
    handleAddOrder,
    handleSendEmail,
    handleChangeStatus,
    handleCancelRequest,
    handleCancelConfirm,
    handleRestore,
    handleSetCarrierColor,
    handleSetEntryFixed,
    handleDuplicate,
  } = useOrderActions({ api, refetch, tableScrollRef });

  useEffect(() => {
    if (data) {
      setLastUpdateTime(new Date().toISOString());
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const filtersActive = hasActiveFilters(filters);

  // Uprawnienia
  const canWrite = user?.role !== "READ_ONLY";
  const showAddButton = canWrite && activeView === "CURRENT";

  // --- Handlery filtrów ---
  function handleFiltersChange(patch: Partial<OrderListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function handleClearFilters() {
    setFilters({ ...DEFAULT_FILTERS, view: activeView });
    setPage(1);
  }

  function handlePageSizeChange(size: number) {
    setFilters((prev) => ({ ...prev, pageSize: size }));
    setPage(1);
  }

  // --- Handlery sortowania ---
  function handleSort(sortBy: OrderListFilters["sortBy"]) {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortDirection:
        prev.sortBy === sortBy && prev.sortDirection === "ASC" ? "DESC" : "ASC",
    }));
    setPage(1);
  }

  // --- Handlery nawigacji ---
  function handleRowClick(orderId: string) {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  }

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedOrderId(null);
  }, []);

  function handleShowHistory(orderId: string, orderNo?: string) {
    const resolvedNo = orderNo ?? orders.find((o) => o.id === orderId)?.orderNo ?? "";
    setHistoryOrderId(orderId);
    setHistoryOrderNo(resolvedNo);
    setHistoryPanelOpen(true);
  }

  const orders = data?.items ?? [];
  const totalItems = data?.totalItems ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const isEmpty = !isLoading && orders.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Pasek filtrów */}
      <FilterBar
        filters={filters}
        viewMode={viewMode}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        onPageSizeChange={handlePageSizeChange}
        onViewModeChange={setViewMode}
        showAddButton={showAddButton}
        isAddingOrder={isCreatingOrder}
        onAddOrder={handleAddOrder}
      />

      {/* Tabela / EmptyState */}
      {isEmpty ? (
        <EmptyState
          hasFilters={filtersActive}
          showAddButton={showAddButton}
          isAddingOrder={isCreatingOrder}
          onAddOrder={handleAddOrder}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <OrderTable
          ref={tableScrollRef}
          orders={orders}
          sortBy={filters.sortBy}
          sortDirection={filters.sortDirection}
          viewMode={viewMode}
          isLoading={isLoading}
          activeView={activeView}
          onSort={handleSort}
          onRowClick={handleRowClick}
          onSendEmail={handleSendEmail}
          onShowHistory={handleShowHistory}
          onChangeStatus={handleChangeStatus}
          onDuplicate={handleDuplicate}
          onCancel={handleCancelRequest}
          onRestore={handleRestore}
          onSetCarrierColor={handleSetCarrierColor}
          onSetEntryFixed={handleSetEntryFixed}
        />
      )}

      {/* Prosta paginacja */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs px-3 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Poprzednia
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Strona {page} z {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-xs px-3 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Następna
          </button>
        </div>
      )}

      {/* Stopka ze statystykami */}
      <StatusFooter
        activeView={activeView}
        totalItems={totalItems}
        lastUpdateTime={lastUpdateTime}
      />

      {/* OrderDrawer */}
      <ErrorBoundary
        fallback={
          <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">
            Błąd ładowania formularza. Zamknij i otwórz ponownie.
          </div>
        }
      >
        <OrderDrawer
          orderId={selectedOrderId}
          isOpen={drawerOpen}
          onClose={handleDrawerClose}
          onOrderUpdated={refetch}
          onShowHistory={handleShowHistory}
        />
      </ErrorBoundary>

      {/* HistoryPanel */}
      <HistoryPanel
        orderId={historyOrderId}
        orderNo={historyOrderNo}
        isOpen={historyPanelOpen}
        onClose={() => {
          setHistoryPanelOpen(false);
          setHistoryOrderId(null);
          setHistoryOrderNo("");
        }}
      />

      {/* Dialog potwierdzenia anulowania zlecenia */}
      <AlertDialog open={!!cancelOrderId} onOpenChange={(open) => { if (!open) setCancelOrderId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anuluj zlecenie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz anulować to zlecenie? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nie</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancelConfirm}>
              Tak, anuluj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

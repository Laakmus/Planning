/**
 * Główny kontener widoku zleceń.
 * Zarządza: filtrami, stroną, trybem widoku, wywołaniami API, stanem draweru (stub Faza 4).
 * Renderuje: FilterBar + OrderTable/EmptyState + paginacja + StatusFooter.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { STATUS_NAMES } from "@/lib/view-models";

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
import { useMicrosoftAuth } from "@/contexts/MicrosoftAuthContext";
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
import { ValidationErrorDialog } from "./ValidationErrorDialog";
import { FilterBar } from "./FilterBar";
import { HistoryPanel } from "./history/HistoryPanel";
import { OrderTable } from "./OrderTable";
import StatusFooter from "./StatusFooter";

interface OrdersPageProps {
  activeView: ViewGroup;
}

export function OrdersPage({ activeView }: OrdersPageProps) {
  const { user, api } = useAuth();
  const microsoft = useMicrosoftAuth();

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
  const { data, isLoading, error, refetch, silentRefetch, updateOrderLocally } = useOrders(filters, page);

  // Akcje na zleceniach (wyekstrahowane do osobnego hooka)
  const {
    isCreatingOrder,
    pendingCancel,
    setPendingCancel,
    pendingStatusChange,
    setPendingStatusChange,
    pendingDuplicate,
    setPendingDuplicate,
    pendingRestore,
    setPendingRestore,
    handleAddOrder,
    handleSendEmail,
    handleChangeStatusRequest,
    handleChangeStatusConfirm,
    handleCancelRequest,
    handleCancelConfirm,
    handleRestoreRequest,
    handleRestoreConfirm,
    handleSetCarrierColor,
    handleSetEntryFixed,
    handleDuplicateRequest,
    handleDuplicateConfirm,
    emailValidationErrors,
    clearEmailValidationErrors,
  } = useOrderActions({ api, user, refetch, silentRefetch, updateOrderLocally, tableScrollRef, microsoft });

  // Stan pola powodu reklamacji w dialogu zmiany statusu
  const [complaintReasonInput, setComplaintReasonInput] = useState("");

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
          onChangeStatus={handleChangeStatusRequest}
          onDuplicate={handleDuplicateRequest}
          onCancel={handleCancelRequest}
          onRestore={handleRestoreRequest}
          onSetCarrierColor={handleSetCarrierColor}
          onSetEntryFixed={handleSetEntryFixed}
        />
      )}

      {/* Prosta paginacja */}
      {totalPages > 1 && (
        <div role="navigation" aria-label="Paginacja" className="shrink-0 flex items-center justify-center gap-2 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Poprzednia strona"
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
            aria-label="Następna strona"
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
        key={`drawer-${selectedOrderId ?? "new"}-${drawerOpen}`}
      >
        <OrderDrawer
          orderId={selectedOrderId}
          isOpen={drawerOpen}
          onClose={handleDrawerClose}
          onOrderUpdated={silentRefetch}
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
      <AlertDialog open={!!pendingCancel} onOpenChange={(open) => { if (!open) setPendingCancel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anuluj zlecenie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz anulować zlecenie <span className="font-semibold">{pendingCancel?.orderNo}</span>? Zlecenie przejdzie do zakładki Anulowane. Można je przywrócić w ciągu 24h.
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

      {/* Dialog potwierdzenia zmiany statusu */}
      <AlertDialog
        open={!!pendingStatusChange}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatusChange(null);
            setComplaintReasonInput("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmień status zlecenia</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Czy na pewno chcesz zmienić status zlecenia{" "}
                <span className="font-semibold">{pendingStatusChange?.orderNo}</span>{" "}
                na <span className="font-semibold">{pendingStatusChange ? STATUS_NAMES[pendingStatusChange.newStatus] : ""}</span>?
                {pendingStatusChange?.newStatus === "reklamacja" && (
                  <label className="block mt-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Powód reklamacji
                    </span>
                    <textarea
                      className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      rows={3}
                      maxLength={500}
                      placeholder="Opisz powód reklamacji..."
                      value={complaintReasonInput}
                      onChange={(e) => setComplaintReasonInput(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setComplaintReasonInput("")}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingStatusChange?.newStatus === "reklamacja" && !complaintReasonInput.trim()}
              onClick={() => {
                handleChangeStatusConfirm(
                  pendingStatusChange?.newStatus === "reklamacja" ? complaintReasonInput : undefined
                );
                setComplaintReasonInput("");
              }}
            >
              Tak, zmień status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog potwierdzenia duplikacji zlecenia */}
      <AlertDialog open={!!pendingDuplicate} onOpenChange={(open) => { if (!open) setPendingDuplicate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skopiuj zlecenie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz skopiować zlecenie <span className="font-semibold">{pendingDuplicate?.orderNo}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nie</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicateConfirm}>
              Tak, skopiuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog potwierdzenia przywrócenia zlecenia */}
      <AlertDialog open={!!pendingRestore} onOpenChange={(open) => { if (!open) setPendingRestore(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywróć zlecenie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz przywrócić zlecenie <span className="font-semibold">{pendingRestore?.orderNo}</span> do aktualnych?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nie</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              Tak, przywróć
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog walidacji email — brakujące pola (422) */}
      <ValidationErrorDialog
        open={emailValidationErrors.length > 0}
        onClose={clearEmailValidationErrors}
        missingFields={emailValidationErrors}
      />
    </div>
  );
}

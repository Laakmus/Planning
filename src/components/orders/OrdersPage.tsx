/**
 * Główny kontener widoku zleceń.
 * Zarządza: filtrami, stroną, trybem widoku, wywołaniami API, stanem draweru (stub Faza 4).
 * Renderuje: FilterBar + OrderTable/EmptyState + paginacja + StatusFooter.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import type { CarrierColorResponseDto, CreateOrderResponseDto, DuplicateOrderResponseDto, PrepareEmailResponseDto } from "@/types";
import { useOrders } from "@/hooks/useOrders";
import { DEFAULT_FILTERS } from "@/lib/view-models";
import type {
  ListViewMode,
  OrderListFilters,
  OrderStatusCode,
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

  // Stan tworzenia nowego zlecenia (blokada przycisku + spinner)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const isCreatingRef = useRef(false);
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

  // Pomocnicza funkcja do sprawdzenia aktywnych filtrów
  const hasActiveFilters =
    !!filters.transportType ||
    !!filters.status ||
    !!filters.carrierId ||
    !!filters.productId ||
    !!filters.loadingCompanyId ||
    !!filters.loadingLocationId ||
    !!filters.unloadingCompanyId ||
    !!filters.unloadingLocationId ||
    !!filters.weekNumber ||
    !!filters.search;

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

  // --- Handlery akcji ---
  function handleRowClick(orderId: string) {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  }

  const handleAddOrder = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreatingOrder(true);
    try {
      const result = await api.post<CreateOrderResponseDto>("/api/v1/orders", {
        transportTypeCode: "PL",
        currencyCode: "PLN",
        carrierCompanyId: null,
        shipperLocationId: null,
        receiverLocationId: null,
        vehicleVariantCode: null,
        priceAmount: null,
        paymentTermDays: null,
        paymentMethod: null,
        totalLoadTons: null,
        totalLoadVolumeM3: null,
        specialRequirements: null,
        requiredDocumentsText: null,
        generalNotes: null,
        senderContactName: null,
        senderContactPhone: null,
        senderContactEmail: null,
        stops: [],
        items: [],
      });
      toast.success(`Utworzono zlecenie ${result.orderNo}.`);
      await refetch();
      // Auto-scroll na dół po wyrenderowaniu nowego wiersza
      requestAnimationFrame(() => {
        tableScrollRef.current?.scrollTo({ top: tableScrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd tworzenia zlecenia.");
    } finally {
      isCreatingRef.current = false;
      setIsCreatingOrder(false);
    }
  }, [api, refetch]);

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

  const handleSendEmail = useCallback(
    async (orderId: string) => {
      try {
        const result = await api.post<PrepareEmailResponseDto>(
          `/api/v1/orders/${orderId}/prepare-email`,
          {}
        );
        if (result.emailOpenUrl) {
          window.open(result.emailOpenUrl, "_blank", "noopener,noreferrer");
        }
        toast.success("Email przygotowany — otwórz klienta pocztowego.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd wysyłki maila.");
      }
    },
    [api, refetch]
  );

  const handleChangeStatus = useCallback(
    async (orderId: string, newStatus: OrderStatusCode) => {
      try {
        await api.post(`/api/v1/orders/${orderId}/status`, { newStatusCode: newStatus });
        toast.success("Status zmieniony.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd zmiany statusu.");
      }
    },
    [api, refetch]
  );

  const handleCancel = useCallback(
    async (orderId: string) => {
      if (!confirm("Czy na pewno chcesz anulować to zlecenie?")) return;
      try {
        await api.delete(`/api/v1/orders/${orderId}`);
        toast.success("Zlecenie anulowane.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd anulowania zlecenia.");
      }
    },
    [api, refetch]
  );

  const handleRestore = useCallback(
    async (orderId: string) => {
      try {
        await api.post(`/api/v1/orders/${orderId}/restore`, {});
        toast.success("Zlecenie przywrócone do Aktualnych (status: Korekta).");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd przywracania zlecenia.");
      }
    },
    [api, refetch]
  );

  const handleSetCarrierColor = useCallback(
    async (orderId: string, color: string | null) => {
      try {
        await api.patch<CarrierColorResponseDto>(
          `/api/v1/orders/${orderId}/carrier-color`,
          { color }
        );
        toast.success(color ? "Kolor ustawiony." : "Kolor usunięty.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd ustawiania koloru.");
      }
    },
    [api, refetch]
  );

  const handleDuplicate = useCallback(
    async (orderId: string) => {
      try {
        const result = await api.post<DuplicateOrderResponseDto>(
          `/api/v1/orders/${orderId}/duplicate`,
          { includeStops: true, includeItems: true, resetStatusToDraft: true }
        );
        toast.success(`Zlecenie skopiowane jako ${result.orderNo}.`);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd kopiowania zlecenia.");
      }
    },
    [api, refetch]
  );

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
          hasFilters={hasActiveFilters}
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
          onCancel={handleCancel}
          onRestore={handleRestore}
          onSetCarrierColor={handleSetCarrierColor}
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
      <OrderDrawer
        orderId={selectedOrderId}
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        onOrderUpdated={refetch}
        onShowHistory={handleShowHistory}
      />

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
    </div>
  );
}

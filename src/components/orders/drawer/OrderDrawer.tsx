/**
 * Panel boczny zlecenia (Sheet, side=right).
 * Otwiera się kliknięciem na wiersz tabeli.
 * Przy otwarciu: lock zlecenia + fetch detali.
 * Przy zamknięciu: sprawdza isDirty → dialog → unlock.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { History, X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { formatDateFromTimestamp } from "@/lib/format-utils";
import type { OrderFormData, OrderStatusCode } from "@/lib/view-models";
import type {
  CreateOrderResponseDto,
  OrderDetailResponseDto,
  PrepareEmailResponseDto,
} from "@/types";

import { StatusBadge } from "../StatusBadge";
import OrderView from "../order-view/OrderView";
import { formDataToViewData, viewDataToFormData } from "../order-view/types";
import type { OrderViewData } from "../order-view/types";

import { DrawerFooter } from "./DrawerFooter";
import { OrderForm } from "./OrderForm";
import { PreviewUnsavedDialog } from "./PreviewUnsavedDialog";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

/** Empty defaults for new order creation. */
function createEmptyDetail(): OrderDetailResponseDto {
  return {
    order: {
      id: crypto.randomUUID(),
      orderNo: "",
      statusCode: "robocze",
      transportTypeCode: "PL",
      currencyCode: "PLN",
      priceAmount: null,
      paymentTermDays: null,
      paymentMethod: null,
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      summaryRoute: null,
      firstLoadingDate: null,
      firstLoadingTime: null,
      firstUnloadingDate: null,
      firstUnloadingTime: null,
      lastLoadingDate: null,
      lastLoadingTime: null,
      lastUnloadingDate: null,
      lastUnloadingTime: null,
      transportYear: null,
      firstLoadingCountry: null,
      firstUnloadingCountry: null,
      carrierCompanyId: null,
      carrierNameSnapshot: null,
      carrierLocationNameSnapshot: null,
      carrierAddressSnapshot: null,
      shipperLocationId: null,
      shipperNameSnapshot: null,
      shipperAddressSnapshot: null,
      receiverLocationId: null,
      receiverNameSnapshot: null,
      receiverAddressSnapshot: null,
      vehicleTypeText: null,
      vehicleCapacityVolumeM3: null,
      mainProductName: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: null,
      notificationDetails: null,
      confidentialityClause: null,
      complaintReason: null,
      senderContactName: null,
      senderContactPhone: null,
      senderContactEmail: null,
      createdAt: new Date().toISOString(),
      createdByUserId: "",
      updatedAt: new Date().toISOString(),
      updatedByUserId: null,
      lockedByUserId: null,
      lockedAt: null,
      // Pola z JOINów (api-plan §2.3)
      statusName: "Robocze",
      weekNumber: null,
      sentAt: null,
      sentByUserName: null,
      createdByUserName: null,
      updatedByUserName: null,
      lockedByUserName: null,
    },
    stops: [],
    items: [],
  };
}

/**
 * Buduje wspólne pola body zapisu (POST i PUT).
 * Stops i items różnią się strukturą między create/update, więc nie są tu uwzględnione.
 */
function buildSaveBody(formData: OrderFormData) {
  return {
    transportTypeCode: formData.transportTypeCode,
    currencyCode: formData.currencyCode,
    priceAmount: formData.priceAmount,
    paymentTermDays: formData.paymentTermDays,
    paymentMethod: formData.paymentMethod,
    totalLoadTons: formData.totalLoadTons,
    totalLoadVolumeM3: formData.totalLoadVolumeM3,
    carrierCompanyId: formData.carrierCompanyId,
    shipperLocationId: formData.shipperLocationId ?? null,
    receiverLocationId: formData.receiverLocationId ?? null,
    vehicleTypeText: formData.vehicleTypeText || null,
    vehicleCapacityVolumeM3: formData.vehicleCapacityVolumeM3,
    specialRequirements: formData.specialRequirements,
    requiredDocumentsText: formData.requiredDocumentsText,
    generalNotes: formData.generalNotes,
    notificationDetails: formData.notificationDetails,
    confidentialityClause: formData.confidentialityClause,
    senderContactName: formData.senderContactName,
    senderContactPhone: formData.senderContactPhone,
    senderContactEmail: formData.senderContactEmail?.trim() || null,
  };
}

interface OrderDrawerProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
  onShowHistory?: (orderId: string, orderNo: string) => void;
}

export function OrderDrawer({
  orderId,
  isOpen,
  onClose,
  onOrderUpdated,
  onShowHistory,
}: OrderDrawerProps) {
  const { user, api } = useAuth();

  const [detail, setDetail] = useState<OrderDetailResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Czy zlecenie jest zablokowane przez INNEGO użytkownika
  const [lockedByUserName, setLockedByUserName] = useState<string | null>(null);

  const submitRef = useRef<(() => void) | null>(null);
  const formDataRef = useRef<OrderFormData | null>(null);
  const isReadOnly = user?.role === "READ_ONLY" || !!lockedByUserName;

  // Stan OrderView (podgląd A4)
  const [showOrderView, setShowOrderView] = useState(false);
  const [orderViewInitialData, setOrderViewInitialData] = useState<OrderViewData | null>(null);
  const [showPreviewUnsavedDialog, setShowPreviewUnsavedDialog] = useState(false);

  const { companies, locations, products } = useDictionaries();

  // ---------------------------------------------------------------------------
  // Fetch detali + lock
  // ---------------------------------------------------------------------------

  const loadDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.get<OrderDetailResponseDto>(`/api/v1/orders/${id}`);
      setDetail(data);

      // Sprawdź blokadę przez innego użytkownika
      if (data.order.lockedByUserId && data.order.lockedByUserId !== user?.id) {
        // Zlecenie zajęte — nie lockujemy, otwieramy readonly
        // Próbujemy pobrać nazwę z detali (brak wprost w DTO — user może nie być w słowniku)
        setLockedByUserName("inny użytkownik");
      } else if (user?.role !== "READ_ONLY") {
        // Lockujemy zlecenie
        try {
          await api.post(`/api/v1/orders/${id}/lock`, {});
        } catch {
          // Lock mógł się nie udać (409 conflict lub błąd serwera) — otwieramy readonly
          setLockedByUserName("inny użytkownik");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd ładowania zlecenia.");
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  const isNewOrder = isOpen && !orderId;

  useEffect(() => {
    if (isOpen && orderId) {
      setDetail(null);
      setIsDirty(false);
      setLockedByUserName(null);
      loadDetail(orderId);
    } else if (isOpen && !orderId) {
      // New order mode — empty defaults, no lock
      setDetail(createEmptyDetail());
      setIsDirty(false);
      setLockedByUserName(null);
      setIsLoading(false);
    }
  }, [isOpen, orderId, loadDetail]);

  // Ostrzeżenie przy próbie odświeżenia/zamknięcia karty z niezapisanymi zmianami
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ---------------------------------------------------------------------------
  // Unlock przy zamknięciu
  // ---------------------------------------------------------------------------

  const doClose = useCallback(async () => {
    if (orderId && !lockedByUserName && user?.role !== "READ_ONLY") {
      try {
        await api.post(`/api/v1/orders/${orderId}/unlock`, {});
      } catch {
        // ignorujemy błąd unlock
      }
    }
    setDetail(null);
    setIsDirty(false);
    setLockedByUserName(null);
    setShowOrderView(false);
    setOrderViewInitialData(null);
    onClose();
  }, [orderId, lockedByUserName, user, api, onClose]);

  function handleCloseRequest() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      doClose();
    }
  }

  // ---------------------------------------------------------------------------
  // Zapis
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(
    async (formData: OrderFormData, pendingStatus: OrderStatusCode | null, complaintReason: string | null) => {
      if (!detail) return;

      // Walidacja: powód reklamacji wymagany
      if (pendingStatus === "reklamacja" && !complaintReason?.trim()) {
        toast.error("Podaj powód reklamacji.");
        return;
      }

      setIsSaving(true);
      try {
        if (!orderId) {
          // ---- CREATE NEW ORDER (POST) ----
          const body = buildSaveBody(formData);
          const result = await api.post<CreateOrderResponseDto>("/api/v1/orders", {
            ...body,
            stops: formData.stops
              .filter((s) => !s._deleted)
              .map((s) => ({
                kind: s.kind,
                dateLocal: s.dateLocal,
                timeLocal: s.timeLocal,
                locationId: s.locationId,
                notes: s.notes,
              })),
            items: formData.items
              .filter((it) => !it._deleted)
              .map((it) => ({
                productId: it.productId,
                productNameSnapshot: it.productNameSnapshot,
                loadingMethodCode: it.loadingMethodCode,
                quantityTons: it.quantityTons,
                notes: it.notes,
              })),
          });

          toast.success(`Zlecenie ${result.orderNo} utworzone.`);
          setIsDirty(false);
          onOrderUpdated();
          onClose();
        } else {
          // ---- UPDATE EXISTING ORDER (PUT) ----
          const body = buildSaveBody(formData);
          await api.put(`/api/v1/orders/${orderId}`, {
            ...body,
            stops: formData.stops.map((s) => ({
              id: s.id,
              kind: s.kind,
              sequenceNo: s.sequenceNo,
              dateLocal: s.dateLocal,
              timeLocal: s.timeLocal,
              locationId: s.locationId,
              notes: s.notes,
              _deleted: s._deleted,
            })),
            items: formData.items.map((it) => ({
              id: it.id,
              productId: it.productId,
              productNameSnapshot: it.productNameSnapshot,
              loadingMethodCode: it.loadingMethodCode,
              quantityTons: it.quantityTons,
              notes: it.notes,
              _deleted: it._deleted,
            })),
          });

          // Zmień status jeśli wybrano
          if (pendingStatus) {
            await api.post(`/api/v1/orders/${orderId}/status`, {
              newStatusCode: pendingStatus,
              ...(complaintReason ? { complaintReason } : {}),
            });
          }

          toast.success("Zlecenie zapisane.");
          // Najpierw zwolnij blokadę, potem odśwież listę — minimalizuje okno,
          // w którym inny użytkownik widzi wciąż zablokowane zlecenie.
          await doClose();
          onOrderUpdated();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd zapisu.");
      } finally {
        setIsSaving(false);
      }
    },
    [orderId, detail, api, onOrderUpdated, doClose, onClose]
  );

  // ---------------------------------------------------------------------------
  // Wydzielony zapis do API (reusable bez zamykania drawera)
  // ---------------------------------------------------------------------------

  const saveToApi = useCallback(async (formData: OrderFormData): Promise<boolean> => {
    if (!orderId || !detail) return false;
    setIsSaving(true);
    try {
      await api.put(`/api/v1/orders/${orderId}`, {
        transportTypeCode: formData.transportTypeCode,
        currencyCode: formData.currencyCode,
        priceAmount: formData.priceAmount,
        paymentTermDays: formData.paymentTermDays,
        paymentMethod: formData.paymentMethod,
        totalLoadTons: formData.totalLoadTons,
        totalLoadVolumeM3: formData.totalLoadVolumeM3,
        carrierCompanyId: formData.carrierCompanyId,
        shipperLocationId: formData.shipperLocationId ?? null,
        receiverLocationId: formData.receiverLocationId ?? null,
        vehicleTypeText: formData.vehicleTypeText || null,
        vehicleCapacityVolumeM3: formData.vehicleCapacityVolumeM3,
        specialRequirements: formData.specialRequirements,
        requiredDocumentsText: formData.requiredDocumentsText,
        generalNotes: formData.generalNotes,
        notificationDetails: formData.notificationDetails,
        confidentialityClause: formData.confidentialityClause,
        senderContactName: formData.senderContactName,
        senderContactPhone: formData.senderContactPhone,
        senderContactEmail: formData.senderContactEmail?.trim() || null,
        stops: formData.stops.map((s) => ({
          id: s.id,
          kind: s.kind,
          sequenceNo: s.sequenceNo,
          dateLocal: s.dateLocal,
          timeLocal: s.timeLocal,
          locationId: s.locationId,
          notes: s.notes,
          _deleted: s._deleted,
        })),
        items: formData.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productNameSnapshot: it.productNameSnapshot,
          loadingMethodCode: it.loadingMethodCode,
          quantityTons: it.quantityTons,
          notes: it.notes,
          _deleted: it._deleted,
        })),
      });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd zapisu.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [orderId, detail, api]);

  // ---------------------------------------------------------------------------
  // Handlery OrderView (podgląd A4)
  // ---------------------------------------------------------------------------

  /** Otwiera OrderView — helper wewnętrzny */
  const openOrderView = useCallback((formData: OrderFormData) => {
    if (!detail) return;
    const viewData = formDataToViewData(
      formData,
      detail.order.orderNo,
      detail.order.createdAt,
      formData.senderContactName ?? "",
      formData.senderContactEmail ?? "",
      formData.senderContactPhone ?? "",
      locations,
      companies,
    );
    setOrderViewInitialData(viewData);
    setShowOrderView(true);
  }, [detail, companies, locations]);

  /** Kliknięcie "Podgląd" w DrawerFooter */
  const handleOpenOrderView = useCallback(() => {
    const currentFormData = formDataRef.current;
    if (!currentFormData) return;

    if (isDirty) {
      // Niezapisane zmiany — pokaż dialog 3-opcyjny
      setShowPreviewUnsavedDialog(true);
    } else {
      openOrderView(currentFormData);
    }
  }, [isDirty, openOrderView]);

  /** Dialog "Zapisz i przejdź" */
  const handlePreviewSaveAndGo = useCallback(async () => {
    const currentFormData = formDataRef.current;
    if (!currentFormData) return;
    const ok = await saveToApi(currentFormData);
    setShowPreviewUnsavedDialog(false);
    if (ok && orderId) {
      // Re-fetch detali po zapisie
      await loadDetail(orderId);
      // Odczytaj świeże formData po re-fetch (useEffect w OrderForm zaktualizuje formDataRef)
      setTimeout(() => {
        const freshFormData = formDataRef.current;
        if (freshFormData) openOrderView(freshFormData);
      }, 100);
      setIsDirty(false);
    }
  }, [saveToApi, orderId, loadDetail, openOrderView]);

  /** Dialog "Odrzuć zmiany i przejdź" */
  const handlePreviewDiscardAndGo = useCallback(() => {
    setShowPreviewUnsavedDialog(false);
    // Użyj oryginalne dane z detali (nie zmienionych formData)
    if (detail) {
      const originalFormData: OrderFormData = {
        transportTypeCode: (detail.order.transportTypeCode as any) ?? "PL",
        currencyCode: (detail.order.currencyCode as any) ?? "PLN",
        priceAmount: detail.order.priceAmount,
        paymentTermDays: detail.order.paymentTermDays,
        paymentMethod: detail.order.paymentMethod,
        totalLoadTons: detail.order.totalLoadTons,
        totalLoadVolumeM3: detail.order.totalLoadVolumeM3,
        carrierCompanyId: detail.order.carrierCompanyId,
        shipperLocationId: detail.order.shipperLocationId,
        receiverLocationId: detail.order.receiverLocationId,
        vehicleTypeText: detail.order.vehicleTypeText,
        vehicleCapacityVolumeM3: detail.order.vehicleCapacityVolumeM3,
        specialRequirements: detail.order.specialRequirements,
        requiredDocumentsText: detail.order.requiredDocumentsText,
        generalNotes: detail.order.generalNotes,
        notificationDetails: detail.order.notificationDetails,
        confidentialityClause: detail.order.confidentialityClause,
        complaintReason: detail.order.complaintReason,
        senderContactName: detail.order.senderContactName,
        senderContactPhone: detail.order.senderContactPhone,
        senderContactEmail: detail.order.senderContactEmail,
        stops: detail.stops.map((s) => ({
          id: s.id,
          kind: s.kind as "LOADING" | "UNLOADING",
          sequenceNo: s.sequenceNo,
          dateLocal: s.dateLocal,
          timeLocal: s.timeLocal,
          locationId: s.locationId,
          locationNameSnapshot: s.locationNameSnapshot,
          companyNameSnapshot: s.companyNameSnapshot,
          addressSnapshot: s.addressSnapshot,
          notes: s.notes,
          _deleted: false,
        })),
        items: detail.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productNameSnapshot: it.productNameSnapshot,
          defaultLoadingMethodSnapshot: it.defaultLoadingMethodSnapshot,
          loadingMethodCode: it.loadingMethodCode,
          quantityTons: it.quantityTons,
          notes: it.notes,
          _deleted: false,
        })),
      };
      openOrderView(originalFormData);
    }
  }, [detail, openOrderView]);

  /** Zapis z OrderView */
  const handleOrderViewSave = useCallback(async (viewData: OrderViewData) => {
    const originalFormData = formDataRef.current;
    if (!originalFormData || !orderId) return;

    const mergedFormData = viewDataToFormData(
      viewData,
      originalFormData,
      locations,
      companies,
      products,
    );

    const ok = await saveToApi(mergedFormData);
    if (ok) {
      toast.success("Zlecenie zapisane.");
      setShowOrderView(false);
      setOrderViewInitialData(null);
      await loadDetail(orderId);
      setIsDirty(false);
      onOrderUpdated();
    }
  }, [orderId, locations, companies, products, saveToApi, loadDetail, onOrderUpdated]);

  /** Anulowanie z OrderView */
  const handleOrderViewCancel = useCallback(() => {
    setShowOrderView(false);
    setOrderViewInitialData(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Generuj PDF
  // ---------------------------------------------------------------------------

  const handleGeneratePdf = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await api.postRaw(`/api/v1/orders/${orderId}/pdf`, {});
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zlecenie-${(detail?.order.orderNo ?? orderId).replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF pobrany.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd generowania PDF.");
    }
  }, [orderId, detail, api]);

  const handleSendEmailFromDrawer = useCallback(async () => {
    if (!orderId) return;
    try {
      const result = await api.post<PrepareEmailResponseDto>(
        `/api/v1/orders/${orderId}/prepare-email`,
        {}
      );
      if (result.emailOpenUrl) {
        window.open(result.emailOpenUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("Email przygotowany — otwórz klienta pocztowego.");
      onOrderUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd przygotowania maila.");
    }
  }, [orderId, api, onOrderUpdated]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Status name lookup
  const statusName = detail?.order.statusCode
    ? detail.order.statusCode
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "";

  const historyHandler =
    onShowHistory && orderId && detail
      ? () => onShowHistory(orderId, detail.order.orderNo)
      : undefined;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && handleCloseRequest()}>
        <SheetContent
          side="right"
          className={`w-full p-0 flex flex-col ${showOrderView ? "sm:max-w-[65vw]" : "sm:max-w-[800px]"}`}
          showCloseButton={false}
          onInteractOutside={(e) => {
            e.preventDefault();
            handleCloseRequest();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleCloseRequest();
          }}
        >
          {/* Ukryty tytuł + opis dla screen readerów (wymóg Radix Dialog) */}
          <SheetTitle className="sr-only">
            {detail?.order.orderNo ?? "Zlecenie transportowe"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Szczegóły zlecenia transportowego
          </SheetDescription>

          {/* Custom Header */}
          <header className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCloseRequest}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                title="Zamknij (Escape)"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight">
                    {isNewOrder ? "Nowe zlecenie" : (detail?.order.orderNo ?? (isLoading ? "Ładowanie…" : "Zlecenie"))}
                  </h1>
                  {detail && (
                    <StatusBadge statusCode={detail.order.statusCode} statusName={statusName} />
                  )}
                </div>
                {detail && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Utworzono: {formatDateFromTimestamp(detail.order.createdAt)}
                  </p>
                )}
              </div>
            </div>
            {historyHandler && (
              <button
                type="button"
                onClick={historyHandler}
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" />
                Historia zmian
              </button>
            )}
          </header>

          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-slate-400">Ładowanie zlecenia…</div>
            </div>
          )}

          {!isLoading && detail && showOrderView && orderViewInitialData && (
            <OrderView
              initialData={orderViewInitialData}
              isReadOnly={isReadOnly}
              onSave={handleOrderViewSave}
              onCancel={handleOrderViewCancel}
              onGeneratePdf={handleGeneratePdf}
            />
          )}

          {!isLoading && detail && !showOrderView && (
            <>
              <OrderForm
                order={detail.order}
                stops={detail.stops}
                items={detail.items}
                isReadOnly={isReadOnly}
                onDirtyChange={setIsDirty}
                onSave={handleSave}
                submitRef={submitRef}
                formDataRef={formDataRef}
              />

              <DrawerFooter
                isReadOnly={isReadOnly}
                isSaving={isSaving}
                isDirty={isDirty}
                lockedByUserName={lockedByUserName}
                onSave={() => submitRef.current?.()}
                onClose={handleCloseRequest}
                onShowPreview={
                  !isNewOrder && !isReadOnly
                    ? handleOpenOrderView
                    : undefined
                }
                onSendEmail={
                  !isReadOnly &&
                  detail &&
                  (detail.order.statusCode === "robocze" || detail.order.statusCode === "korekta" || detail.order.statusCode === "wysłane" || detail.order.statusCode === "korekta wysłane")
                    ? handleSendEmailFromDrawer
                    : undefined
                }
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onConfirm={() => {
          setShowUnsavedDialog(false);
          doClose();
        }}
        onCancel={() => setShowUnsavedDialog(false)}
      />

      <PreviewUnsavedDialog
        open={showPreviewUnsavedDialog}
        isSaving={isSaving}
        onSave={handlePreviewSaveAndGo}
        onDiscard={handlePreviewDiscardAndGo}
        onCancel={() => setShowPreviewUnsavedDialog(false)}
      />
    </>
  );
}

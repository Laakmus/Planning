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
import { formatDateFromTimestamp } from "@/lib/format-utils";
import type { OrderFormData, OrderStatusCode } from "@/lib/view-models";
import type {
  CreateOrderResponseDto,
  OrderDetailResponseDto,
  PrepareEmailResponseDto,
} from "@/types";

import { StatusBadge } from "../StatusBadge";

import { DrawerFooter } from "./DrawerFooter";
import { OrderForm } from "./OrderForm";
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
      vehicleVariantCode: "",
      mainProductName: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: null,
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
    },
    stops: [],
    items: [],
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
  const isReadOnly = user?.role === "READ_ONLY" || !!lockedByUserName;

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
          const result = await api.post<CreateOrderResponseDto>("/api/v1/orders", {
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
            vehicleVariantCode: formData.vehicleVariantCode,
            specialRequirements: formData.specialRequirements,
            requiredDocumentsText: formData.requiredDocumentsText,
            generalNotes: formData.generalNotes,
            senderContactName: formData.senderContactName,
            senderContactPhone: formData.senderContactPhone,
            senderContactEmail: formData.senderContactEmail?.trim() || null,
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
            vehicleVariantCode: formData.vehicleVariantCode,
            specialRequirements: formData.specialRequirements,
            requiredDocumentsText: formData.requiredDocumentsText,
            generalNotes: formData.generalNotes,
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

          // Zmień status jeśli wybrano
          if (pendingStatus) {
            await api.post(`/api/v1/orders/${orderId}/status`, {
              newStatusCode: pendingStatus,
              ...(complaintReason ? { complaintReason } : {}),
            });
          }

          toast.success("Zlecenie zapisane.");
          onOrderUpdated();
          await doClose();
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
      a.download = `zlecenie-${detail?.order.orderNo ?? orderId}.pdf`;
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
          className="w-full sm:max-w-[800px] p-0 flex flex-col"
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

          {!isLoading && detail && (
            <>
              <OrderForm
                order={detail.order}
                stops={detail.stops}
                items={detail.items}
                isReadOnly={isReadOnly}
                onDirtyChange={setIsDirty}
                onSave={handleSave}
                submitRef={submitRef}
              />

              <DrawerFooter
                isReadOnly={isReadOnly}
                isSaving={isSaving}
                isDirty={isDirty}
                lockedByUserName={lockedByUserName}
                onSave={() => submitRef.current?.()}
                onClose={handleCloseRequest}
                onGeneratePdf={handleGeneratePdf}
                onSendEmail={
                  !isReadOnly &&
                  detail &&
                  (detail.order.statusCode === "robocze" || detail.order.statusCode === "korekta" || detail.order.statusCode === "wysłane" || detail.order.statusCode === "korekta wysłane")
                    ? handleSendEmailFromDrawer
                    : undefined
                }
                onShowHistory={historyHandler}
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
    </>
  );
}

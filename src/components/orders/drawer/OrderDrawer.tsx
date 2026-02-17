/**
 * Panel boczny zlecenia (Sheet, side=right).
 * Otwiera się kliknięciem na wiersz tabeli.
 * Przy otwarciu: lock zlecenia + fetch detali.
 * Przy zamknięciu: sprawdza isDirty → dialog → unlock.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderFormData, OrderStatusCode } from "@/lib/view-models";
import type {
  OrderDetailResponseDto,
  PrepareEmailResponseDto,
} from "@/types";

import { DrawerFooter } from "./DrawerFooter";
import { OrderForm } from "./OrderForm";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

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
          // Lock mógł się nie udać jeśli ktoś przejął — ignorujemy, otwieramy readonly
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd ładowania zlecenia.");
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    if (isOpen && orderId) {
      setDetail(null);
      setIsDirty(false);
      setLockedByUserName(null);
      loadDetail(orderId);
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
      if (!orderId || !detail) return;

      // Walidacja: powód reklamacji wymagany
      if (pendingStatus === "reklamacja" && !complaintReason?.trim()) {
        toast.error("Podaj powód reklamacji.");
        return;
      }

      setIsSaving(true);
      try {
        // Zapisz dane zlecenia
        await api.put(`/api/v1/orders/${orderId}`, {
          transportTypeCode: formData.transportTypeCode,
          currencyCode: formData.currencyCode,
          priceAmount: formData.priceAmount,
          paymentTermDays: formData.paymentTermDays,
          paymentMethod: formData.paymentMethod,
          totalLoadTons: formData.totalLoadTons,
          totalLoadVolumeM3: formData.totalLoadVolumeM3,
          carrierCompanyId: formData.carrierCompanyId,
          vehicleVariantCode: formData.vehicleVariantCode,
          specialRequirements: formData.specialRequirements,
          requiredDocumentsText: formData.requiredDocumentsText,
          generalNotes: formData.generalNotes,
          senderContactName: formData.senderContactName,
          senderContactPhone: formData.senderContactPhone,
          senderContactEmail: formData.senderContactEmail,
          stops: formData.stops.map((s) => ({
            id: s.id,
            kind: s.kind,
            sequenceNo: s.sequenceNo,
            dateLocal: s.dateLocal,
            timeLocal: s.timeLocal,
            locationId: s.locationId,
            companyNameSnapshot: s.companyNameSnapshot,
            locationNameSnapshot: s.locationNameSnapshot,
            addressSnapshot: s.addressSnapshot,
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Błąd zapisu.");
      } finally {
        setIsSaving(false);
      }
    },
    [orderId, detail, api, onOrderUpdated, doClose]
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

  const title = detail?.order.orderNo ?? (isLoading ? "Ładowanie…" : "Zlecenie");

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && handleCloseRequest()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[760px] p-0 flex flex-col"
          onInteractOutside={(e) => {
            e.preventDefault();
            handleCloseRequest();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleCloseRequest();
          }}
        >
          <SheetHeader className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          </SheetHeader>

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
                  (detail.order.statusCode === "robocze" || detail.order.statusCode === "korekta")
                    ? handleSendEmailFromDrawer
                    : undefined
                }
                onShowHistory={
                  onShowHistory && orderId && detail
                    ? () => onShowHistory(orderId, detail.order.orderNo)
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
    </>
  );
}

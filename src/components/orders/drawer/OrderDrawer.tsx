/**
 * Panel boczny zlecenia (Sheet, side=right).
 * Otwiera się kliknięciem na wiersz tabeli.
 * Przy otwarciu: lock zlecenia + fetch detali.
 * Przy zamknięciu: sprawdza isDirty → dialog → unlock.
 */

import { AlertTriangle, History, RefreshCw, X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOrderDrawer } from "@/hooks/useOrderDrawer";
import { formatDateTimeFromTimestamp } from "@/lib/format-utils";

import { StatusBadge } from "../StatusBadge";

import OrderView from "../order-view/OrderView";

import { ValidationErrorDialog } from "../ValidationErrorDialog";
import { DrawerFooter } from "./DrawerFooter";
import { DrawerSkeleton } from "./DrawerSkeleton";
import { OrderForm } from "./OrderForm";
import { PreviewUnsavedDialog } from "./PreviewUnsavedDialog";
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
  const {
    detail,
    isLoading,
    isSaving,
    isSendingEmail,
    isDirty,
    isReadOnly,
    isNewOrder,
    statusName,
    lockedByUserName,
    loadError,
    showUnsavedDialog,
    showOrderView,
    orderViewInitialData,
    showPreviewUnsavedDialog,
    submitRef,
    formDataRef,
    orderViewDirtyRef,
    setIsDirty,
    setShowUnsavedDialog,
    setShowPreviewUnsavedDialog,
    handleCloseRequest,
    handleSave,
    handleGeneratePdf,
    handleSendEmailFromDrawer,
    handleOpenOrderView,
    handlePreviewSaveAndGo,
    handlePreviewDiscardAndGo,
    handleOrderViewSave,
    handleOrderViewCancel,
    doClose,
    retryLoadDetail,
    historyHandler,
    emailValidationErrors,
    clearEmailValidationErrors,
  } = useOrderDrawer({
    orderId,
    isOpen,
    onClose,
    onOrderUpdated,
    onShowHistory,
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && handleCloseRequest()}>
        <SheetContent
          side="right"
          className={`w-full p-0 flex flex-col overflow-hidden ${showOrderView ? "sm:max-w-[65vw]" : "sm:max-w-[800px]"}`}
          showCloseButton={false}
          data-testid="order-drawer"
          onInteractOutside={(e) => {
            e.preventDefault();
            // Nie zamykaj drawera gdy kliknięto w nasz AlertDialog (renderowany w Portal poza Sheet)
            const target = e.target as HTMLElement;
            if (target?.closest?.('[role="alertdialog"]')) return;
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
                aria-label="Zamknij"
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
                    Utworzono: {formatDateTimeFromTimestamp(detail.order.createdAt)}
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

          {isLoading && <DrawerSkeleton />}

          {/* Widok błędu — gdy loadDetail zwrócił błąd */}
          {!isLoading && !detail && loadError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-sm">
                {loadError}
              </p>
              <button
                type="button"
                onClick={retryLoadDetail}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Spróbuj ponownie
              </button>
            </div>
          )}

          {!isLoading && detail && showOrderView && orderViewInitialData && (
            <OrderView
              initialData={orderViewInitialData}
              isReadOnly={isReadOnly}
              onSave={handleOrderViewSave}
              onCancel={handleOrderViewCancel}
              onGeneratePdf={handleGeneratePdf}
              onDirtyChange={(dirty) => { orderViewDirtyRef.current = dirty; }}
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
                isSendingEmail={isSendingEmail}
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

      {/* Dialog walidacji email — brakujące pola (422) */}
      <ValidationErrorDialog
        open={emailValidationErrors.length > 0}
        onClose={clearEmailValidationErrors}
        missingFields={emailValidationErrors}
      />
    </>
  );
}

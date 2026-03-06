/**
 * Panel boczny zlecenia (Sheet, side=right).
 * Otwiera się kliknięciem na wiersz tabeli.
 * Przy otwarciu: lock zlecenia + fetch detali.
 * Przy zamknięciu: sprawdza isDirty → dialog → unlock.
 */

import { History, X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOrderDrawer } from "@/hooks/useOrderDrawer";
import { formatDateFromTimestamp } from "@/lib/format-utils";

import { StatusBadge } from "../StatusBadge";
import OrderView from "../order-view/OrderView";

import { DrawerFooter } from "./DrawerFooter";
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
    isDirty,
    isReadOnly,
    isNewOrder,
    statusName,
    lockedByUserName,
    showUnsavedDialog,
    showOrderView,
    orderViewInitialData,
    showPreviewUnsavedDialog,
    submitRef,
    formDataRef,
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
    historyHandler,
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

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Lock, AlertTriangle, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { UpdateOrderCommand } from "@/types";
import { ApiError } from "@/lib/api-client";
import { useOrderDetail } from "@/hooks/useOrderDetail";
import { OrderForm, FormValidationError } from "./OrderForm";
import { DrawerFooter } from "./DrawerFooter";
import { UnsavedChangesDialog } from "@/components/shared/UnsavedChangesDialog";
import { StatusBadge } from "@/components/orders/StatusBadge";

interface OrderDrawerProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

/**
 * Side sheet drawer (~720px) for viewing/editing an order.
 * Handles lock/unlock lifecycle, read-only mode, unsaved changes warning,
 * and delegates form rendering to OrderForm.
 */
export function OrderDrawer({
  orderId,
  isOpen,
  onClose,
  onOrderUpdated,
}: OrderDrawerProps) {
  const {
    orderData,
    isLoading,
    isReadOnly,
    lockedByUserName,
    error,
    isSaving,
    openOrder,
    closeOrder,
    saveOrder,
    generatePdf,
    sendEmail,
    reloadOrder,
  } = useOrderDetail();

  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Ref to the form's getData method
  const formDataRef = useRef<(() => UpdateOrderCommand) | null>(null);

  // Open order when drawer opens
  useEffect(() => {
    if (isOpen && orderId) {
      openOrder(orderId);
      setIsDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId]);

  // Warn on browser tab close/refresh if there are unsaved changes
  useEffect(() => {
    if (!isDirty || isReadOnly) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a default prompt
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isReadOnly]);

  // Register form data getter
  const registerFormDataGetter = useCallback((getter: () => UpdateOrderCommand) => {
    formDataRef.current = getter;
  }, []);

  // Handle drawer close attempt — check for unsaved changes
  const handleCloseAttempt = useCallback(() => {
    if (isDirty && !isReadOnly) {
      setShowUnsavedDialog(true);
    } else {
      closeOrder();
      onClose();
    }
  }, [isDirty, isReadOnly, closeOrder, onClose]);

  // Confirm discard changes
  const handleConfirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    setIsDirty(false);
    closeOrder();
    onClose();
  }, [closeOrder, onClose]);

  // Save handler — validates locally first, then sends to API
  const handleSave = useCallback(async () => {
    if (!formDataRef.current) return;

    // formDataRef.current() runs validation and throws FormValidationError on failure
    let data: UpdateOrderCommand;
    try {
      data = formDataRef.current();
    } catch (err) {
      if (err instanceof FormValidationError) {
        toast.error("Popraw błędy w formularzu", {
          description: Object.values(err.fieldErrors).slice(0, 3).join(", "),
        });
        return;
      }
      throw err;
    }

    try {
      const success = await saveOrder(data);
      if (success) {
        setIsDirty(false);
        toast.success("Zlecenie zapisane");
        onOrderUpdated();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.body.error.details) {
          toast.error("Popraw błędy w formularzu", {
            description: err.body.error.details.map((d: { message: string }) => d.message).join(", "),
          });
        } else if (err.status === 403) {
          toast.error("Brak uprawnień do tej operacji");
        } else if (err.status === 404) {
          toast.error("Zlecenie nie istnieje");
          onClose();
          onOrderUpdated();
        } else if (err.status === 409) {
          toast.error("Zlecenie zostało zmodyfikowane przez innego użytkownika. Odśwież dane.");
          reloadOrder();
        } else {
          toast.error(err.body.error.message);
        }
      } else {
        toast.error("Nie udało się zapisać zlecenia");
      }
    }
  }, [saveOrder, onOrderUpdated, onClose, reloadOrder]);

  // Generate PDF handler
  const handleGeneratePdf = useCallback(async () => {
    try {
      const blobUrl = await generatePdf();
      if (blobUrl) {
        // Trigger download
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `zlecenie-${orderData?.order.orderNo ?? "export"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success("PDF wygenerowany");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.body.error.message);
      } else {
        toast.error("Nie udało się wygenerować PDF");
      }
    }
  }, [generatePdf, orderData?.order.orderNo]);

  // Send email handler
  const handleSendEmail = useCallback(async () => {
    try {
      const result = await sendEmail();
      if (result) {
        window.open(result.emailOpenUrl, "_blank");
        toast.success("Email przygotowany — otwarto klienta poczty");
        onOrderUpdated();
        reloadOrder();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.body.error.details) {
          const missing = err.body.error.details.map((d) => d.message).join("\n");
          toast.error("Nie można wysłać maila — brakujące dane", {
            description: missing,
            duration: 8000,
          });
        } else {
          toast.error(err.body.error.message);
        }
      } else {
        toast.error("Nie udało się przygotować maila");
      }
    }
  }, [sendEmail, onOrderUpdated, reloadOrder]);

  // Handle Sheet open change (backdrop click, Escape)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleCloseAttempt();
      }
    },
    [handleCloseAttempt],
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[800px] flex flex-col p-0 border-l border-slate-200 dark:border-slate-800"
          showCloseButton={false}
        >
          {/* Header — matches test/kompletne_dane.html */}
          <SheetHeader className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-white dark:bg-[#0d151c]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCloseAttempt}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <SheetTitle className="text-xl font-bold tracking-tight">
                      {orderData
                        ? `#${orderData.order.orderNo}`
                        : "Ładowanie..."}
                    </SheetTitle>
                    {orderData && (
                      <StatusBadge
                        statusCode={orderData.order.statusCode}
                        statusName=""
                        pill
                      />
                    )}
                    {/* Lock/readonly indicator */}
                    {isReadOnly && (
                      <Badge variant="outline" className="gap-1 text-orange-600 border-orange-200">
                        <Lock className="h-3 w-3" />
                        {lockedByUserName
                          ? `Edytowane przez ${lockedByUserName}`
                          : "Tylko podgląd"}
                      </Badge>
                    )}
                  </div>
                  {orderData && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Utworzono: {new Date(orderData.order.createdAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <SheetDescription className="sr-only">
              Panel edycji zlecenia transportowego
            </SheetDescription>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : orderData ? (
              <ScrollArea className="h-full custom-scrollbar">
                <div className="p-6 space-y-8">
                  <OrderForm
                    order={orderData.order}
                    stops={orderData.stops}
                    items={orderData.items}
                    isReadOnly={isReadOnly}
                    onDirtyChange={setIsDirty}
                    registerDataGetter={registerFormDataGetter}
                  />
                </div>
              </ScrollArea>
            ) : null}
          </div>

          {/* Footer */}
          {orderData && (
            <DrawerFooter
              isReadOnly={isReadOnly}
              isSaving={isSaving}
              isDirty={isDirty}
              onSave={handleSave}
              onCancel={handleCloseAttempt}
              onGeneratePdf={handleGeneratePdf}
              onSendEmail={handleSendEmail}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onConfirmDiscard={handleConfirmDiscard}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </>
  );
}

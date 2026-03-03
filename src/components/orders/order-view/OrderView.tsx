// OrderView — kontener z toolbarem dla podgladu dokumentu A4

import { useState, useRef, useCallback, useEffect } from "react";
import { FileText } from "lucide-react";
import OrderDocument from "./OrderDocument";
import type { OrderViewData, OrderViewProps } from "./types";
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

// ---------------------------------------------------------------------------
// OrderView — zarzadza stanem, detekcja zmian, skroty klawiszowe, toolbar
// ---------------------------------------------------------------------------

export default function OrderView({
  initialData,
  isReadOnly = false,
  onSave,
  onCancel,
  onGeneratePdf,
}: OrderViewProps) {
  // -- Stan --
  const [data, setData] = useState<OrderViewData>(initialData);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Stabilna referencja do oryginalnych danych (aktualizowana po zapisie)
  const originalDataRef = useRef<OrderViewData>(initialData);

  // -- Detekcja zmian --
  const isDirty =
    JSON.stringify(data) !== JSON.stringify(originalDataRef.current);

  // -- Handlery --
  const handleChange = useCallback((updated: OrderViewData) => {
    setData(updated);
  }, []);

  const handleSave = useCallback(() => {
    if (!isDirty) return;
    onSave?.(data);
    // Reset stanu dirty po zapisie
    originalDataRef.current = data;
    setData({ ...data });
  }, [data, isDirty, onSave]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowConfirmDialog(true);
    } else {
      onCancel?.();
    }
  }, [isDirty, onCancel]);

  const handleConfirmDiscard = useCallback(() => {
    setData(originalDataRef.current);
    setShowConfirmDialog(false);
    onCancel?.();
  }, [onCancel]);

  const handleContinueEditing = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  // -- Skroty klawiszowe --
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+S / Cmd+S -> zapisz
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isReadOnly) {
          handleSave();
        }
      }
      // Escape -> anuluj (z dirty check)
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, isReadOnly, handleSave, handleCancel]);

  // -- Render --
  return (
    <>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm print:hidden">
          {/* Lewa strona: tytul + wskaznik zmian */}
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Podgląd zlecenia {data.orderNo}
            </h2>
            {isDirty && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                Niezapisane zmiany
              </span>
            )}
          </div>

          {/* Prawa strona: przyciski akcji */}
          <div className="flex items-center gap-2">
            {/* Generuj PDF — outline */}
            {onGeneratePdf && !isReadOnly && (
              <button
                type="button"
                onClick={onGeneratePdf}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:ring-offset-1"
              >
                <FileText className="h-4 w-4" />
                Generuj PDF
              </button>
            )}

            {/* Anuluj — secondary */}
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:ring-offset-1"
            >
              Anuluj
            </button>

            {/* Zapisz zmiany — primary */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                Zapisz zmiany
              </button>
            )}
          </div>
        </div>

        {/* Scrollowalny obszar dokumentu */}
        <div className="flex-1 overflow-auto flex justify-center bg-slate-100 dark:bg-slate-900 p-4 print:p-0 print:bg-white">
          <OrderDocument
            data={data}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Dialog potwierdzenia odrzucenia zmian — shadcn AlertDialog */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Niezapisane zmiany</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz odrzucić zmiany? Wszystkie niezapisane
              zmiany zostaną utracone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleContinueEditing}>
              Kontynuuj edycję
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              Odrzuć zmiany
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

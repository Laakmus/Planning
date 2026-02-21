import { useState, useRef, useCallback, useEffect } from "react";
import OrderDocument from "./OrderDocument";
import type { OrderViewData, OrderViewProps } from "./types";

/**
 * OrderView - Container component for the A4 order document preview.
 *
 * Manages local state, dirty detection, save/cancel actions with
 * confirmation dialog, toolbar with action buttons, and keyboard shortcuts.
 */
export default function OrderView({
  initialData,
  isReadOnly = false,
  onSave,
  onCancel,
}: OrderViewProps) {
  // ---- State ----
  const [data, setData] = useState<OrderViewData>(initialData);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Keep a stable ref to the original data for dirty comparison.
  // Updated only after a successful save.
  const originalDataRef = useRef<OrderViewData>(initialData);

  // ---- Dirty detection ----
  const isDirty =
    JSON.stringify(data) !== JSON.stringify(originalDataRef.current);

  // ---- Handlers ----
  const handleChange = useCallback((updated: OrderViewData) => {
    setData(updated);
  }, []);

  const handleSave = useCallback(() => {
    if (!isDirty) return;

    onSave?.(data);
    // Reset dirty state by updating the original reference
    originalDataRef.current = data;
    // Force re-render so isDirty recalculates
    setData({ ...data });

    // Success feedback (console for test environment)
    console.log("[OrderView] Zapisano zmiany:", data.orderNo);
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

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+S / Cmd+S -> save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isReadOnly) {
          handleSave();
        }
      }

      // Escape -> cancel (with dirty check)
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, isReadOnly, handleSave, handleCancel]);

  // ---- Render ----
  return (
    <>
      {/* Full-screen overlay container */}
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-200 dark:bg-gray-900">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          {/* Left side: title + dirty indicator */}
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

          {/* Right side: action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:ring-offset-1"
            >
              Anuluj
            </button>
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

        {/* Scrollable document area */}
        <div className="flex-1 overflow-auto flex justify-center py-8">
          <OrderDocument
            data={data}
            onChange={handleChange}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Unsaved changes confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleContinueEditing}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-title"
            aria-describedby="confirm-discard-desc"
            className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3
              id="confirm-discard-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Niezapisane zmiany
            </h3>
            <p
              id="confirm-discard-desc"
              className="mt-2 text-sm text-gray-600 dark:text-gray-400"
            >
              Czy na pewno chcesz odrzucić zmiany? Wszystkie niezapisane zmiany
              zostaną utracone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleContinueEditing}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:ring-offset-1"
              >
                Kontynuuj edycję
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              >
                Odrzuć zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

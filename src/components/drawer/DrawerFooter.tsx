import { FileDown, Mail, Loader2 } from "lucide-react";

interface DrawerFooterProps {
  isReadOnly: boolean;
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  onGeneratePdf: () => void;
  onSendEmail: () => void;
}

/**
 * Sticky footer of the order drawer.
 * Matches test/kompletne_dane.html: PDF + Email on left, Cancel + Save on right.
 */
export function DrawerFooter({
  isReadOnly,
  isSaving,
  isDirty,
  onSave,
  onCancel,
  onGeneratePdf,
  onSendEmail,
}: DrawerFooterProps) {
  return (
    <footer className="shrink-0 p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d151c] flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* Generate PDF */}
        <button
          onClick={onGeneratePdf}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          Generuj PDF
        </button>

        {/* Send email */}
        {!isReadOnly && (
          <button
            onClick={onSendEmail}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            Wyślij maila
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Cancel */}
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50"
        >
          {isReadOnly ? "Zamknij" : "Anuluj"}
        </button>

        {/* Save — only visible in edit mode */}
        {!isReadOnly && (
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="px-8 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Zapisywanie...
              </span>
            ) : (
              "Zapisz"
            )}
          </button>
        )}
      </div>
    </footer>
  );
}

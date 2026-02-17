/**
 * Stopka draweru zlecenia.
 * Tryb edycji: lewa = Generuj PDF + Wyślij maila + Historia | prawa = Zamknij + Zapisz.
 * Tryb readonly: lewa = Generuj PDF + Historia | prawa = Zamknij.
 * Lock banner: gdy zlecenie zablokowane przez innego użytkownika.
 */

import { FileText, History, Loader2, Lock, Mail } from "lucide-react";

interface DrawerFooterProps {
  isReadOnly: boolean;
  isSaving: boolean;
  isDirty: boolean;
  lockedByUserName: string | null;
  onSave: () => void;
  onClose: () => void;
  onGeneratePdf?: () => void;
  onSendEmail?: () => void;
  onShowHistory?: () => void;
}

export function DrawerFooter({
  isReadOnly,
  isSaving,
  isDirty,
  lockedByUserName,
  onSave,
  onClose,
  onGeneratePdf,
  onSendEmail,
  onShowHistory,
}: DrawerFooterProps) {
  if (lockedByUserName) {
    return (
      <>
        <div className="shrink-0 flex items-center gap-2 px-6 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-900">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Edytowane przez <strong>{lockedByUserName}</strong>
          </span>
        </div>
        <footer className="shrink-0 flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-2">
            {onGeneratePdf && (
              <button
                type="button"
                onClick={onGeneratePdf}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Generuj PDF
              </button>
            )}
            {onShowHistory && (
              <button
                type="button"
                onClick={onShowHistory}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Historia zmian
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Zamknij
          </button>
        </footer>
      </>
    );
  }

  if (isReadOnly) {
    return (
      <footer className="shrink-0 flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex items-center gap-2">
          {onGeneratePdf && (
            <button
              type="button"
              onClick={onGeneratePdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Generuj PDF
            </button>
          )}
          {onShowHistory && (
            <button
              type="button"
              onClick={onShowHistory}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              Historia zmian
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Zamknij
        </button>
      </footer>
    );
  }

  return (
    <footer className="shrink-0 flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      {/* Lewa strona */}
      <div className="flex items-center gap-2">
        {onGeneratePdf && (
          <button
            type="button"
            onClick={onGeneratePdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Generuj PDF
          </button>
        )}
        {onSendEmail && (
          <button
            type="button"
            onClick={onSendEmail}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Wyślij maila
          </button>
        )}
        {onShowHistory && (
          <button
            type="button"
            onClick={onShowHistory}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Historia zmian
          </button>
        )}
      </div>

      {/* Prawa strona */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50"
        >
          Zamknij
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="px-8 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Zapisywanie…
            </span>
          ) : (
            "Zapisz"
          )}
        </button>
      </div>
    </footer>
  );
}

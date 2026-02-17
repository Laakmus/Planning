/**
 * Stopka draweru zlecenia.
 * Tryb edycji: lewa = Generuj PDF + Historia | prawa = Anuluj + Zapisz.
 * Tryb readonly: lewa = Generuj PDF + Historia | prawa = Zamknij.
 * Lock banner: gdy zlecenie zablokowane przez innego użytkownika.
 */

import { FileText, History, Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

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
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1">
            {onGeneratePdf && (
              <Button variant="ghost" size="sm" onClick={onGeneratePdf} className="text-slate-500 h-7 px-2 text-xs">
                <FileText className="w-3.5 h-3.5 mr-1" />
                Generuj PDF
              </Button>
            )}
            {onShowHistory && (
              <Button variant="ghost" size="sm" onClick={onShowHistory} className="text-slate-500 h-7 px-2 text-xs">
                <History className="w-3.5 h-3.5 mr-1" />
                Historia
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Zamknij
          </Button>
        </div>
      </>
    );
  }

  if (isReadOnly) {
    return (
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1">
          {onGeneratePdf && (
            <Button variant="ghost" size="sm" onClick={onGeneratePdf} className="text-slate-500 h-7 px-2 text-xs">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Generuj PDF
            </Button>
          )}
          {onShowHistory && (
            <Button variant="ghost" size="sm" onClick={onShowHistory} className="text-slate-500 h-7 px-2 text-xs">
              <History className="w-3.5 h-3.5 mr-1" />
              Historia
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Zamknij
        </Button>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* Lewa strona */}
      <div className="flex items-center gap-1">
        {onGeneratePdf && (
          <Button variant="ghost" size="sm" onClick={onGeneratePdf} className="text-slate-500 h-7 px-2 text-xs">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Generuj PDF
          </Button>
        )}
        {onSendEmail && (
          <Button variant="ghost" size="sm" onClick={onSendEmail} className="text-slate-500 h-7 px-2 text-xs">
            <Mail className="w-3.5 h-3.5 mr-1" />
            Wyślij maila
          </Button>
        )}
        {onShowHistory && (
          <Button variant="ghost" size="sm" onClick={onShowHistory} className="text-slate-500 h-7 px-2 text-xs">
            <History className="w-3.5 h-3.5 mr-1" />
            Historia
          </Button>
        )}
      </div>

      {/* Prawa strona */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
          Anuluj
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="min-w-[90px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Zapisywanie…
            </>
          ) : (
            "Zapisz"
          )}
        </Button>
      </div>
    </div>
  );
}

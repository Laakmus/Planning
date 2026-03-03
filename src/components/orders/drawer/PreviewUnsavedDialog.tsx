/**
 * Dialog niezapisanych zmian przed otwarciem podglądu OrderView.
 * 3 opcje: Zapisz i przejdź / Odrzuć zmiany / Anuluj.
 */

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

interface PreviewUnsavedDialogProps {
  open: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function PreviewUnsavedDialog({
  open,
  isSaving,
  onSave,
  onDiscard,
  onCancel,
}: PreviewUnsavedDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Niezapisane zmiany</AlertDialogTitle>
          <AlertDialogDescription>
            Masz niezapisane zmiany w formularzu. Co chcesz zrobić przed otwarciem podglądu?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isSaving}>
            Anuluj
          </AlertDialogCancel>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Odrzuć zmiany
          </button>
          <AlertDialogAction
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "Zapisywanie…" : "Zapisz i przejdź"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

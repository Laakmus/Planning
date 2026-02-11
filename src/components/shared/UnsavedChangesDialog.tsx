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

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onConfirmDiscard: () => void;
  onCancel: () => void;
}

/**
 * Modal shown when user tries to close the drawer with unsaved changes.
 */
export function UnsavedChangesDialog({
  isOpen,
  onConfirmDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Niezapisane zmiany</AlertDialogTitle>
          <AlertDialogDescription>
            Masz niezapisane zmiany w formularzu. Czy na pewno chcesz je odrzucić?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Wróć do edycji</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Odrzuć zmiany
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

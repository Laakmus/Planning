/**
 * AlertDialog potwierdzający deaktywację użytkownika.
 *
 * Deaktywacja jest soft-delete: konto pozostaje w DB, ale nie można się nim
 * zalogować. Aktywna sesja usera zostaje natychmiast przerwana po stronie
 * backendu (żeton odrzucony przy najbliższym żądaniu).
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
import type { AdminUserDto } from "@/types";

interface DeactivateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserDto | null;
  onConfirm: (id: string) => Promise<void>;
}

export function DeactivateUserDialog({
  isOpen,
  onOpenChange,
  user,
  onConfirm,
}: DeactivateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(user.id);
      onOpenChange(false);
    } catch {
      // Toast w hooku
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="admin-deactivate-user-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Deaktywować użytkownika?</AlertDialogTitle>
          <AlertDialogDescription>
            {user ? (
              <>
                Użytkownik <span className="font-semibold">{user.username}</span> nie będzie mógł
                się zalogować. Jeżeli jest obecnie zalogowany, zostanie natychmiast wylogowany.
                Operację można cofnąć edytując konto i zmieniając status na aktywne.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Zapobiegamy domyślnemu zamknięciu — zarządzamy stanem ręcznie
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            data-testid="deactivate-user-confirm"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Deaktywuj
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

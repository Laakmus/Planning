/**
 * Dialog resetowania hasła użytkownika przez admina.
 *
 * Wymaga podania nowego hasła + potwierdzenia (oba muszą się zgadzać).
 * Endpoint: POST /api/v1/admin/users/:id/reset-password.
 */

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSchema } from "@/lib/validators/auth.validator";
import type { AdminUserDto, ResetPasswordRequest } from "@/types";

interface ResetPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserDto | null;
  onSubmit: (id: string, body: ResetPasswordRequest) => Promise<void>;
}

export function ResetPasswordDialog({
  isOpen,
  onOpenChange,
  user,
  onSubmit,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !user) return;

    // Walidacja hasła
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Hasło nieprawidłowe");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Hasła nie są identyczne");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(user.id, { newPassword });
      onOpenChange(false);
    } catch {
      // Toast w hooku
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="admin-reset-password-dialog">
        <DialogHeader>
          <DialogTitle>Reset hasła</DialogTitle>
          <DialogDescription>
            {user ? (
              <>
                Ustaw nowe hasło dla użytkownika{" "}
                <span className="font-semibold">{user.username}</span>.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password-new">Nowe hasło</Label>
            <div className="relative">
              <Input
                id="reset-password-new"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-9"
                data-testid="reset-password-new"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">Potwierdź nowe hasło</Label>
            <Input
              id="reset-password-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              data-testid="reset-password-confirm"
            />
          </div>

          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="reset-password-submit">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Resetuj hasło
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

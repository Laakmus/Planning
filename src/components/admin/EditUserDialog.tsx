/**
 * Dialog edycji danych użytkownika (PATCH /api/v1/admin/users/:id).
 *
 * Username jest readonly (nie można go zmienić po utworzeniu konta).
 * Hasło zmieniane jest osobnym endpointem — poprzez ResetPasswordDialog.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserSchema } from "@/lib/validators/auth.validator";
import type { AdminUserDto, UpdateUserRequest, UserRole } from "@/types";

interface EditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserDto | null;
  onSubmit: (id: string, body: UpdateUserRequest) => Promise<AdminUserDto>;
}

interface FormState {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

export function EditUserDialog({ isOpen, onOpenChange, user, onSubmit }: EditUserDialogProps) {
  const [form, setForm] = useState<FormState>({
    email: "",
    fullName: "",
    phone: "",
    role: "PLANNER",
    isActive: true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronizuj stan formularza z propem `user` (przy otwarciu / zmianie użytkownika)
  useEffect(() => {
    if (user) {
      setForm({
        email: user.email,
        fullName: user.fullName ?? "",
        phone: user.phone ?? "",
        role: user.role,
        isActive: user.isActive,
      });
      setErrors({});
    }
  }, [user]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !user) return;

    // Walidacja (wszystkie pola opcjonalne w PATCH — wysyłamy pełen komplet)
    const parsed = updateUserSchema.safeParse({
      email: form.email,
      fullName: form.fullName,
      phone: form.phone.trim() === "" ? undefined : form.phone,
      role: form.role,
      isActive: form.isActive,
    });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState | undefined;
        if (key) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(user.id, parsed.data as UpdateUserRequest);
      onOpenChange(false);
    } catch {
      // Toast w hooku
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="admin-edit-user-dialog">
        <DialogHeader>
          <DialogTitle>Edytuj użytkownika</DialogTitle>
          <DialogDescription>Zmień dane konta. Login pozostaje niezmienny.</DialogDescription>
        </DialogHeader>

        {user ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Login</Label>
              <Input value={user.username} readOnly disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                data-testid="edit-user-email"
              />
              {errors.email ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.email}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-user-fullname">Imię i nazwisko</Label>
              <Input
                id="edit-user-fullname"
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                data-testid="edit-user-fullname"
              />
              {errors.fullName ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.fullName}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-user-phone">Telefon</Label>
              <Input
                id="edit-user-phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                data-testid="edit-user-phone"
              />
              {errors.phone ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.phone}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Rola</Label>
              <Select value={form.role} onValueChange={(v) => updateField("role", v as UserRole)}>
                <SelectTrigger data-testid="edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="PLANNER">PLANNER</SelectItem>
                  <SelectItem value="READ_ONLY">READ_ONLY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {/* Natywny checkbox — brak shadcn Checkbox w repo */}
              <input
                id="edit-user-active"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-primary"
                checked={form.isActive}
                onChange={(e) => updateField("isActive", e.target.checked)}
                data-testid="edit-user-active"
              />
              <Label htmlFor="edit-user-active" className="font-normal cursor-pointer">
                Konto aktywne
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="edit-user-submit">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Zapisz
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

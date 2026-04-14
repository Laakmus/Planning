/**
 * Dialog tworzenia nowego użytkownika przez admina.
 *
 * Po pomyślnym utworzeniu wywołuje `onCreated({ user, inviteLink })`,
 * co pozwala komponentowi nadrzędnemu pokazać `InviteLinkDialog` z linkiem
 * aktywacyjnym do skopiowania.
 */

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserSchema } from "@/lib/validators/auth.validator";
import type { AdminUserDto, CreateUserRequest, InviteLinkDto, UserRole } from "@/types";

/** Wynik tworzenia usera przekazywany do parent komponentu. */
export interface CreateUserSuccessPayload {
  user: AdminUserDto;
  inviteLink: InviteLinkDto;
}

interface CreateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: CreateUserRequest) => Promise<CreateUserSuccessPayload>;
  onCreated: (payload: CreateUserSuccessPayload) => void;
}

/** Początkowe wartości formularza. */
const INITIAL_FORM = {
  username: "",
  password: "",
  email: "",
  fullName: "",
  phone: "",
  role: "PLANNER" as UserRole,
};

type FormState = typeof INITIAL_FORM;
type FieldErrors = Partial<Record<keyof FormState, string>>;

export function CreateUserDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  onCreated,
}: CreateUserDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset stanu przy zamknięciu
  function handleOpenChange(open: boolean) {
    if (!open) {
      setForm(INITIAL_FORM);
      setErrors({});
      setShowPassword(false);
    }
    onOpenChange(open);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Wyczyść błąd pola po zmianie wartości
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    // Walidacja Zod
    const parsed = createUserSchema.safeParse({
      username: form.username,
      password: form.password,
      email: form.email,
      fullName: form.fullName,
      phone: form.phone.trim() === "" ? undefined : form.phone,
      role: form.role,
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
      const result = await onSubmit(parsed.data as CreateUserRequest);
      onCreated(result);
      handleOpenChange(false);
    } catch {
      // Toast obsługiwany w hooku; błędy polowe (np. duplikat username) nie są tu mapowane
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="admin-create-user-dialog">
        <DialogHeader>
          <DialogTitle>Nowy użytkownik</DialogTitle>
          <DialogDescription>
            Uzupełnij dane. Po utworzeniu otrzymasz link aktywacyjny do przekazania użytkownikowi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-user-username">Login</Label>
            <Input
              id="create-user-username"
              autoComplete="off"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
              placeholder="np. jan.kowalski"
              data-testid="create-user-username"
            />
            {errors.username ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.username}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-password">Hasło tymczasowe</Label>
            <div className="relative">
              <Input
                id="create-user-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                className="pr-9"
                data-testid="create-user-password"
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
            {errors.password ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.password}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-email">Email</Label>
            <Input
              id="create-user-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              data-testid="create-user-email"
            />
            {errors.email ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-fullname">Imię i nazwisko</Label>
            <Input
              id="create-user-fullname"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              data-testid="create-user-fullname"
            />
            {errors.fullName ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.fullName}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-phone">Telefon (opcjonalnie)</Label>
            <Input
              id="create-user-phone"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              data-testid="create-user-phone"
            />
            {errors.phone ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.phone}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Rola</Label>
            <Select value={form.role} onValueChange={(v) => updateField("role", v as UserRole)}>
              <SelectTrigger data-testid="create-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="PLANNER">PLANNER</SelectItem>
                <SelectItem value="READ_ONLY">READ_ONLY</SelectItem>
              </SelectContent>
            </Select>
            {errors.role ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.role}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="create-user-submit">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Utwórz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

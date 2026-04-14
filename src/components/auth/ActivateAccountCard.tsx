/**
 * ActivateAccountCard — ekran aktywacji konta przez invite token.
 *
 * Renderowany na stronie /activate?token=... jako React island (client:load).
 * Wywołuje POST /api/v1/auth/activate z tokenem z URL.
 *
 * Stany:
 *  - idle      — gotowy do aktywacji (przycisk "Aktywuj konto")
 *  - activating — w trakcie wywołania endpointu
 *  - success   — konto aktywowane; pokazujemy link do logowania
 *  - error     — błąd z backendu (token wygasł / już użyty / konto aktywne)
 *
 * Nie używa AuthContext — nie ma potrzeby sesji w tym widoku.
 */

import { useCallback, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { activateAccountSchema } from "@/lib/validators/auth.validator";
import type { ActivateAccountResponse } from "@/types";

type ActivationState = "idle" | "activating" | "success" | "error";

interface ActivateAccountFormProps {
  token: string;
}

function ActivateAccountForm({ token }: ActivateAccountFormProps) {
  const [state, setState] = useState<ActivationState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Walidacja tokenu client-side (długość 32–128 znaków)
  const tokenValidation = activateAccountSchema.safeParse({ token });
  const isTokenValid = tokenValidation.success;

  const handleActivate = useCallback(async () => {
    // Jeszcze raz sprawdzamy — może zmienić się props (teoretycznie)
    const parsed = activateAccountSchema.safeParse({ token });
    if (!parsed.success) {
      setState("error");
      setMessage("Nieprawidłowy lub brakujący token aktywacyjny.");
      return;
    }

    setState("activating");
    setMessage(null);

    try {
      const response = await fetch("/api/v1/auth/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ token: parsed.data.token }),
      });

      if (!response.ok) {
        let errorMessage = "Nie udało się aktywować konta. Spróbuj ponownie.";
        try {
          const body = (await response.json()) as { message?: string };
          if (body?.message) errorMessage = body.message;
        } catch {
          // Ignorujemy — użyjemy domyślnego komunikatu
        }
        setState("error");
        setMessage(errorMessage);
        return;
      }

      // Sukces — backend zwraca { ok: true }
      const payload = (await response.json()) as ActivateAccountResponse;
      if (payload?.ok) {
        setState("success");
        setMessage(
          "Konto zostało aktywowane. Możesz się teraz zalogować.",
        );
      } else {
        setState("error");
        setMessage("Nieoczekiwana odpowiedź serwera.");
      }
    } catch {
      // Ignorujemy — użyjemy generycznego komunikatu sieciowego
      setState("error");
      setMessage("Brak połączenia z serwerem. Sprawdź połączenie sieciowe.");
    }
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div
        className="w-full max-w-sm space-y-6"
        data-testid="activate-card"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Aktywacja konta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ustaw konto w systemie zleceń transportowych
          </p>
        </div>

        {/* Brak tokenu lub token nieprawidłowy */}
        {!isTokenValid && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive dark:bg-destructive/20"
            data-testid="activate-status"
          >
            Brak tokenu aktywacyjnego lub token jest nieprawidłowy. Użyj
            pełnego linku z zaproszenia.
          </div>
        )}

        {/* Stany idle / activating — przycisk aktywacji */}
        {isTokenValid && (state === "idle" || state === "activating") && (
          <Button
            type="button"
            className="w-full"
            onClick={handleActivate}
            disabled={state === "activating"}
            data-testid="activate-submit"
          >
            {state === "activating" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aktywuję...
              </>
            ) : (
              "Aktywuj konto"
            )}
          </Button>
        )}

        {/* Sukces */}
        {state === "success" && (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-md border border-emerald-500/50 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100"
              data-testid="activate-status"
            >
              {message}
            </div>
            <Button asChild className="w-full">
              <a href="/" data-testid="activate-login-link">
                Przejdź do logowania
              </a>
            </Button>
          </div>
        )}

        {/* Błąd */}
        {state === "error" && (
          <div className="space-y-4">
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive dark:bg-destructive/20"
              data-testid="activate-status"
            >
              {message}
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href="/">Wróć do logowania</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eksport z ThemeProvider (samodzielna wyspa React)
// ---------------------------------------------------------------------------

interface ActivateAccountCardProps {
  /** Token aktywacyjny z URL (?token=...). Pusty string, gdy brakuje. */
  token: string;
}

export default function ActivateAccountCard({
  token,
}: ActivateAccountCardProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ActivateAccountForm token={token} />
    </ThemeProvider>
  );
}

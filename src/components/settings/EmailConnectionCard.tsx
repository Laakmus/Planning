/**
 * Karta zarządzania połączeniem konta z Microsoft 365 (Outlook).
 *
 * AUTH-MIG B4 (2026-05-17):
 *   - Pobiera status połączenia z `/api/v1/ms-oauth/status`.
 *   - Połączenie inicjuje przez redirect na `/api/v1/ms-oauth/start` (backend
 *     buduje URL autoryzacyjny Microsoft + PKCE state).
 *   - Po powrocie z `/api/v1/ms-oauth/callback` backend redirectuje do
 *     `/settings/email?ms_connected=1` (sukces) lub `?ms_error=...` (błąd) —
 *     komponent czyta query param i pokazuje toast.
 *   - Rozłączenie: AlertDialog → `POST /api/v1/ms-oauth/disconnect` (204).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, Loader2, Mail, MailX } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEmailOpenMode,
  resolveEmailOpenMode,
  setEmailOpenMode,
} from "@/lib/email-open-mode";
import { invalidateMsOAuthStatusCache } from "@/lib/send-email";
import type { EmailOpenMode, MsOAuthStatusDto } from "@/types";

// ---------------------------------------------------------------------------
// Mapowanie kodów błędów z query param na komunikaty po polsku
// ---------------------------------------------------------------------------

/** Tłumaczenie znanych kodów błędów z `?ms_error=...` na komunikat dla usera. */
function describeMsError(code: string): string {
  switch (code) {
    case "access_denied":
      return "Połączenie z Microsoft 365 zostało anulowane (brak zgody użytkownika).";
    case "invalid_state":
      return "Nieprawidłowy stan autoryzacji — spróbuj ponownie.";
    case "invalid_grant":
      return "Microsoft odrzucił autoryzację — sprawdź konto lub spróbuj ponownie.";
    case "token_exchange_failed":
      return "Nie udało się wymienić kodu na token — spróbuj ponownie.";
    case "server_error":
      return "Błąd serwera Microsoft. Spróbuj ponownie za chwilę.";
    default:
      return `Nie udało się połączyć z Microsoft 365 (${code}).`;
  }
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

/** Opcje radio dla sekcji "Sposób otwierania draftu". */
const OPEN_MODE_OPTIONS: {
  value: EmailOpenMode;
  label: string;
  description: string;
  warning?: string;
}[] = [
  {
    value: "web",
    label: "Outlook Web (przeglądarka) — zalecane",
    description:
      "Otwiera draft bezpośrednio w Outlook Web w nowej karcie. Działa od razu, bez konfiguracji przeglądarki.",
  },
  {
    value: "desktop",
    label: "Outlook Desktop (.eml)",
    description:
      "Pobiera plik .eml na dysk — kliknij dwukrotnie, aby otworzyć w Outlook Desktop.",
    warning:
      'Wymaga jednorazowej konfiguracji przeglądarki. W Chrome po pierwszym pobraniu pliku kliknij strzałkę obok pliku na pasku pobierań i wybierz "Zawsze otwieraj pliki tego typu". Następne pobrania będą otwierać się automatycznie w Outlook.',
  },
  {
    value: "ask",
    label: "Pytaj za każdym razem",
    description:
      "Przy każdym wysłaniu maila pyta jak otworzyć draft (Web vs Desktop).",
  },
];

export function EmailConnectionCard() {
  const { api } = useAuth();

  const [status, setStatus] = useState<MsOAuthStatusDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  // Preferencja sposobu otwierania draftu — z localStorage lub heurystyka.
  // Inicjalizujemy z null (brak msEmail) → po fetchu statusu zaktualizujemy.
  const [openMode, setOpenModeState] = useState<EmailOpenMode>(() =>
    resolveEmailOpenMode(null),
  );
  /** Flaga: czy preferencja była zapisana w localStorage (vs domyślna z heurystyki) */
  const [hasStoredPref, setHasStoredPref] = useState<boolean>(() => getEmailOpenMode() !== null);

  // -------------------------------------------------------------------------
  // Fetch statusu
  // -------------------------------------------------------------------------

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<MsOAuthStatusDto>("/api/v1/ms-oauth/status");
      setStatus(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się pobrać statusu połączenia.");
      // Bezpieczny default — niepołączony
      setStatus({ connected: false, msEmail: null, expiresAt: null, connectedAt: null });
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  // -------------------------------------------------------------------------
  // Inicjalne ładowanie statusu + obsługa query params z callback
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Najpierw przeczytaj query params (callback z OAuth) i pokaż toast
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("ms_connected");
      const errorCode = params.get("ms_error");

      if (connected === "1") {
        toast.success("Pomyślnie połączono z Outlook.");
        // Cache w sessionStorage mógł być nieaktualny (status zmieniony)
        invalidateMsOAuthStatusCache();
      } else if (errorCode) {
        toast.error(describeMsError(errorCode));
        invalidateMsOAuthStatusCache();
      }

      // Wyczyść query params (zostaw clean URL bez przeładowania)
      if (connected || errorCode) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }

    // Pobierz status (świeży, omijający cache)
    loadStatus();
  }, [loadStatus]);

  // -------------------------------------------------------------------------
  // Po pobraniu statusu — jeśli user NIE zapisał preferencji, zaktualizuj
  // openMode wg heurystyki bazującej na typie konta MS (msEmail).
  // Gdy preferencja JEST w localStorage — szanujemy ją bez zmian.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (hasStoredPref) return;
    if (!status) return;
    const heuristicMode = resolveEmailOpenMode(status.msEmail);
    setOpenModeState(heuristicMode);
  }, [status, hasStoredPref]);

  // -------------------------------------------------------------------------
  // Handler zmiany trybu — zapis do localStorage + lokalny state
  // -------------------------------------------------------------------------
  const handleOpenModeChange = useCallback((mode: EmailOpenMode) => {
    setOpenModeState(mode);
    setEmailOpenMode(mode);
    setHasStoredPref(true);
  }, []);

  // -------------------------------------------------------------------------
  // Akcje
  // -------------------------------------------------------------------------

  /** Połącz z Microsoft — pobierz authorize URL z backendu, potem nawiguj. */
  const handleConnect = useCallback(async () => {
    // Fetch z Bearer header (autoryzacja w API) → JSON { authorizeUrl } → navigation.
    // NIE używamy window.location.href = "/api/v1/ms-oauth/start" bo navigation
    // nie przesyłałaby tokena z localStorage → 401.
    try {
      const data = await api.get<{ authorizeUrl: string }>("/api/v1/ms-oauth/start");
      if (data?.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      } else {
        toast.error("Błąd inicjowania połączenia z Microsoft.");
      }
    } catch (err) {
      console.error("[EmailConnectionCard] handleConnect", err);
      toast.error("Nie udało się rozpocząć połączenia z Microsoft.");
    }
  }, [api]);

  /** Rozłącz — wywoływane po potwierdzeniu w AlertDialog. */
  const handleDisconnectConfirm = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await api.post("/api/v1/ms-oauth/disconnect", {});
      toast.success("Odłączono Microsoft 365.");
      invalidateMsOAuthStatusCache();
      setStatus({ connected: false, msEmail: null, expiresAt: null, connectedAt: null });
      setShowDisconnectDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się odłączyć konta.");
    } finally {
      setIsDisconnecting(false);
    }
  }, [api]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isConnected = status?.connected === true;
  const msEmail = status?.msEmail ?? null;

  // Aktualnie wybrana etykieta (do info "Domyślnie ustawiono X")
  const currentModeLabel = useMemo(
    () => OPEN_MODE_OPTIONS.find((o) => o.value === openMode)?.label ?? "",
    [openMode],
  );

  return (
    <>
      <div
        data-testid="email-connection-card"
        className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Nagłówek karty */}
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Połączenie z Microsoft 365
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Po połączeniu konta wysyłka maila ze zlecenia będzie tworzyć draft
            bezpośrednio w Twojej skrzynce Outlook. Bez połączenia aplikacja
            wygeneruje plik .eml do pobrania.
          </p>
        </div>

        {/* Status + akcje */}
        <div className="px-6 py-5">
          {isLoading ? (
            <div
              data-testid="email-connection-loading"
              className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sprawdzanie statusu połączenia...</span>
            </div>
          ) : isConnected ? (
            <div
              data-testid="email-connection-connected"
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Połączono jako{" "}
                    <span
                      data-testid="email-connection-email"
                      className="font-semibold"
                    >
                      {msEmail ?? "(nieznany adres)"}
                    </span>
                  </p>
                  {status?.connectedAt && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Połączono: {new Date(status.connectedAt).toLocaleString("pl-PL")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                data-testid="email-connection-disconnect"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/40 dark:hover:bg-destructive/20"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={isDisconnecting}
              >
                <MailX className="h-4 w-4" />
                Rozłącz
              </Button>
            </div>
          ) : (
            <div
              data-testid="email-connection-disconnected"
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Mail className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Niepołączono
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Połącz konto Microsoft 365, aby wysyłać maile bezpośrednio
                    z Outlook.
                  </p>
                </div>
              </div>
              <Button
                data-testid="email-connection-connect"
                onClick={handleConnect}
              >
                <Mail className="h-4 w-4" />
                Połącz z Microsoft
              </Button>
            </div>
          )}
        </div>

        {/* Sekcja: Sposób otwierania draftu (preferencja w localStorage)
            Wyświetlana zawsze — niezależnie od stanu połączenia, bo tryb "desktop"
            (pobieranie .eml) działa nawet bez konta Microsoft. */}
        <div
          data-testid="email-open-mode-section"
          className="border-t border-slate-200 px-6 py-5 dark:border-slate-800"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Sposób otwierania draftu
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Wybierz, gdzie chcesz edytować wygenerowany draft maila. Preferencja
            jest zapamiętywana w tej przeglądarce.
          </p>

          <fieldset className="mt-4 space-y-2" data-testid="email-open-mode-radios">
            <legend className="sr-only">Sposób otwierania draftu emaila</legend>
            {OPEN_MODE_OPTIONS.map((option) => {
              const isSelected = openMode === option.value;
              return (
                <label
                  key={option.value}
                  data-testid={`email-open-mode-option-${option.value}`}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors " +
                    (isSelected
                      ? "border-primary bg-primary/5 dark:border-primary dark:bg-primary/10"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50")
                  }
                >
                  <input
                    type="radio"
                    name="email-open-mode"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => handleOpenModeChange(option.value)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                    data-testid={`email-open-mode-input-${option.value}`}
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-slate-900 dark:text-slate-100">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {option.description}
                    </span>
                    {option.warning && isSelected && (
                      <div
                        data-testid={`email-open-mode-warning-${option.value}`}
                        className="mt-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span>{option.warning}</span>
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </fieldset>

          {/* Info — domyślne ustawienie wg typu konta */}
          {!hasStoredPref && (
            <div
              data-testid="email-open-mode-default-info"
              className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Domyślnie ustawiono <strong>{currentModeLabel}</strong> na
                podstawie typu Twojego konta Microsoft. Możesz zmienić w dowolnym
                momencie.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog potwierdzenia rozłączenia */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={(open) => {
          if (!open && !isDisconnecting) {
            setShowDisconnectDialog(false);
          }
        }}
      >
        <AlertDialogContent data-testid="email-connection-disconnect-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Rozłączyć konto Microsoft 365?</AlertDialogTitle>
            <AlertDialogDescription>
              Po rozłączeniu wysyłka maila będzie generować plik .eml zamiast
              tworzyć draft w Outlook. Możesz w każdej chwili połączyć konto
              ponownie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="email-connection-disconnect-confirm"
              variant="destructive"
              onClick={(e) => {
                // Zatrzymujemy domyślne zamknięcie aby pokazać spinner
                e.preventDefault();
                handleDisconnectConfirm();
              }}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rozłączanie...
                </>
              ) : (
                "Tak, rozłącz"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default EmailConnectionCard;

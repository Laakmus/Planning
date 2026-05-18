/**
 * Wspólna logika wysyłki email (Microsoft Graph draft lub .eml fallback).
 *
 * Używana przez useOrderActions (lista) i useOrderDrawer (drawer).
 * Wyekstrahowana, aby wyeliminować duplikację kodu.
 *
 * AUTH-MIG B4 (2026-05-17):
 *   Dawny flow MSAL (frontend → Graph API bezpośrednio) został zastąpiony
 *   backendowym flow OAuth2 Authorization Code + PKCE. Frontend:
 *     1. Pobiera status połączenia (GET /api/v1/ms-oauth/status, cache 60s).
 *     2. Jeśli `connected === true` → POST /prepare-email-graph (backend tworzy draft).
 *     3. W razie błędu (412 MS_NOT_CONNECTED, błąd Graph, brak połączenia) →
 *        fallback na klasyczne .eml (POST /prepare-email → blob).
 */
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";
import type { ApiClient } from "@/lib/api-client";
import { resolveEmailOpenMode } from "@/lib/email-open-mode";
import type {
  EmailOpenMode,
  MsOAuthStatusDto,
  PrepareEmailGraphResponseDto,
} from "@/types";

// ---------------------------------------------------------------------------
// Cache statusu połączenia (sessionStorage, TTL 60s)
// ---------------------------------------------------------------------------

const STATUS_CACHE_KEY = "ms-oauth-status-cache";
const STATUS_CACHE_TTL_MS = 60_000;

interface StatusCacheEntry {
  status: MsOAuthStatusDto;
  expiresAt: number; // epoch ms
}

/** Czyta status z sessionStorage cache, jeśli nie wygasł. */
function readStatusCache(): MsOAuthStatusDto | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StatusCacheEntry;
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(STATUS_CACHE_KEY);
      return null;
    }
    return entry.status;
  } catch {
    return null;
  }
}

/** Zapisuje status do sessionStorage cache z TTL 60s. */
function writeStatusCache(status: MsOAuthStatusDto): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: StatusCacheEntry = {
      status,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
    };
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignoruj — quota / storage disabled
  }
}

/** Resetuje cache statusu (po connect/disconnect, np. z EmailConnectionCard). */
export function invalidateMsOAuthStatusCache(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STATUS_CACHE_KEY);
  } catch {
    // ignoruj
  }
}

/** Pobiera status z cache lub z API. */
async function getMsOAuthStatus(api: ApiClient): Promise<MsOAuthStatusDto | null> {
  const cached = readStatusCache();
  if (cached) return cached;
  try {
    const status = await api.get<MsOAuthStatusDto>("/api/v1/ms-oauth/status");
    writeStatusCache(status);
    return status;
  } catch {
    // Jeśli endpoint nie działa lub user nie zalogowany — fallback na .eml
    return null;
  }
}

// ---------------------------------------------------------------------------
// Send email — entry point
// ---------------------------------------------------------------------------

interface SendEmailOptions {
  orderId: string;
  api: ApiClient;
  /** Nazwa pliku .eml (domyślnie: zlecenie-{orderId}.eml) */
  emlFileName?: string;
  /** Callback po sukcesie (np. refetch listy lub onOrderUpdated) */
  onSuccess: () => void;
  /** Callback przy 422 — brakujące pola walidacji */
  onValidationError: (missingFields: string[]) => void;
}

/**
 * Wysyła email z PDF — respektuje preferencję `EmailOpenMode` z localStorage:
 *
 *   • "web"     → Outlook Web (Graph draft + open webLink). Gdy MS niepołączony
 *                 lub Graph zwróci błąd → fallback na .eml.
 *   • "desktop" → pomija Graph, od razu .eml fallback (Outlook desktop).
 *   • "ask"     → pyta usera (window.confirm) — wybór per wywołanie.
 *
 * Brak zapisanej preferencji → heurystyka po typie konta MS
 * (`@outlook.com`/`@hotmail.com` → "web", reszta → "desktop").
 */
export async function sendEmailForOrder({
  orderId,
  api,
  emlFileName,
  onSuccess,
  onValidationError,
}: SendEmailOptions): Promise<void> {
  // Pobierz status połączenia (cache 60s) — potrzebny do heurystyki + decyzji o flow
  const status = await getMsOAuthStatus(api);
  const msEmail = status?.msEmail ?? null;

  // Określ tryb otwierania (preferencja usera lub heurystyka)
  let mode: EmailOpenMode = resolveEmailOpenMode(msEmail);

  // Tryb "ask" — pytaj per wysyłka, ostatecznie web/desktop
  if (mode === "ask") {
    mode = askUserForOpenMode();
  }

  // Tryb "desktop" — pomiń Graph, od razu .eml
  if (mode === "desktop") {
    await runEmlFallback({ orderId, api, emlFileName, onSuccess, onValidationError });
    return;
  }

  // Tryb "web" — spróbuj Graph (jeśli połączone), w razie błędu fallback na .eml
  const useGraphFlow = status?.connected === true;
  if (useGraphFlow) {
    const ok = await tryGraphFlow({ orderId, api, onSuccess, onValidationError });
    if (ok) return;
    // Jeśli Graph zawiódł → fallback na .eml (bez 422 — 422 obsługujemy w środku)
  }

  await runEmlFallback({ orderId, api, emlFileName, onSuccess, onValidationError });
}

// ---------------------------------------------------------------------------
// "Ask" mode — minimalny prompt usera (window.confirm)
// ---------------------------------------------------------------------------

/**
 * Pyta usera w trybie "ask" jak otworzyć draft.
 *
 * Decyzja świadoma: zamiast budować osobny komponent dialogu (wymagałby zmiany
 * sygnatury hooków, by przepiąć callback / portal), używamy synchronicznego
 * `window.confirm`. To wystarczające dla MVP — user wybiera szybko, bez UI overhead.
 *
 * Zwracane wartości:
 *   - "web"     → confirm = true (OK)
 *   - "desktop" → confirm = false (Anuluj)
 *
 * Bezpieczne na SSR (jeśli `window` brak — domyślnie "web").
 */
function askUserForOpenMode(): "web" | "desktop" {
  if (typeof window === "undefined") return "web";
  const message =
    "Jak chcesz otworzyć draft maila?\n\n" +
    "OK = Outlook Web (w przeglądarce)\n" +
    "Anuluj = Outlook Desktop (pobierz plik .eml)";
  // eslint-disable-next-line no-alert
  const wantsWeb = window.confirm(message);
  return wantsWeb ? "web" : "desktop";
}

// ---------------------------------------------------------------------------
// Graph flow (backend)
// ---------------------------------------------------------------------------

interface GraphFlowOptions {
  orderId: string;
  api: ApiClient;
  onSuccess: () => void;
  onValidationError: (missingFields: string[]) => void;
}

/**
 * Próbuje utworzyć draft przez Microsoft Graph (backend).
 * Zwraca `true` w razie sukcesu, `false` gdy należy uruchomić fallback na .eml.
 *
 * UX (decyzja z 2026-05-18): po sukcesie NIE otwieramy nowej karty Outlook Web.
 * Pokazujemy toast z opcjonalnym przyciskiem "Otwórz Outlook" — user sam decyduje
 * czy klika. Draft i tak siedzi w jego "Wersjach roboczych" w Outlook (cloud).
 */
async function tryGraphFlow({
  orderId,
  api,
  onSuccess,
  onValidationError,
}: GraphFlowOptions): Promise<boolean> {
  try {
    await api.post<PrepareEmailGraphResponseDto>(
      `/api/v1/orders/${orderId}/prepare-email-graph`,
      {},
    );

    toast.success("Draft dodany do Wersji roboczych Outlook", {
      action: {
        label: "Otwórz Outlook",
        onClick: () => {
          window.open("https://outlook.office.com/mail/drafts", "_blank", "noopener");
        },
      },
    });
    onSuccess();
    return true;
  } catch (err) {
    // 422 — brakujące pola walidacji (wspólne dla obu flow)
    if (
      err instanceof ApiError &&
      err.statusCode === 422 &&
      Array.isArray(err.details?.missing)
    ) {
      onValidationError(err.details.missing as string[]);
      return true; // Walidacja: nie uruchamiaj fallbacku, dialog pokazuje błąd
    }

    // 412 — Microsoft niepołączony lub token wygasł / odebrany
    // Inny błąd → fallback na .eml (graceful degradation)
    if (err instanceof ApiError && err.statusCode === 412) {
      // Cache mógł być nieaktualny — wyczyść, by następnym razem refetch statusu
      invalidateMsOAuthStatusCache();
      // Cichy fallback (bez toastu) — user nie musi wiedzieć o szczegółach
      return false;
    }

    // Inny błąd (sieć/Graph 500) — informujemy i fallback na .eml
    toast.message("Microsoft Graph niedostępny — generuję plik .eml.");
    return false;
  }
}

// ---------------------------------------------------------------------------
// .eml fallback
// ---------------------------------------------------------------------------

interface EmlFallbackOptions {
  orderId: string;
  api: ApiClient;
  emlFileName?: string;
  onSuccess: () => void;
  onValidationError: (missingFields: string[]) => void;
}

/** Pobiera .eml jako blob i próbuje otworzyć w default mail clientu (lub fallback download). */
async function runEmlFallback({
  orderId,
  api,
  emlFileName,
  onSuccess,
  onValidationError,
}: EmlFallbackOptions): Promise<void> {
  try {
    const response = await api.postRaw(`/api/v1/orders/${orderId}/prepare-email`, {});
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // UWAGA: NIE używamy `a.download` — ten atrybut wymusza POBRANIE pliku,
    // niezależnie od ustawienia "Always open files of this type" w Chrome.
    // Bez `download` + `target="_blank"` browser próbuje otworzyć plik w default
    // mail clientu (Outlook). Jeśli user nie skonfigurował handlera — Chrome pobierze.
    // Po pierwszym pobraniu user może w pasku pobierań kliknąć "Always open files
    // of this type" — od tego momentu pliki .eml otwierają się automatycznie w Outlook.
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    if (emlFileName) {
      // Suggestion dla browser jaki nadać nazwę przy ewentualnym pobraniu — bez
      // wymuszania downloadu (to robił atrybut `download`, NIE rel/target)
      a.setAttribute("data-suggested-filename", emlFileName);
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Cleanup blob URL po krótkim opóźnieniu (browser musi zdążyć go pobrać)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Plik .eml otwierany w domyślnym programie pocztowym.");
    onSuccess();
  } catch (err) {
    // 422 — brakujące pola walidacji
    if (
      err instanceof ApiError &&
      err.statusCode === 422 &&
      Array.isArray(err.details?.missing)
    ) {
      onValidationError(err.details.missing as string[]);
      return;
    }
    toast.error(err instanceof Error ? err.message : "Błąd wysyłki maila.");
  }
}

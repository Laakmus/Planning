/**
 * Preferencja użytkownika — sposób otwierania draftu emaila (`EmailOpenMode`).
 *
 * Wartości:
 *   - "web"     — Outlook Web (deep-link `webLink` z Graph draftu)
 *   - "desktop" — pobranie pliku `.eml` (Outlook lokalny)
 *   - "ask"     — dialog wyboru przy każdej wysyłce
 *
 * Persistencja: `localStorage` pod kluczem `planning:email-open-mode`.
 *
 * Gdy brak zapisanej preferencji — heurystyka oparta na typie konta MS:
 *   - osobiste konta MS (@outlook.com, @hotmail.com, @live.com, @msn.com)
 *     → domyślnie "web" (rzadko mają Outlook desktop),
 *   - konta firmowe (Microsoft 365) → "desktop" (zazwyczaj mają Outlook desktop),
 *   - brak msEmail → "web".
 */

import type { EmailOpenMode } from "@/types";

const STORAGE_KEY = "planning:email-open-mode";

/** Zbiór znanych domen osobistych Microsoft (lowercase, bez "@"). */
const PERSONAL_MS_DOMAINS = [
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
] as const;

/** Walidacja czy wartość jest poprawnym EmailOpenMode. */
function isValidMode(value: unknown): value is EmailOpenMode {
  return value === "web" || value === "desktop" || value === "ask";
}

/**
 * Czyta zapisaną preferencję z `localStorage`.
 * Zwraca `null` gdy brak / nieprawidłowa wartość / brak dostępu do storage (SSR).
 */
export function getEmailOpenMode(): EmailOpenMode | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return isValidMode(raw) ? raw : null;
  } catch {
    // Quota / disabled storage — traktuj jak brak preferencji
    return null;
  }
}

/**
 * Zapisuje preferencję do `localStorage`. Bezpieczne na SSR (no-op gdy brak storage).
 */
export function setEmailOpenMode(mode: EmailOpenMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignoruj — quota / storage disabled
  }
}

/**
 * Heurystyka domyślnego trybu — na podstawie typu konta Microsoft podpiętego
 * przez OAuth. Wynik używany tylko gdy w localStorage brak preferencji.
 *
 * - osobiste konto MS (`@outlook.com` itp.) → "web"
 * - konto firmowe (Microsoft 365 / inna domena) → "desktop"
 * - brak msEmail (niepołączony lub nieznany) → "web"
 */
export function getDefaultEmailOpenMode(msEmail: string | null): EmailOpenMode {
  if (!msEmail) return "web";
  const lower = msEmail.toLowerCase();
  for (const domain of PERSONAL_MS_DOMAINS) {
    if (lower.endsWith(`@${domain}`)) {
      return "web";
    }
  }
  return "desktop";
}

/**
 * Zwraca tryb otwierania draftu — preferencja użytkownika z `localStorage`,
 * a w razie braku — heurystyka oparta o typ konta MS.
 */
export function resolveEmailOpenMode(msEmail: string | null): EmailOpenMode {
  return getEmailOpenMode() ?? getDefaultEmailOpenMode(msEmail);
}

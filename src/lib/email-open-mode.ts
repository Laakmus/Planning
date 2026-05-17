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
 * Default: ZAWSZE "web" (Outlook Web). Powód: działa od razu dla każdego nowego
 * usera bez żadnej konfiguracji per przeglądarka. Wybór "desktop" wymaga
 * jednorazowego ustawienia w Chrome ("Always open files of this type" dla .eml)
 * — to świadomy wybór usera w /settings/email.
 */

import type { EmailOpenMode } from "@/types";

const STORAGE_KEY = "planning:email-open-mode";

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
 * Domyślny tryb otwierania draftu — ZAWSZE "web" (Outlook Web).
 *
 * Powód: Outlook Web działa od razu dla każdego nowego usera, bez konfiguracji
 * przeglądarki. Outlook Desktop (.eml) wymaga w Chrome jednorazowo ustawienia
 * "Always open files of this type" — to świadomy wybór usera w /settings/email,
 * nie default narzucany aplikacji.
 *
 * Parametr `msEmail` zachowany dla kompatybilności API (przyszłe heurystyki
 * mogłyby go używać), ale obecnie ignorowany.
 */
export function getDefaultEmailOpenMode(_msEmail: string | null): EmailOpenMode {
  return "web";
}

/**
 * Zwraca tryb otwierania draftu — preferencja użytkownika z `localStorage`,
 * a w razie braku — heurystyka oparta o typ konta MS.
 */
export function resolveEmailOpenMode(msEmail: string | null): EmailOpenMode {
  return getEmailOpenMode() ?? getDefaultEmailOpenMode(msEmail);
}

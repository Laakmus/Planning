/**
 * Typy DTO dla autoryzacji: logowanie przez username, aktywacja konta,
 * status połączenia Microsoft.
 *
 * Uwaga: `AuthMeDto` i `UserRole` pozostają w `./common.ts` (są używane szerzej).
 */

import type { UserRole } from "./common";

/**
 * Żądanie logowania przez username + hasło.
 * Zastępuje dotychczasowe logowanie przez email.
 */
export interface UsernameLoginRequest {
  username: string;
  password: string;
}

/**
 * Odpowiedź po pomyślnym logowaniu — tokeny oraz skrócony profil użytkownika.
 * Tokeny pochodzą z Supabase Auth (GoTrue), `user` zawiera dane z `user_profiles`.
 */
export interface UsernameLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string | null;
    role: UserRole;
    isActive: boolean;
  };
}

/**
 * Żądanie aktywacji konta przez token z invite linka.
 * Token jest jednorazowy, wygasa po zadanym czasie (domyślnie 7 dni).
 */
export interface ActivateAccountRequest {
  token: string;
}

/** Odpowiedź po pomyślnej aktywacji konta. */
export interface ActivateAccountResponse {
  ok: true;
}

/**
 * Status połączenia konta Microsoft dla zalogowanego użytkownika.
 * Zwracany z GET /api/v1/auth/me/ms-connection.
 *
 * - `connected: false` → użytkownik nie połączył jeszcze konta MS (msEmail/connectedAt null)
 * - `connected: true` → konto połączone; `msEmail` = adres konta MS, `connectedAt` = ISO8601
 */
export interface MsConnectionStatusDto {
  connected: boolean;
  msEmail: string | null;
  connectedAt: string | null;
}

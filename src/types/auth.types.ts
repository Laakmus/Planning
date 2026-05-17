/**
 * Typy DTO dla autoryzacji: logowanie przez username, aktywacja konta.
 *
 * Uwaga: `AuthMeDto` i `UserRole` pozostają w `./common.ts` (są używane szerzej).
 * Status połączenia z Microsoft jest w `./ms-oauth.types.ts` (`MsOAuthStatusDto`).
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

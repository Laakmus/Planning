/**
 * Typy DTO dla profilu użytkownika oraz panelu admina (CRUD userów,
 * invite linki, reset hasła).
 *
 * Mapowanie pól: DB `user_profiles` (snake_case) → TS camelCase w services.
 */

import type { UserRole, PaginatedResponse } from "./common";

/**
 * Podstawowy profil użytkownika — rozszerzenie `AuthMeDto` o pola administracyjne.
 * Używane m.in. w widoku "moje konto" oraz w logach zmian.
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  /** Czy konto jest aktywne. Nieaktywne konto nie może się zalogować. */
  isActive: boolean;
  /** Moment wysłania invite linka (ISO8601). Null = user utworzony bez invite. */
  invitedAt: string | null;
  /** Moment pierwszej aktywacji konta przez invite (ISO8601). Null = jeszcze nieaktywowane. */
  activatedAt: string | null;
}

/**
 * Żądanie utworzenia nowego użytkownika (panel admina).
 * Hasło tymczasowe ustawiane przez admina; user może je zmienić po aktywacji.
 */
export interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
}

/**
 * Żądanie aktualizacji danych użytkownika (panel admina).
 * Username jest NIEZMIENIALNY po utworzeniu konta — brak w tym DTO.
 * Hasło zmieniane osobnym endpointem (reset-password).
 */
export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Żądanie resetu hasła przez admina — ustawia nowe hasło dla wskazanego usera. */
export interface ResetPasswordRequest {
  newPassword: string;
}

/**
 * Pełne dane użytkownika dla panelu admina (widok listy + szczegółów).
 * Zawiera wszystkie metadane administracyjne.
 */
export interface AdminUserDto {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dane invite linka zwracane po utworzeniu usera lub z endpointu generującego link.
 * `url` zawiera token jako parametr (np. `/activate?token=...`).
 */
export interface InviteLinkDto {
  url: string;
  expiresAt: string;
}

/** Parametry query dla listy userów w panelu admina. */
export interface UserListQuery {
  page?: number;
  pageSize?: number;
  /** Wyszukiwanie po username / email / fullName (LIKE %...%). */
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Paginowana lista userów dla panelu admina. */
export type PaginatedUsers = PaginatedResponse<AdminUserDto>;

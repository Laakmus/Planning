/**
 * Wspólne typy DTO używane w wielu domenach.
 */

/** Rola użytkownika w systemie (user_profiles.role). */
export type UserRole = "ADMIN" | "PLANNER" | "READ_ONLY";

/**
 * Profil zalogowanego użytkownika — odpowiedź GET /api/v1/auth/me.
 * Pola w camelCase dla API.
 */
export interface AuthMeDto {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  /** Oddział magazynowy użytkownika (FK → locations). Null = brak przypisanego oddziału. */
  locationId: string | null;
}

/** Odpowiedź paginowana (lista zleceń, itp.). */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Odpowiedź lista (bez paginacji) — np. historia statusów, log zmian, słowniki. */
export interface ListResponse<T> {
  items: T[];
}

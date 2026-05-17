/**
 * Typy DTO dla integracji Microsoft Graph (AUTH-MIG Faza B3/B4):
 * - OAuth2 Authorization Code + PKCE flow (start, callback, status, disconnect)
 * - Tworzenie draftu emaila w skrzynce Outlook usera (prepare-email-graph)
 *
 * Powiązane endpointy (.ai/api-plan.md §2.1b):
 *   GET    /api/v1/ms-oauth/start
 *   GET    /api/v1/ms-oauth/callback
 *   GET    /api/v1/ms-oauth/status
 *   POST   /api/v1/ms-oauth/disconnect
 *   POST   /api/v1/orders/:id/prepare-email-graph
 *
 * Powiązana tabela DB: `ms_oauth_tokens` (migracja 20260414140000, pgcrypto).
 */

// ---------------------------------------------------------------------------
// DTOs API
// ---------------------------------------------------------------------------

/**
 * Status połączenia z Microsoft Graph dla zalogowanego usera.
 * Odpowiedź GET /api/v1/ms-oauth/status.
 *
 * Skonsolidowany DTO — zastępuje wcześniejszy `MsConnectionStatusDto` z `auth.types.ts`
 * (usunięty w ramach AUTH-MIG Phase B3).
 *
 * - `connected: false` → user nie połączył jeszcze konta MS (pozostałe pola null)
 * - `connected: true`  → konto połączone, `msEmail` = adres konta MS,
 *                        `expiresAt` = ISO 8601 wygaśnięcia access_token (do refresh-logic),
 *                        `connectedAt` = ISO 8601 pierwszego połączenia konta MS.
 */
export interface MsOAuthStatusDto {
  connected: boolean;
  msEmail: string | null;
  /** ISO 8601 — kiedy wygasa bieżący `access_token`. Null gdy brak połączenia. */
  expiresAt: string | null;
  /** ISO 8601 — kiedy user pierwszy raz połączył konto Outlook. Null gdy brak połączenia. */
  connectedAt: string | null;
}

/**
 * Odpowiedź POST /api/v1/orders/:id/prepare-email-graph.
 * Backend tworzy draft w skrzynce Outlook usera przez Graph (`/me/messages` + attachment)
 * i zwraca identyfikator draftu + link do otwarcia w przeglądarce.
 *
 * Uwaga (nazewnictwo): `draftId` = ID wiadomości w Microsoft Graph (`message.id`).
 * W api-plan.md to samo pole bywa nazywane `messageId` — zachowujemy spójność z zadaniem
 * orkiestratora (B3/B4).
 */
export interface PrepareEmailGraphResponseDto {
  /** ID draftu w Microsoft Graph (`message.id`). Pozwala później usunąć/edytować draft. */
  draftId: string;
  /** URL deep-link do edycji draftu w Outlook Web (https://outlook.office.com/mail/deeplink/compose/...). */
  webLink: string;
}

// ---------------------------------------------------------------------------
// Typy wewnętrzne — backend (service layer)
// ---------------------------------------------------------------------------

/**
 * Rekord z tabeli `ms_oauth_tokens` PO odszyfrowaniu access/refresh tokenów
 * (pgcrypto + APP_ENCRYPTION_KEY). Używany w warstwie service po `pgp_sym_decrypt`.
 *
 * NIE eksponować na warstwę API — to wrażliwe dane (tokeny w plain text).
 */
export interface MsOAuthTokenRecord {
  userId: string;
  /** Odszyfrowany access_token (Bearer, ~1h TTL). */
  accessToken: string;
  /** Odszyfrowany refresh_token (długoterminowy). */
  refreshToken: string;
  /** Kiedy wygasa `accessToken` (timestamptz z DB). */
  expiresAt: Date;
  /** Scopes przyznane przez usera (spacja-separated): "Mail.Send Mail.ReadWrite offline_access User.Read". */
  scope: string;
  /** Microsoft user ID (`id` z /me — GUID Entra). */
  msUserId: string;
  /** Adres email z konta MS (do wyświetlenia w UI). */
  msEmail: string;
}

// ---------------------------------------------------------------------------
// Surowe odpowiedzi z Microsoft (zewnętrzne API — backend wewnętrzny)
// ---------------------------------------------------------------------------

/**
 * Odpowiedź z https://login.microsoftonline.com/common/oauth2/v2.0/token
 * (Authorization Code grant + refresh_token grant).
 *
 * Dokumentacja: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */
export interface MsTokenResponse {
  access_token: string;
  refresh_token: string;
  /** Czas życia access_token w sekundach (zazwyczaj 3600). */
  expires_in: number;
  token_type: "Bearer";
  /** Scopes faktycznie przyznane przez usera (spacja-separated). */
  scope: string;
}

/**
 * Odpowiedź z https://graph.microsoft.com/v1.0/me (po exchange).
 * Używana do zapisu `ms_user_id` + `ms_email` w `ms_oauth_tokens`.
 *
 * Dokumentacja: https://learn.microsoft.com/en-us/graph/api/user-get
 */
export interface MsGraphMeResponse {
  /** GUID Entra (`id` w Graph). */
  id: string;
  /**
   * Główny adres email skrzynki (może być null dla niektórych typów kont,
   * np. personal MS account bez Exchange Online). Wtedy fallback → `userPrincipalName`.
   */
  mail: string | null;
  /** UPN — zawsze obecny, format email-like (login@domain.onmicrosoft.com lub własna domena). */
  userPrincipalName: string;
  /** Wyświetlana nazwa (Imię Nazwisko). */
  displayName: string;
}

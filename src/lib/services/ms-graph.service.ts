/**
 * Service warstwy backend dla integracji Microsoft Graph (AUTH-MIG Faza B3).
 *
 * Odpowiada za:
 *   - budowanie URL do Microsoft authorize endpoint (OAuth2 Authorization Code + PKCE S256),
 *   - wymianę code → access_token + refresh_token,
 *   - odświeżanie access_token (refresh_token grant),
 *   - pobranie profilu usera (Graph /me) — id + email,
 *   - zapis/odczyt zaszyfrowanych tokenów w `ms_oauth_tokens` (pgcrypto RPC),
 *   - tworzenie draftu w skrzynce Outlook usera + dodawanie PDF attachment,
 *   - usuwanie tokenów (disconnect).
 *
 * Wszystkie sekrety (`MS_CLIENT_SECRET`, `APP_ENCRYPTION_KEY`) są używane wyłącznie po stronie
 * serwera. Tokeny w DB są zaszyfrowane symetrycznie (pgp_sym_encrypt) — backend deszyfruje
 * przy każdym użyciu.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type {
  MsGraphMeResponse,
  MsOAuthTokenRecord,
  MsTokenResponse,
} from "../../types";
import { logError } from "../api-helpers";

// ---------------------------------------------------------------------------
// Konfiguracja (env)
// ---------------------------------------------------------------------------

/** Bazowy URL Microsoft Graph v1.0. */
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/** Standardowy zestaw scope-ów wymaganych przez aplikację. */
const MS_OAUTH_SCOPES = "Mail.ReadWrite Mail.Send offline_access User.Read";

/** Helper czytający zmienną środowiskową (Astro `import.meta.env` lub `process.env`). */
function getEnv(name: string): string | undefined {
  // Astro/Vite: dostęp przez import.meta.env w SSR
  const fromImport = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env?.[name];
  if (fromImport) return fromImport;
  // Fallback do process.env (Node)
  return process.env[name];
}

/** Zwraca skonfigurowany tenant (`common`, GUID, lub `organizations`). */
function getTenantId(): string {
  return getEnv("MS_TENANT_ID") ?? "common";
}

/** Zwraca client_id z env — rzuca gdy brak (konfiguracja niedokończona). */
function getClientId(): string {
  const value = getEnv("MS_CLIENT_ID");
  if (!value) {
    throw new Error("MS_CLIENT_ID nie jest skonfigurowane.");
  }
  return value;
}

/** Zwraca client_secret z env — rzuca gdy brak. */
function getClientSecret(): string {
  const value = getEnv("MS_CLIENT_SECRET");
  if (!value) {
    throw new Error("MS_CLIENT_SECRET nie jest skonfigurowane.");
  }
  return value;
}

/** Zwraca klucz szyfrujący — rzuca gdy brak lub za krótki. */
function getEncryptionKey(): string {
  const value = getEnv("APP_ENCRYPTION_KEY");
  if (!value || value.length < 16) {
    throw new Error("APP_ENCRYPTION_KEY musi mieć min. 16 znaków.");
  }
  return value;
}

/** Zwraca redirect URI = `${PUBLIC_BASE_URL}/api/v1/ms-oauth/callback`. */
export function getRedirectUri(): string {
  const baseUrl = getEnv("PUBLIC_BASE_URL") ?? "http://localhost:4321";
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/ms-oauth/callback`;
}

// ---------------------------------------------------------------------------
// OAuth — Authorization URL
// ---------------------------------------------------------------------------

/**
 * Buduje pełny URL do Microsoft authorize endpoint.
 *
 * Parametry zgodne z OAuth2 Authorization Code Flow + PKCE (RFC 7636):
 *   - client_id, response_type=code, redirect_uri, response_mode=query
 *   - scope (z `MS_OAUTH_SCOPES`)
 *   - state (anti-CSRF, jednorazowy)
 *   - code_challenge + code_challenge_method=S256 (PKCE)
 *
 * Parametr `_userId` jest zarezerwowany — w obecnej implementacji userId jest powiązany
 * ze state-em w `oauth-state.ts`, więc nie trzeba go zaszywać w URL. Zachowany w sygnaturze
 * zgodnie z zadaniem orkiestratora (B3).
 *
 * @param state — losowa wartość anti-CSRF (z `createOAuthState`)
 * @param codeChallenge — base64url(SHA-256(code_verifier))
 * @param _userId — id usera (do logów / future-proof; aktualnie nieużywany w URL)
 */
export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  _userId: string
): string {
  const tenantId = getTenantId();
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MS_OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // prompt=select_account → wymusza pokazanie pickera nawet jeśli user jest zalogowany
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// OAuth — Token exchange & refresh
// ---------------------------------------------------------------------------

/** URL token endpoint dla skonfigurowanego tenantu. */
function getTokenEndpoint(): string {
  const tenantId = getTenantId();
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
}

/**
 * Wymienia `code` z callbacku na access_token + refresh_token.
 *
 * Używa PKCE — `code_verifier` musi być przekazany jako proof (zamiast/oprócz client_secret).
 * Microsoft v2 dla aplikacji "confidential" wymaga jednak `client_secret` w body.
 *
 * @param code — authorization_code z callbacku
 * @param codeVerifier — surowy code_verifier (PKCE)
 * @throws Error gdy Microsoft zwróci błąd HTTP — message generyczny, szczegóły w logu
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<MsTokenResponse> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier,
    scope: MS_OAUTH_SCOPES,
  });

  return await postTokenEndpoint(body, "exchangeCodeForTokens");
}

/**
 * Odświeża access_token przy użyciu refresh_token.
 *
 * Uwaga: Microsoft może wystawić NOWY refresh_token przy każdym odświeżeniu — należy go zapisać.
 *
 * @param refreshToken — surowy refresh_token (po decrypt z DB)
 * @throws Error gdy refresh zostanie odrzucony (np. user revoked consent)
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<MsTokenResponse> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: MS_OAUTH_SCOPES,
  });

  return await postTokenEndpoint(body, "refreshAccessToken");
}

/**
 * Helper POST do /token endpoint — wspólna obsługa błędów + parsowanie odpowiedzi.
 *
 * Nie ujawnia komunikatów Microsoftu na zewnątrz (potencjalne dane wrażliwe / debug info).
 * Pełne body błędu jest logowane dla devów (`logError`).
 */
async function postTokenEndpoint(
  body: URLSearchParams,
  context: string
): Promise<MsTokenResponse> {
  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    logError(`[ms-graph][${context}] HTTP ${response.status}`, new Error(errorBody.slice(0, 500)));
    throw new Error(`Microsoft token endpoint zwrócił ${response.status}.`);
  }

  const json = (await response.json()) as MsTokenResponse;

  // Defensywna walidacja: wszystkie wymagane pola muszą być obecne
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    // UWAGA: NIE loguj `json` ani `JSON.stringify(json)` — zawiera access_token w plaintext.
    // Logujemy tylko nazwy pól + typy (diagnostyka bez wrażliwych danych).
    const fieldShape = Object.entries(json as unknown as Record<string, unknown>)
      .map(([k, v]) => `${k}:${typeof v}`)
      .join(",");
    logError(`[ms-graph][${context}] niepełna odpowiedź — pola: ${fieldShape}`, new Error("incomplete token response"));
    throw new Error("Microsoft zwrócił niekompletny zestaw tokenów.");
  }

  return json;
}

// ---------------------------------------------------------------------------
// Graph — /me (profil usera)
// ---------------------------------------------------------------------------

/**
 * Pobiera dane usera z Graph /me — `id` (Entra GUID) + `mail` / `userPrincipalName` + `displayName`.
 *
 * @param accessToken — Bearer token (z `exchangeCodeForTokens` / `getValidAccessToken`)
 */
export async function getMsUser(accessToken: string): Promise<MsGraphMeResponse> {
  const response = await fetch(`${GRAPH_BASE}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    logError("[ms-graph][getMsUser]", new Error(`HTTP ${response.status} ${errorBody.slice(0, 300)}`));
    throw new Error(`Microsoft Graph /me zwrócił ${response.status}.`);
  }

  return (await response.json()) as MsGraphMeResponse;
}

// ---------------------------------------------------------------------------
// DB — encrypt/decrypt tokens via pgcrypto RPC
// ---------------------------------------------------------------------------

/**
 * Wywołuje RPC `encrypt_ms_token(p_plain, p_key)` i zwraca ciphertext jako string.
 * Supabase deserializuje `bytea` do hex-string (`\\x...`), który następnie używamy jako Insert value.
 */
async function encryptToken(
  supabase: SupabaseClient<Database>,
  plain: string
): Promise<string> {
  const { data, error } = await supabase.rpc("encrypt_ms_token", {
    p_plain: plain,
    p_key: getEncryptionKey(),
  });
  if (error || !data) {
    logError("[ms-graph][encryptToken]", error ?? new Error("encrypt_ms_token returned empty"));
    throw new Error("Błąd szyfrowania tokenu MS.");
  }
  return data as string;
}

/**
 * Wywołuje RPC `decrypt_ms_token(p_encrypted, p_key)` i zwraca odszyfrowany string.
 */
async function decryptToken(
  supabase: SupabaseClient<Database>,
  encrypted: string
): Promise<string> {
  const { data, error } = await supabase.rpc("decrypt_ms_token", {
    p_encrypted: encrypted,
    p_key: getEncryptionKey(),
  });
  if (error || !data) {
    logError("[ms-graph][decryptToken]", error ?? new Error("decrypt_ms_token returned empty"));
    throw new Error("Błąd odszyfrowania tokenu MS.");
  }
  return data as string;
}

// ---------------------------------------------------------------------------
// DB — save / read / delete tokens
// ---------------------------------------------------------------------------

/**
 * Upsert tokenów MS w `ms_oauth_tokens`. Klucz pkurs = `user_id`.
 *
 * @param supabase — service_role client (omija RLS — wymagane bo user_id z auth.uid()
 *                   nie matchuje gdy zapisujemy z poziomu API route)
 * @param userId — id usera z user_profiles (== auth.users.id)
 * @param tokenResponse — surowa odpowiedź Microsoftu
 * @param msUser — profile z Graph /me (id + email)
 */
export async function saveTokens(
  supabase: SupabaseClient<Database>,
  userId: string,
  tokenResponse: MsTokenResponse,
  msUser: MsGraphMeResponse
): Promise<void> {
  const accessEncrypted = await encryptToken(supabase, tokenResponse.access_token);
  const refreshEncrypted = await encryptToken(supabase, tokenResponse.refresh_token);

  // Microsoft podaje `expires_in` w sekundach od now — przeliczamy na timestamptz
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();

  // Wybór email: `mail` (Exchange) → fallback `userPrincipalName` (konta bez skrzynki)
  const msEmail = msUser.mail?.trim() || msUser.userPrincipalName;

  type Insert = Database["public"]["Tables"]["ms_oauth_tokens"]["Insert"];
  const payload: Insert = {
    user_id: userId,
    access_token_encrypted: accessEncrypted,
    refresh_token_encrypted: refreshEncrypted,
    expires_at: expiresAt,
    scope: tokenResponse.scope ?? MS_OAUTH_SCOPES,
    ms_user_id: msUser.id,
    ms_email: msEmail,
  };

  const { error } = await supabase
    .from("ms_oauth_tokens")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    logError("[ms-graph][saveTokens]", error);
    throw new Error("Błąd zapisu tokenów MS.");
  }
}

/**
 * Czyta rekord tokenu z DB + deszyfruje. Zwraca null gdy brak rekordu.
 *
 * @param supabase — service_role lub anon (RLS pozwala userowi na własne tokeny)
 */
export async function getTokenRecord(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MsOAuthTokenRecord | null> {
  const { data, error } = await supabase
    .from("ms_oauth_tokens")
    .select(
      "user_id, access_token_encrypted, refresh_token_encrypted, expires_at, scope, ms_user_id, ms_email, created_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logError("[ms-graph][getTokenRecord]", error);
    throw new Error("Błąd odczytu tokenów MS.");
  }
  if (!data) return null;

  const accessToken = await decryptToken(supabase, data.access_token_encrypted as unknown as string);
  const refreshToken = await decryptToken(supabase, data.refresh_token_encrypted as unknown as string);

  return {
    userId: data.user_id,
    accessToken,
    refreshToken,
    expiresAt: new Date(data.expires_at),
    scope: data.scope,
    msUserId: data.ms_user_id,
    msEmail: data.ms_email,
  };
}

/**
 * Usuwa rekord tokenów MS (disconnect). Idempotentne — nie rzuca gdy brak rekordu.
 */
export async function deleteTokens(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await supabase.from("ms_oauth_tokens").delete().eq("user_id", userId);
  if (error) {
    logError("[ms-graph][deleteTokens]", error);
    throw new Error("Błąd usuwania tokenów MS.");
  }
}

// ---------------------------------------------------------------------------
// Token lifecycle — getValidAccessToken (auto-refresh)
// ---------------------------------------------------------------------------

/**
 * Bufor czasu (sekundy) — token z `expires_at < now + 60s` traktujemy jako wygasły,
 * żeby uniknąć race-condition (token wygaśnie w trakcie zapytania do Graph).
 */
const REFRESH_BUFFER_SECONDS = 60;

/**
 * Zwraca świeży access_token. Gdy bieżący jest już wygasły (lub blisko) — odświeża + zapisuje
 * nowy w DB. Rzuca, jeśli user nie ma rekordu (`MS_NOT_CONNECTED`) lub refresh się nie powiódł.
 *
 * @throws Error("MS_NOT_CONNECTED") — gdy brak rekordu w `ms_oauth_tokens`
 * @throws Error("MS_REFRESH_FAILED") — gdy refresh_token został odrzucony
 */
export async function getValidAccessToken(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const record = await getTokenRecord(supabase, userId);
  if (!record) {
    throw new Error("MS_NOT_CONNECTED");
  }

  const now = Date.now();
  const expiresAtMs = record.expiresAt.getTime();

  if (expiresAtMs > now + REFRESH_BUFFER_SECONDS * 1000) {
    return record.accessToken;
  }

  // Token wygasł lub jest blisko wygaśnięcia → refresh
  let refreshed: MsTokenResponse;
  try {
    refreshed = await refreshAccessToken(record.refreshToken);
  } catch (err) {
    logError("[ms-graph][getValidAccessToken] refresh failed", err);
    throw new Error("MS_REFRESH_FAILED");
  }

  // Zapis nowych tokenów (Microsoft często rotuje refresh_token).
  // Zachowujemy `ms_user_id` + `ms_email` — refresh nie zwraca tych pól.
  // Tworzymy minimalny `MsGraphMeResponse` z istniejących danych rekordu.
  const fakeMsUser: MsGraphMeResponse = {
    id: record.msUserId,
    mail: record.msEmail,
    userPrincipalName: record.msEmail,
    displayName: "",
  };

  await saveTokens(supabase, userId, refreshed, fakeMsUser);
  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Graph — Mail draft
// ---------------------------------------------------------------------------

/** Parametry tworzenia draftu emaila w Outlook. */
export interface CreateDraftParams {
  /** Adres odbiorcy (może być pusty — user uzupełni w Outlook). */
  to: string;
  /** Temat wiadomości. */
  subject: string;
  /** Body HTML (Graph przyjmie i wyświetli w composer). */
  bodyHtml: string;
  /** PDF zakodowany w base64. */
  attachmentBase64: string;
  /** Nazwa pliku PDF (np. "zlecenie-PL-2026-001.pdf"). */
  attachmentFilename: string;
}

/**
 * Tworzy draft wiadomości w skrzynce Outlook usera + dodaje PDF jako załącznik.
 *
 * Sekwencja:
 *   1. POST /me/messages → tworzy draft (response.id = messageId, response.webLink = link do Outlook Web)
 *   2. POST /me/messages/{id}/attachments → dodaje załącznik typu `fileAttachment`
 *
 * @param accessToken — Bearer token MS (z `getValidAccessToken`)
 * @returns `{ draftId, webLink }` — id wiadomości i URL do otwarcia w Outlook Web
 */
export async function createDraftEmail(
  accessToken: string,
  params: CreateDraftParams
): Promise<{ draftId: string; webLink: string }> {
  // Krok 1: utwórz draft
  const messagePayload: Record<string, unknown> = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.bodyHtml,
    },
  };

  // toRecipients dodajemy TYLKO gdy `to` jest niepustym, sensownym emailem.
  // Pusty / niepoprawny adres powoduje błąd 400 z Graph.
  if (params.to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.to)) {
    messagePayload.toRecipients = [
      { emailAddress: { address: params.to } },
    ];
  }

  const createResp = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messagePayload),
  });

  if (!createResp.ok) {
    const errorBody = await createResp.text().catch(() => "");
    logError(
      "[ms-graph][createDraftEmail] create",
      new Error(`HTTP ${createResp.status} ${errorBody.slice(0, 500)}`)
    );
    throw new Error("Microsoft Graph odmówił utworzenia draftu.");
  }

  const message = (await createResp.json()) as { id: string; webLink?: string };
  const draftId = message.id;

  // Krok 2: dodaj PDF jako załącznik (fileAttachment, base64)
  const attachResp = await fetch(`${GRAPH_BASE}/me/messages/${draftId}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: params.attachmentFilename,
      contentType: "application/pdf",
      contentBytes: params.attachmentBase64,
    }),
  });

  if (!attachResp.ok) {
    const errorBody = await attachResp.text().catch(() => "");
    logError(
      "[ms-graph][createDraftEmail] attachment",
      new Error(`HTTP ${attachResp.status} ${errorBody.slice(0, 500)}`)
    );
    // Best-effort cleanup: usuń osierocony draft, aby nie zostawić go w skrzynce
    await fetch(`${GRAPH_BASE}/me/messages/${draftId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {
      /* ignore — i tak rzucamy poniżej */
    });
    throw new Error("Microsoft Graph odmówił dodania załącznika do draftu.");
  }

  // webLink z odpowiedzi Graph (Outlook Web compose mode).
  // Jeśli brak — fallback do deeplink/compose.
  const webLink =
    message.webLink && message.webLink.length > 0
      ? message.webLink
      : `https://outlook.office.com/mail/deeplink/compose?ItemID=${encodeURIComponent(draftId)}`;

  return { draftId, webLink };
}

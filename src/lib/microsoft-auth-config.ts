/**
 * Sprawdzenie konfiguracji Microsoft Graph API.
 *
 * Wyekstrahowane z microsoft-auth.ts żeby uniknąć importowania
 * @azure/msal-browser (254KB) gdy nie jest potrzebne.
 * Zero importów z @azure/msal-browser.
 */

/** Sprawdza czy Microsoft Graph API jest skonfigurowany (env vars). */
export function isMsalConfigured(): boolean {
  const clientId = import.meta.env.PUBLIC_MICROSOFT_CLIENT_ID;
  return typeof clientId === "string" && clientId.trim().length > 0;
}

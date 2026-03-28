/**
 * Konfiguracja i pomocnicze funkcje MSAL (Microsoft Authentication Library).
 *
 * Obsługuje logowanie OAuth2 do Microsoft Graph API — potrzebne do tworzenia
 * draftów emailowych w Outlook Web z PDF-em zlecenia w załączniku.
 *
 * Wymagane zmienne środowiskowe:
 *   PUBLIC_MICROSOFT_CLIENT_ID — Application (client) ID z Azure Portal
 *   PUBLIC_MICROSOFT_TENANT_ID — Directory (tenant) ID z Azure Portal
 *
 * UWAGA: @azure/msal-browser jest importowany dynamicznie, żeby uniknąć
 * crashu przy inicjalizacji modułu gdy env vars nie są ustawione.
 */

import type {
  PublicClientApplication,
  AccountInfo,
  AuthenticationResult,
} from "@azure/msal-browser";

// Scopes wymagane do tworzenia draftów email z załącznikami
const GRAPH_SCOPES = ["Mail.ReadWrite"];

let msalInstance: PublicClientApplication | null = null;

/**
 * Sprawdza czy konfiguracja Microsoft (env vars) jest obecna.
 * Gdy brak — cały flow Graph API jest wyłączony, fallback na .eml.
 */
export function isMsalConfigured(): boolean {
  const clientId = import.meta.env.PUBLIC_MICROSOFT_CLIENT_ID;
  return typeof clientId === "string" && clientId.trim().length > 0;
}

/**
 * Dynamicznie ładuje @azure/msal-browser.
 * Zapobiega crashowi przy inicjalizacji modułu gdy brak konfiguracji.
 */
async function loadMsal() {
  return import("@azure/msal-browser");
}

/**
 * Zwraca (lub tworzy) singleton MSAL PublicClientApplication.
 * Rzuca błąd jeśli env vars nie są skonfigurowane.
 */
export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (msalInstance) return msalInstance;

  const clientId = import.meta.env.PUBLIC_MICROSOFT_CLIENT_ID as string;
  const tenantId = import.meta.env.PUBLIC_MICROSOFT_TENANT_ID as string;

  if (!clientId?.trim()) {
    throw new Error("PUBLIC_MICROSOFT_CLIENT_ID nie jest skonfigurowany");
  }

  const authority = tenantId?.trim()
    ? `https://login.microsoftonline.com/${tenantId}`
    : "https://login.microsoftonline.com/common";

  const { PublicClientApplication: PCA } = await loadMsal();

  const config = {
    auth: {
      clientId,
      authority,
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "localStorage" as const,
    },
  };

  msalInstance = new PCA(config);
  await msalInstance.initialize();
  return msalInstance;
}

/**
 * Pobiera aktywne konto Microsoft (jeśli jest zalogowane).
 */
export function getActiveAccount(): AccountInfo | null {
  if (!msalInstance) return null;
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;
}

/**
 * Logowanie interaktywne (popup).
 * Po zalogowaniu ustawia konto jako aktywne.
 */
export async function signInMsal(): Promise<AccountInfo> {
  const instance = await getMsalInstance();
  const result = await instance.loginPopup({
    scopes: GRAPH_SCOPES,
  });
  if (result.account) {
    instance.setActiveAccount(result.account);
  }
  return result.account!;
}

/**
 * Wylogowanie z Microsoft.
 */
export async function signOutMsal(): Promise<void> {
  if (!msalInstance) return;
  const account = getActiveAccount();
  if (account) {
    await msalInstance.logoutPopup({ account });
  }
}

/**
 * Pozyskuje token dostępu do Graph API.
 * Próbuje silent (cache/refresh token) → popup jako fallback.
 */
export async function acquireMsalToken(): Promise<string> {
  const instance = await getMsalInstance();
  const account = getActiveAccount();

  if (account) {
    try {
      const result: AuthenticationResult = await instance.acquireTokenSilent({
        scopes: GRAPH_SCOPES,
        account,
      });
      return result.accessToken;
    } catch {
      // Silent token acquisition nie powiodła się — spróbuj popup
    }
  }

  // Popup fallback (pierwsze logowanie lub wygasły refresh token)
  const result = await instance.acquireTokenPopup({
    scopes: GRAPH_SCOPES,
  });
  if (result.account) {
    instance.setActiveAccount(result.account);
  }
  return result.accessToken;
}

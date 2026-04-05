/**
 * MicrosoftAuthContext — kontekst autoryzacji Microsoft Graph API.
 *
 * Udostępnia stan logowania Microsoft i metody:
 *   isConfigured — czy env vars M365 są ustawione (fallback .eml gdy false)
 *   isSignedIn — czy użytkownik jest zalogowany do M365
 *   signIn() — logowanie popup
 *   getToken() — pobranie access tokena (silent → popup fallback)
 *
 * Provider jest no-op gdy brak konfiguracji — nie renderuje żadnego UI.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { isMsalConfigured } from "@/lib/microsoft-auth-config";
import {
  getMsalInstance,
  getActiveAccount,
  signInMsal,
  signOutMsal,
  acquireMsalToken,
} from "@/lib/microsoft-auth";

// ---------------------------------------------------------------------------
// Typy kontekstu
// ---------------------------------------------------------------------------

interface MicrosoftAuthContextValue {
  /** Czy zmienne środowiskowe M365 są ustawione */
  isConfigured: boolean;
  /** Czy użytkownik jest zalogowany do M365 */
  isSignedIn: boolean;
  /** Logowanie Microsoft (popup) */
  signIn: () => Promise<void>;
  /** Wylogowanie Microsoft */
  signOut: () => Promise<void>;
  /** Pobranie access tokena (silent → popup) */
  getToken: () => Promise<string>;
}

const MicrosoftAuthContext = createContext<MicrosoftAuthContextValue>({
  isConfigured: false,
  isSignedIn: false,
  signIn: async () => {},
  signOut: async () => {},
  getToken: async () => "",
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function MicrosoftAuthProvider({ children }: { children: ReactNode }) {
  const configured = isMsalConfigured();
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Sprawdź czy jest zalogowany na starcie (z cache MSAL)
  useEffect(() => {
    if (!configured) return;

    getMsalInstance()
      .then(() => {
        const account = getActiveAccount();
        setIsSignedIn(!!account);
      })
      .catch(() => {
        // Inicjalizacja MSAL nie powiodła się — zostajemy na fallback .eml
      });
  }, [configured]);

  const signIn = useCallback(async () => {
    if (!configured) return;
    await signInMsal();
    setIsSignedIn(true);
  }, [configured]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    await signOutMsal();
    setIsSignedIn(false);
  }, [configured]);

  const getToken = useCallback(async () => {
    if (!configured) throw new Error("Microsoft nie jest skonfigurowany");
    return acquireMsalToken();
  }, [configured]);

  return (
    <MicrosoftAuthContext.Provider
      value={{ isConfigured: configured, isSignedIn, signIn, signOut, getToken }}
    >
      {children}
    </MicrosoftAuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMicrosoftAuth(): MicrosoftAuthContextValue {
  return useContext(MicrosoftAuthContext);
}

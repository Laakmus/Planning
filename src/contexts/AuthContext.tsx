/**
 * AuthContext — globalny kontekst autentykacji.
 *
 * Odpowiedzialność:
 * - Przechowywanie profilu zalogowanego użytkownika (AuthMeDto)
 * - Zarządzanie sesją Supabase (login / logout)
 * - Udostępnienie instancji ApiClient skonfigurowanego z tokenem JWT
 * - Automatyczne wylogowanie przy 401
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { AuthMeDto, UsernameLoginResponse } from "@/types";
import { ApiError, createApiClient, type ApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Typy kontekstu
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** Profil użytkownika (null gdy niezalogowany lub ładowanie). */
  user: AuthMeDto | null;
  /** True podczas sprawdzania sesji / logowania. */
  isLoading: boolean;
  /** Instancja klienta API z wbudowanym tokenem. */
  api: ApiClient;
  /** Logowanie username + hasło. Rzuca Error z komunikatem z backendu. */
  login: (username: string, password: string) => Promise<void>;
  /** Wylogowanie — czyści sesję i przekierowuje na /. */
  logout: () => Promise<void>;
  /** Ponowne pobranie profilu (np. po zmianie danych). */
  refreshUser: () => Promise<AuthMeDto | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
  /** URL Supabase (z env). */
  supabaseUrl: string;
  /** Anon key Supabase (z env). */
  supabaseAnonKey: string;
}

export function AuthProvider({
  children,
  supabaseUrl,
  supabaseAnonKey,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthMeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Supabase client — stabilna instancja (nie zmienia się między renderami)
  const supabase = useMemo<SupabaseClient<Database>>(
    () => createClient<Database>(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey],
  );

  // Callback wylogowania (wywoływany przez ApiClient przy 401)
  const handleUnauthorized = useCallback(() => {
    setUser(null);
    // Wyloguj z Supabase (fire-and-forget)
    // Ignorujemy — signOut jest best-effort przy wylogowaniu wymuszoym przez 401
    supabase.auth.signOut().catch(() => {});
    window.location.href = "/";
  }, [supabase]);

  // ApiClient — stabilna instancja z lazy getToken
  // Token przechowujemy w ref (nie state), by uniknąć tworzenia nowej instancji api
  // przy każdym odświeżeniu JWT (~co 55 min) — zamknięcie nad tokenRef.current
  // zawsze zwraca aktualny token bez potrzeby przebudowy useMemo.
  const tokenRef = useRef<string | null>(null);

  const api = useMemo<ApiClient>(
    () =>
      createApiClient({
        getToken: () => tokenRef.current,
        onUnauthorized: handleUnauthorized,
      }),
    [handleUnauthorized],
  );

  // Pobierz profil użytkownika z API
  const fetchUserProfile = useCallback(
    async (token: string): Promise<AuthMeDto | null> => {
      try {
        // Bezpośredni fetch z tokenem (potrzebny przy pierwszym logowaniu, zanim tokenRef się zaktualizuje)
        const response = await fetch("/api/v1/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        if (!response.ok) return null;
        return (await response.json()) as AuthMeDto;
      } catch {
        // Ignorujemy — brak profilu to normalny stan (błąd sieci lub niezalogowany użytkownik)
        return null;
      }
    },
    [],
  );

  // refreshUser — ponowne pobranie profilu
  const refreshUser = useCallback(async (): Promise<AuthMeDto | null> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setUser(null);
      return null;
    }
    const profile = await fetchUserProfile(token);
    setUser(profile);
    return profile;
  }, [supabase, fetchUserProfile]);

  // login — logowanie username + hasło (endpoint POST /api/v1/auth/login)
  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      setIsLoading(true);
      try {
        // Wywołanie backendowego endpointu — walidacja username + resolve email + GoTrue
        // Używamy bezpośrednio fetch (api client wymaga tokena, którego tu jeszcze nie mamy)
        const response = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          // Parsuj błąd z backendu — konwencja { error, message }
          let message = "Nieprawidłowy login lub hasło.";
          try {
            const errBody = (await response.json()) as { message?: string };
            if (errBody?.message) message = errBody.message;
          } catch {
            // Ignorujemy — użyjemy domyślnego komunikatu
          }
          throw new Error(message);
        }

        const payload = (await response.json()) as UsernameLoginResponse;

        // Zapisz sesję w Supabase SDK (localStorage) — middleware i ApiClient nadal działają na JWT
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: payload.accessToken,
          refresh_token: payload.refreshToken,
        });
        if (sessionError) {
          throw new Error("Nie udało się zapisać sesji. Spróbuj ponownie.");
        }

        tokenRef.current = payload.accessToken;

        // Pobierz pełny profil (AuthMeDto) z /api/v1/auth/me
        const profile = await fetchUserProfile(payload.accessToken);
        if (!profile) {
          throw new Error("Nie udało się pobrać profilu użytkownika.");
        }

        setUser(profile);
        // Przekierowanie na /orders obsługuje komponent wywołujący login()
      } catch (err) {
        if (err instanceof ApiError) {
          throw new Error(err.message);
        }
        throw err instanceof Error
          ? err
          : new Error("Błąd logowania. Spróbuj ponownie.");
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, fetchUserProfile],
  );

  // logout — wylogowanie
  const logout = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    tokenRef.current = null;
    window.location.href = "/";
  }, [supabase]);

  // Efekt: nasłuchuj zmian sesji Supabase (auto-refresh tokenów)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      tokenRef.current = token;

      if (!session) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Efekt: sprawdzenie istniejącej sesji przy montowaniu
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? null;

        if (cancelled) return;
        tokenRef.current = token;

        if (token) {
          const profile = await fetchUserProfile(token);
          if (!cancelled) setUser(profile);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [supabase, fetchUserProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, api, login, logout, refreshUser }),
    [user, isLoading, api, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook zwracający kontekst autentykacji.
 * Musi być używany wewnątrz <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() musi być używany wewnątrz <AuthProvider>");
  }
  return ctx;
}

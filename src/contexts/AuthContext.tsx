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
import type { AuthMeDto } from "@/types";
import { createApiClient, type ApiClient } from "@/lib/api-client";

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
  /** Logowanie email + hasło. Rzuca Error z komunikatem generycznym. */
  login: (email: string, password: string) => Promise<void>;
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
        // Bezpośredni fetch z tokenem (zamiast api.get, bo api może mieć stary token)
        const response = await fetch("/api/v1/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        if (!response.ok) return null;
        return (await response.json()) as AuthMeDto;
      } catch {
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

  // login — logowanie email + hasło
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.session) {
          throw new Error("Nieprawidłowy login lub hasło.");
        }

        const token = data.session.access_token;
        tokenRef.current = token;

        const profile = await fetchUserProfile(token);
        if (!profile) {
          throw new Error("Nie udało się pobrać profilu użytkownika.");
        }

        setUser(profile);
        // Przekierowanie na /orders obsługuje komponent wywołujący login()
      } catch (err) {
        // Rzucamy generyczny komunikat (bez ujawniania czy user istnieje)
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

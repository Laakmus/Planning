import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthMeDto } from "@/types";
import { supabaseBrowser } from "@/db/supabase.browser";
import { apiClient, configureApiClient, ApiError } from "@/lib/api-client";

interface AuthState {
  user: AuthMeDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Store token in module scope so api-client can access it synchronously
let currentToken: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const getToken = useCallback((): string | null => {
    return currentToken;
  }, []);

  const handleUnauthorized = useCallback(() => {
    currentToken = null;
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.location.href = "/";
  }, []);

  // Configure api-client with auth helpers on mount
  useEffect(() => {
    configureApiClient({
      getToken: () => currentToken,
      onUnauthorized: handleUnauthorized,
    });
  }, [handleUnauthorized]);

  // Fetch user profile using token. Throws ApiError with server message on 401/4xx/5xx.
  const fetchUser = useCallback(async (): Promise<AuthMeDto | null> => {
    try {
      return await apiClient.get<AuthMeDto>("/api/v1/auth/me");
    } catch (err) {
      if (err instanceof ApiError) throw err;
      return null;
    }
  }, []);

  // Initialize auth state from existing Supabase session
  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (session?.access_token) {
        currentToken = session.access_token;
        try {
          const user = await fetchUser();
          if (user) {
            setState({ user, isLoading: false, isAuthenticated: true });
            return;
          }
        } catch {
          // 401 / brak profilu – traktuj jak wylogowanie
        }
      }

      currentToken = null;
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }

    init();

    // Listen for auth state changes (token refresh, sign out in another tab)
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        currentToken = session.access_token;
      } else {
        currentToken = null;
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        throw new Error(error?.message ?? "Logowanie nie powiodło się");
      }

      currentToken = data.session.access_token;
      let user: AuthMeDto | null = null;
      try {
        user = await fetchUser();
      } catch (err) {
        currentToken = null;
        setState({ user: null, isLoading: false, isAuthenticated: false });
        throw err;
      }

      if (!user) {
        currentToken = null;
        setState({ user: null, isLoading: false, isAuthenticated: false });
        throw new Error("Nie udało się pobrać profilu użytkownika");
      }

      setState({ user, isLoading: false, isAuthenticated: true });
    },
    [fetchUser],
  );

  const logout = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    currentToken = null;
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.location.href = "/";
  }, []);

  const refreshUser = useCallback(async () => {
    if (!currentToken) return;
    const user = await fetchUser();
    if (user) {
      setState((prev) => ({ ...prev, user }));
    }
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state and actions.
 * Must be used inside AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

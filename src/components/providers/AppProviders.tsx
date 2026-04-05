/**
 * Wspólny wrapper providerów dla wszystkich wysp React.
 *
 * Eliminuje duplikację stosu providerów między OrdersApp, WarehouseApp
 * i przyszłymi widokami. Kolejność:
 *   ThemeProvider → ErrorBoundary → AuthProvider → DictionaryProvider
 *   → MicrosoftAuthProvider (lazy, warunkowy) → TooltipProvider
 *
 * MicrosoftAuthProvider jest ładowany lazy (React.lazy + Suspense) i tylko
 * gdy env var PUBLIC_MICROSOFT_CLIENT_ID jest skonfigurowany. Dzięki temu
 * @azure/msal-browser (254KB) nie trafia do bundla gdy nie jest potrzebne.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DictionaryProvider } from "@/contexts/DictionaryContext";
import { isMsalConfigured } from "@/lib/microsoft-auth-config";

// Lazy-load MicrosoftAuthProvider — @azure/msal-browser ładowany tylko gdy potrzebny
const LazyMicrosoftAuthProvider = lazy(() =>
  import("@/contexts/MicrosoftAuthContext").then((m) => ({
    default: m.MicrosoftAuthProvider,
  })),
);

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/** Czy Microsoft Graph API jest skonfigurowany (sprawdzane raz przy module load). */
const msalConfigured = isMsalConfigured();

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErrorBoundary>
        <AuthProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
          <DictionaryProvider>
            {msalConfigured ? (
              <Suspense fallback={null}>
                <LazyMicrosoftAuthProvider>
                  <TooltipProvider>
                    {children}
                  </TooltipProvider>
                </LazyMicrosoftAuthProvider>
              </Suspense>
            ) : (
              <TooltipProvider>
                {children}
              </TooltipProvider>
            )}
          </DictionaryProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

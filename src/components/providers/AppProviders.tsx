/**
 * Wspólny wrapper providerów dla wszystkich wysp React.
 *
 * Eliminuje duplikację stosu providerów między OrdersApp, WarehouseApp
 * i przyszłymi widokami. Kolejność:
 *   ThemeProvider → ErrorBoundary → AuthProvider → DictionaryProvider → TooltipProvider
 */

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DictionaryProvider } from "@/contexts/DictionaryContext";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErrorBoundary>
        <AuthProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
          <DictionaryProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </DictionaryProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

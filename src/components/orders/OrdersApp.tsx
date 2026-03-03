/**
 * Korzenny komponent React wyspy /orders.
 *
 * Montowany jako `<OrdersApp client:load />` w src/pages/orders.astro.
 * Zarządza tylko activeView (dla AppHeader/OrderTabs).
 * Reszta stanu (filtry, paginacja, dane) żyje w OrdersPage.
 *
 * Struktura komponentów (docelowa):
 *   OrdersApp
 *   └── AuthProvider
 *       └── DictionaryProvider
 *           ├── AppHeader (zakładki, sync, użytkownik) ← Faza 2 ✓
 *           └── OrdersPage (filtry, tabela, stopka)    ← Faza 3 ✓
 *               ├── FilterBar + ListSettings
 *               ├── OrderTable / EmptyState
 *               ├── OrderDrawer                        ← Faza 4
 *               ├── HistoryPanel                      ← Faza 5
 *               └── StatusFooter
 */

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DictionaryProvider } from "@/contexts/DictionaryContext";
import type { ViewGroup } from "@/lib/view-models";

import AppHeader from "./AppHeader";
import { OrdersPage } from "./OrdersPage";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

function OrdersAppInner() {
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ViewGroup>("CURRENT");

  // Przekieruj na login gdy auth się rozstrzygnie i brak sesji
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/";
    }
  }, [isLoading, user]);

  // Pokaż loading spinner dopóki auth się nie rozstrzygnie
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">Ładowanie...</p>
      </div>
    );
  }

  // Brak sesji — nie renderuj nic (redirect w toku)
  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppHeader activeView={activeView} onViewChange={setActiveView} />
      <OrdersPage activeView={activeView} />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function OrdersApp() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErrorBoundary>
        <AuthProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
          <DictionaryProvider>
            <OrdersAppInner />
          </DictionaryProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

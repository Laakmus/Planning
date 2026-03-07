/**
 * Korzenny komponent React wyspy /orders.
 *
 * Montowany jako `<OrdersApp client:load />` w src/pages/orders.astro.
 * Zarządza activeView (sidebar nawigacja) i zapewnia layout z sidebarem.
 *
 * Struktura komponentów:
 *   OrdersApp
 *   └── ThemeProvider
 *       └── ErrorBoundary
 *           └── AuthProvider
 *               └── DictionaryProvider
 *                   └── TooltipProvider
 *                       └── SidebarProvider
 *                           ├── AppSidebar (nawigacja, sync, użytkownik)
 *                           └── SidebarInset
 *                               ├── header (SidebarTrigger + tytuł widoku)
 *                               ├── OrdersPage (filtry, tabela, stopka)
 *                               └── Toaster
 */

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DictionaryProvider } from "@/contexts/DictionaryContext";
import type { ViewGroup } from "@/lib/view-models";

import { AppSidebar } from "./AppSidebar";
import OrderTabs from "./OrderTabs";
import { OrdersPage } from "./OrdersPage";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/** Etykiety nagłówka dla poszczególnych widoków */
const VIEW_LABELS: Record<ViewGroup, string> = {
  CURRENT: "Aktualne zlecenia",
  COMPLETED: "Zrealizowane",
  CANCELLED: "Anulowane",
};

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
    <SidebarProvider>
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      <SidebarInset>
        <header className="shrink-0 flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1 flex justify-center">
            <OrderTabs activeView={activeView} onViewChange={setActiveView} />
          </div>
        </header>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <OrdersPage activeView={activeView} />
        </div>
        <Toaster position="top-right" richColors />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function OrdersApp() {
  return (
    <div data-testid="orders-app">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErrorBoundary>
        <AuthProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
          <DictionaryProvider>
            <TooltipProvider>
              <OrdersAppInner />
            </TooltipProvider>
          </DictionaryProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
    </div>
  );
}

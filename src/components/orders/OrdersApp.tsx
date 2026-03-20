/**
 * Korzenny komponent React wyspy /orders.
 *
 * Montowany jako `<OrdersApp client:load />` w src/pages/orders.astro.
 * Zarządza activeView (sidebar nawigacja) i zapewnia layout z sidebarem.
 *
 * Struktura komponentów:
 *   OrdersApp
 *   └── AppProviders (ThemeProvider → ErrorBoundary → AuthProvider → DictionaryProvider → TooltipProvider)
 *       └── MicrosoftAuthProvider
 *           └── SidebarProvider
 *               ├── AppSidebar (nawigacja, sync, użytkownik)
 *               └── SidebarInset
 *                   ├── header (SidebarTrigger + tytuł widoku)
 *                   ├── OrdersPage (filtry, tabela, stopka)
 *                   └── Toaster
 */

import { useEffect, useState } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { MicrosoftAuthProvider } from "@/contexts/MicrosoftAuthContext";
import type { ViewGroup } from "@/lib/view-models";

import { AppSidebar } from "./AppSidebar";
import OrderTabs from "./OrderTabs";
import { OrdersPage } from "./OrdersPage";

function OrdersAppInner() {
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ViewGroup>(() => {
    if (typeof window === "undefined") return "CURRENT";
    const param = new URLSearchParams(window.location.search).get("view");
    if (param === "CURRENT" || param === "COMPLETED" || param === "CANCELLED") return param;
    return "CURRENT";
  });

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
    <SidebarProvider defaultOpen={false}>
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
      <AppProviders>
        <MicrosoftAuthProvider>
          <OrdersAppInner />
        </MicrosoftAuthProvider>
      </AppProviders>
    </div>
  );
}

/**
 * Korzenny komponent React wyspy /admin/users.
 *
 * Analogicznie do OrdersApp:
 *  - opakowuje drzewo w `AppProviders` (Theme/Auth/Dictionary/Tooltip/Msal)
 *  - montuje `SidebarProvider` + `AppSidebar` + `SidebarInset`
 *  - guard ADMIN po stronie klienta (redirect na `/` gdy user.role != ADMIN)
 *
 * Uwaga: główny guard jest server-side w middleware + endpointach admin API;
 * klient robi tylko defensive redirect, by nie renderować pustej tabeli 403.
 */

import { useEffect } from "react";

import { AppSidebar } from "@/components/orders/AppSidebar";
import { AppProviders } from "@/components/providers/AppProviders";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";

import { UsersPanel } from "./UsersPanel";

function AdminUsersAppInner() {
  const { user, isLoading } = useAuth();

  // Guard: brak sesji → redirect na login; rola != ADMIN → redirect na /orders
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      window.location.href = "/";
      return;
    }
    if (user.role !== "ADMIN") {
      window.location.href = "/orders";
    }
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">Ładowanie...</p>
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    // Redirect w toku — nie renderuj panelu
    return null;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      {/* Sidebar wymaga propów activeView/onViewChange — w panelu admina nie wybieramy widoku zleceń,
          więc przekazujemy `null` + no-op. AppSidebar obsługuje null (nic nie jest aktywne w sekcji Widoki). */}
      <AppSidebar activeView={null} onViewChange={() => {}} />
      <SidebarInset>
        <header className="shrink-0 flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-sm font-semibold uppercase tracking-wide">Użytkownicy</h1>
        </header>
        <div className="flex flex-col flex-1 min-h-0 overflow-auto p-4">
          <UsersPanel />
        </div>
        <Toaster position="top-right" richColors />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AdminUsersApp() {
  return (
    <div data-testid="admin-users-app">
      <AppProviders>
        <AdminUsersAppInner />
      </AppProviders>
    </div>
  );
}

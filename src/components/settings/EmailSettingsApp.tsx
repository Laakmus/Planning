/**
 * Korzenny komponent React wyspy /settings/email.
 *
 * Montowany jako `<EmailSettingsApp client:load />` w src/pages/settings/email.astro.
 * Zapewnia providery (Auth + Theme + Dictionary + Tooltip), sidebar i obszar
 * konfiguracji ustawień e-mail (EmailConnectionCard).
 */

import { useEffect, useRef } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { AppSidebar } from "@/components/orders/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";

import { EmailConnectionCard } from "./EmailConnectionCard";

function EmailSettingsAppInner() {
  const { user, isLoading } = useAuth();

  // Śledzi czy użytkownik był kiedykolwiek zalogowany — zapobiega odmontowaniu drzewa
  // przy chwilowym null z auth event (zgodnie ze wzorcem z OrdersApp).
  const wasEverLoggedIn = useRef(false);
  if (user) {
    wasEverLoggedIn.current = true;
  }

  // Przekieruj na login gdy auth się rozstrzygnie i brak sesji
  useEffect(() => {
    if (!isLoading && !user) {
      if (!wasEverLoggedIn.current) {
        window.location.href = "/";
        return;
      }
      const timer = setTimeout(() => {
        window.location.href = "/";
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">Ładowanie...</p>
      </div>
    );
  }

  if (!user) {
    if (wasEverLoggedIn.current) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-sm text-slate-400">Ładowanie...</p>
        </div>
      );
    }
    return null;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      {/* AppSidebar przyjmuje activeView | null — dla ekranu ustawień podajemy null */}
      <AppSidebar activeView={null} onViewChange={() => undefined} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Ustawienia</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              Email
            </span>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <EmailConnectionCard />
          </div>
        </div>

        <Toaster position="top-right" richColors />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function EmailSettingsApp() {
  return (
    <div data-testid="email-settings-app">
      <AppProviders>
        <EmailSettingsAppInner />
      </AppProviders>
    </div>
  );
}

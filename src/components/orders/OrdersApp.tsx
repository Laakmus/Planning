import { useState, useCallback } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DictionaryProvider } from "@/contexts/DictionaryContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/layout/AppHeader";
import { OrdersPage } from "./OrdersPage";
import type { ViewGroup } from "@/types";

/**
 * Inner component — redirects to login if not authenticated.
 * Manages shared view state between AppHeader (tabs) and OrdersPage (list).
 */
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ViewGroup>("CURRENT");

  const handleViewChange = useCallback((view: ViewGroup) => {
    setActiveView(view);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/";
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Przekierowywanie do logowania...</p>
      </div>
    );
  }

  return (
    <DictionaryProvider>
      <TooltipProvider>
        <div className="flex min-h-screen flex-col bg-[#f6f7f8] dark:bg-[#101922]">
          <AppHeader activeView={activeView} onViewChange={handleViewChange} />
          <main className="flex-1">
            <OrdersPage activeView={activeView} onViewChange={handleViewChange} />
          </main>
        </div>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </DictionaryProvider>
  );
}

/**
 * Root React island for the /orders page.
 * Wraps everything in AuthProvider → DictionaryProvider → TooltipProvider.
 */
export default function OrdersApp() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

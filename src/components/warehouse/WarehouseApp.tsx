/**
 * Korzeń React wyspy /warehouse.
 *
 * Montowany jako <WarehouseApp client:load /> w src/pages/warehouse.astro.
 * Używa wspólnego AppProviders (jak OrdersApp).
 */

import { useEffect, useState } from "react";

import { AppProviders } from "@/components/providers/AppProviders";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";

import { AppSidebar } from "@/components/orders/AppSidebar";
import { useWarehouseWeek } from "@/hooks/useWarehouseWeek";

import { BranchSelector } from "./BranchSelector";
import { OperationLegend } from "./OperationLegend";
import { WeekNavigation } from "./WeekNavigation";
import { DayCard } from "./DayCard";
import { NoDateSection } from "./NoDateSection";
import { WeekSummaryFooter } from "./WeekSummaryFooter";

/** Brama auth — czeka na sesję, potem renderuje WarehouseContent. */
function WarehouseAppInner() {
  const { user, isLoading: authLoading } = useAuth();

  // Przekieruj na login gdy brak sesji
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/";
    }
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">Ładowanie...</p>
      </div>
    );
  }

  if (!user) return null;

  // Renderuj treść dopiero po potwierdzeniu sesji —
  // useWarehouseWeek w WarehouseContent wywoła api.get() z dostępnym tokenem.
  return <WarehouseContent />;
}

/** Właściwa treść widoku magazynowego — montowana dopiero po zalogowaniu. */
function WarehouseContent() {
  const { user } = useAuth();

  // Hooki muszą być wywoływane bezwarunkowo (React Rules of Hooks)
  const [selectedLocationId, setSelectedLocationId] = useState(user?.locationId ?? "");
  const { data, isLoading, error, week, year, prevWeek, nextWeek, goToWeek } = useWarehouseWeek(selectedLocationId || undefined);

  // Brak przypisanego oddziału — wyświetl komunikat
  if (!user?.locationId) {
    return (
      <SidebarProvider>
        <AppSidebar activeView={null} onViewChange={() => { window.location.href = "/orders"; }} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4 print:hidden">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-sm font-semibold">Widok magazynowy</h1>
          </header>
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">
              Brak przypisanego oddziału magazynowego. Skontaktuj się z administratorem.
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar activeView={null} onViewChange={() => { window.location.href = "/orders"; }} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 print:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-sm font-semibold">Widok magazynowy</h1>
          <BranchSelector value={selectedLocationId} onChange={setSelectedLocationId} />
        </header>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Nawigacja tygodniowa */}
          <WeekNavigation
            week={week}
            year={year}
            weekStart={data?.weekStart ?? null}
            weekEnd={data?.weekEnd ?? null}
            onPrev={prevWeek}
            onNext={nextWeek}
            onGoToWeek={goToWeek}
          />

          {/* Legenda operacji */}
          <OperationLegend />

          {/* Zawartość */}
          <div className="flex-1 overflow-auto px-4 pb-4 space-y-3 pt-4">
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-slate-400">Ładowanie danych tygodnia {week}...</p>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {!isLoading && !error && data && (
              <>
                {data.days.map((day) => (
                  <DayCard key={day.date} day={day} />
                ))}
                {data.noDateEntries.length > 0 && (
                  <NoDateSection entries={data.noDateEntries} />
                )}
              </>
            )}
          </div>

          {/* Podsumowanie tygodnia */}
          {data && !isLoading && (
            <WeekSummaryFooter week={week} summary={data.summary} />
          )}
        </div>

        <Toaster position="top-right" richColors />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function WarehouseApp() {
  return (
    <AppProviders>
      <WarehouseAppInner />
    </AppProviders>
  );
}

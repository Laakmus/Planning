/**
 * Sidebar nawigacyjny aplikacji zleceń transportowych.
 *
 * Zawiera:
 * - Logo + nazwa aplikacji (SidebarHeader)
 * - 3 pozycje nawigacji: Aktualne, Zrealizowane, Anulowane (SidebarContent)
 * - SyncButton, ThemeToggle, UserInfo (SidebarFooter)
 *
 * Oparty na primitywach shadcn/ui Sidebar.
 */

import { CheckCircle2, ClipboardList, Truck, Users, Warehouse, XCircle } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import type { ViewGroup } from "@/lib/view-models";

import SyncButton from "./SyncButton";
import ThemeToggle from "./ThemeToggle";
import UserInfo from "./UserInfo";

interface AppSidebarProps {
  activeView: ViewGroup | null;
  onViewChange: (view: ViewGroup) => void;
}

/** Pozycje nawigacji w sidebarze */
const NAV_ITEMS: { value: ViewGroup; label: string; icon: typeof ClipboardList }[] = [
  { value: "CURRENT", label: "Aktualne", icon: ClipboardList },
  { value: "COMPLETED", label: "Zrealizowane", icon: CheckCircle2 },
  { value: "CANCELLED", label: "Anulowane", icon: XCircle },
];

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  // Czytamy użytkownika z AuthContext, żeby wiedzieć czy pokazać sekcję "Administracja"
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  // Aktywna pozycja sekcji Administracja — tylko gdy obecny URL dotyczy panelu adminów
  const adminUsersActive =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin/users");

  return (
    <Sidebar>
      {/* Nagłówek: logo + nazwa */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg shadow-md flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">
            Zlecenia Transportowe
          </span>
        </div>
      </SidebarHeader>

      {/* Nawigacja: 3 widoki zleceń */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Widoki</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    isActive={activeView === item.value}
                    onClick={() => onViewChange(item.value)}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Separator className="mx-4 w-auto" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={typeof window !== "undefined" && window.location.pathname === "/warehouse"}
                >
                  <a href="/warehouse">
                    <Warehouse className="w-4 h-4" />
                    <span>Magazyn</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sekcja Administracja — widoczna tylko dla ADMIN-ów */}
        {isAdmin ? (
          <>
            <Separator className="mx-4 w-auto" />
            <SidebarGroup>
              <SidebarGroupLabel>Administracja</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={adminUsersActive}
                      data-testid="sidebar-admin-users"
                    >
                      <a href="/admin/users">
                        <Users className="w-4 h-4" />
                        <span>Użytkownicy</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      {/* Stopka: sync, separator, motyw + użytkownik */}
      <SidebarFooter className="p-4 space-y-3">
        <SyncButton />
        <Separator />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserInfo />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

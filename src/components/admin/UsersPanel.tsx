/**
 * Panel admina — lista użytkowników z filtrami, akcjami i paginacją.
 *
 * Obsługuje:
 *  - filtrowanie (search / role / isActive)
 *  - paginacja (prev/next, info `strona X z Y`)
 *  - akcje per user: edytuj, reset hasła, nowy invite, deaktywuj
 *  - modal tworzenia nowego usera + follow-up InviteLinkDialog
 */

import { useCallback, useState } from "react";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import type { AdminUserDto, InviteLinkDto, UserRole } from "@/types";

import { CreateUserDialog, type CreateUserSuccessPayload } from "./CreateUserDialog";
import { DeactivateUserDialog } from "./DeactivateUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { InviteLinkDialog } from "./InviteLinkDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

/** Formatuje datę ISO8601 do DD.MM.YYYY. */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

/** Mapa kolorów badge dla ról. */
const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900/50",
  PLANNER:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900/50",
  READ_ONLY:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
};

/** Sentinel używany w filtrze roli — Radix Select nie dopuszcza pustego value. */
const ALL_ROLES = "__ALL__";

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const {
    users,
    total,
    page,
    pageSize,
    totalPages,
    filters,
    isLoading,
    error,
    setFilters,
    setPage,
    createUser,
    updateUser,
    deactivateUser,
    resetPassword,
    regenerateInvite,
  } = useAdminUsers();

  // Stany dialogów
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<InviteLinkDto | null>(null);
  const [isInviteOpen, setInviteOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);

  const [resetUser, setResetUser] = useState<AdminUserDto | null>(null);
  const [isResetOpen, setResetOpen] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminUserDto | null>(null);
  const [isDeactivateOpen, setDeactivateOpen] = useState(false);

  // --- Handlery akcji --------------------------------------------------------

  const handleCreateSubmit = useCallback(
    async (body: Parameters<typeof createUser>[0]) => {
      return createUser(body);
    },
    [createUser],
  );

  const handleCreated = useCallback((payload: CreateUserSuccessPayload) => {
    setInviteLink(payload.inviteLink);
    setInviteOpen(true);
  }, []);

  const openEdit = useCallback((u: AdminUserDto) => {
    setEditingUser(u);
    setEditOpen(true);
  }, []);

  const openReset = useCallback((u: AdminUserDto) => {
    setResetUser(u);
    setResetOpen(true);
  }, []);

  const openDeactivate = useCallback((u: AdminUserDto) => {
    setDeactivateTarget(u);
    setDeactivateOpen(true);
  }, []);

  const handleRegenerateInvite = useCallback(
    async (u: AdminUserDto) => {
      try {
        const link = await regenerateInvite(u.id);
        setInviteLink(link);
        setInviteOpen(true);
      } catch {
        // Toast w hooku
      }
    },
    [regenerateInvite],
  );

  // --- Render ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4" data-testid="admin-users-panel">
      {/* Pasek filtrów + przycisk "Dodaj" */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Szukaj
          </label>
          <Input
            placeholder="Login, email lub imię i nazwisko"
            value={filters.search ?? ""}
            onChange={(e) => setFilters({ search: e.target.value })}
            data-testid="admin-users-search"
          />
        </div>

        <div className="w-44">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Rola
          </label>
          <Select
            value={filters.role ?? ALL_ROLES}
            onValueChange={(v) => setFilters({ role: v === ALL_ROLES ? undefined : (v as UserRole) })}
          >
            <SelectTrigger data-testid="admin-users-role-filter">
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROLES}>Wszystkie</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
              <SelectItem value="PLANNER">PLANNER</SelectItem>
              <SelectItem value="READ_ONLY">READ_ONLY</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-44">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Status
          </label>
          <Select
            value={
              filters.isActive === undefined ? "all" : filters.isActive ? "active" : "inactive"
            }
            onValueChange={(v) =>
              setFilters({ isActive: v === "all" ? undefined : v === "active" })
            }
          >
            <SelectTrigger data-testid="admin-users-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="active">Aktywni</SelectItem>
              <SelectItem value="inactive">Nieaktywni</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        <Button onClick={() => setCreateOpen(true)} data-testid="admin-create-user">
          <Plus className="w-4 h-4 mr-1" />
          Dodaj użytkownika
        </Button>
      </div>

      {/* Komunikaty statusu */}
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      {/* Tabela */}
      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Login</TableHead>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Utworzony</TableHead>
              <TableHead className="w-10 text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ładowanie...
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-slate-500">
                  Brak użytkowników pasujących do filtrów.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <TableRow key={u.id} data-testid="admin-user-row" data-user-id={u.id}>
                    <TableCell className="font-mono text-xs">{u.username}</TableCell>
                    <TableCell>{u.fullName ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE_CLASS[u.role]}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900/50"
                        >
                          Aktywny
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        >
                          Nieaktywny
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label="Akcje"
                            data-testid="admin-user-actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(u)}>Edytuj</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openReset(u)}>
                            Reset hasła
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleRegenerateInvite(u)}>
                            Nowy link aktywacyjny
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeactivate(u)}
                            disabled={isSelf || !u.isActive}
                            className="text-red-600 focus:text-red-700 dark:text-red-400"
                          >
                            Deaktywuj
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginacja */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Strona {page} z {totalPages} ({total} użytkowników, {pageSize} na stronę)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              data-testid="admin-users-prev"
            >
              Poprzednia
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              data-testid="admin-users-next"
            >
              Następna
            </Button>
          </div>
        </div>
      ) : null}

      {/* Dialogi */}
      <CreateUserDialog
        isOpen={isCreateOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateSubmit}
        onCreated={handleCreated}
      />
      <EditUserDialog
        isOpen={isEditOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingUser(null);
        }}
        user={editingUser}
        onSubmit={updateUser}
      />
      <ResetPasswordDialog
        isOpen={isResetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setResetUser(null);
        }}
        user={resetUser}
        onSubmit={resetPassword}
      />
      <DeactivateUserDialog
        isOpen={isDeactivateOpen}
        onOpenChange={(open) => {
          setDeactivateOpen(open);
          if (!open) setDeactivateTarget(null);
        }}
        user={deactivateTarget}
        onConfirm={deactivateUser}
      />
      <InviteLinkDialog
        isOpen={isInviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteLink(null);
        }}
        inviteLink={inviteLink}
      />
    </div>
  );
}

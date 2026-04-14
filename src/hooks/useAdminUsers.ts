/**
 * Hook zarządzający listą userów i akcjami CRUD w panelu admina.
 *
 * Udostępnia:
 *  - stan listy (users, total, page, pageSize, filters, isLoading, error)
 *  - setFilters / setPage / refetch
 *  - createUser, updateUser, deactivateUser, resetPassword, regenerateInvite
 *
 * Błędy API są rzucane dalej — komponent wywołujący powinien je obsłużyć
 * (zwykle wyświetlając toast). Sukcesy generują własne toasty.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AdminUserDto,
  CreateUserRequest,
  InviteLinkDto,
  PaginatedUsers,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserListQuery,
} from "@/types";

/** Wynik operacji tworzenia usera — zawiera też invite link. */
interface CreateUserResult {
  user: AdminUserDto;
  inviteLink: InviteLinkDto;
}

/** Odpowiedź endpointu POST /invite. */
interface InviteResponse {
  inviteLink: InviteLinkDto;
}

/** Odpowiedź endpointu PATCH /:id. */
interface UpdateUserResponse {
  user: AdminUserDto;
}

/** Domyślne filtry przy montowaniu hooka. */
const DEFAULT_FILTERS: UserListQuery = {
  page: 1,
  pageSize: 25,
  search: "",
};

export interface UseAdminUsersResult {
  users: AdminUserDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: UserListQuery;
  isLoading: boolean;
  error: string | null;
  setFilters: (next: Partial<UserListQuery>) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
  createUser: (body: CreateUserRequest) => Promise<CreateUserResult>;
  updateUser: (id: string, body: UpdateUserRequest) => Promise<AdminUserDto>;
  deactivateUser: (id: string) => Promise<void>;
  resetPassword: (id: string, body: ResetPasswordRequest) => Promise<void>;
  regenerateInvite: (id: string) => Promise<InviteLinkDto>;
}

/** Zwraca komunikat błędu z ApiError (fallback: generyczny). */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function useAdminUsers(): UseAdminUsersResult {
  const { api } = useAuth();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFiltersState] = useState<UserListQuery>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce dla search — zapobiega odpytywaniu API przy każdym znaku
  const debouncedSearchRef = useRef<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (debouncedSearchRef.current !== null) {
      window.clearTimeout(debouncedSearchRef.current);
    }
    debouncedSearchRef.current = window.setTimeout(() => {
      setDebouncedSearch(filters.search ?? "");
    }, 300);
    return () => {
      if (debouncedSearchRef.current !== null) {
        window.clearTimeout(debouncedSearchRef.current);
      }
    };
  }, [filters.search]);

  // Pobiera aktualną stronę listy
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 25,
        search: debouncedSearch.trim() || undefined,
        role: filters.role,
        isActive: filters.isActive,
      };
      const result = await api.get<PaginatedUsers>("/api/v1/admin/users", params);
      setUsers(result.items);
      setTotal(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(errorMessage(err, "Nie udało się pobrać listy użytkowników"));
      setUsers([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [api, filters.page, filters.pageSize, filters.role, filters.isActive, debouncedSearch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Zmiana filtrów (resetuje stronę do 1 gdy zmienia się search/role/isActive)
  const setFilters = useCallback((next: Partial<UserListQuery>) => {
    setFiltersState((prev) => {
      const updated = { ...prev, ...next };
      // Reset strony przy zmianie filtrów (z wyjątkiem jawnej zmiany page)
      const keys = Object.keys(next);
      const onlyPage = keys.length === 1 && keys[0] === "page";
      if (!onlyPage) updated.page = 1;
      return updated;
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((prev) => ({ ...prev, page }));
  }, []);

  const refetch = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  // --- Akcje mutujące --------------------------------------------------------

  const createUser = useCallback(
    async (body: CreateUserRequest): Promise<CreateUserResult> => {
      try {
        const result = await api.post<CreateUserResult>("/api/v1/admin/users", body);
        toast.success("Użytkownik utworzony");
        await fetchUsers();
        return result;
      } catch (err) {
        const msg = errorMessage(err, "Nie udało się utworzyć użytkownika");
        toast.error(msg);
        throw err;
      }
    },
    [api, fetchUsers],
  );

  const updateUser = useCallback(
    async (id: string, body: UpdateUserRequest): Promise<AdminUserDto> => {
      try {
        const result = await api.patch<UpdateUserResponse>(`/api/v1/admin/users/${id}`, body);
        toast.success("Dane użytkownika zaktualizowane");
        await fetchUsers();
        return result.user;
      } catch (err) {
        const msg = errorMessage(err, "Nie udało się zaktualizować użytkownika");
        toast.error(msg);
        throw err;
      }
    },
    [api, fetchUsers],
  );

  const deactivateUser = useCallback(
    async (id: string): Promise<void> => {
      try {
        await api.delete<void>(`/api/v1/admin/users/${id}`);
        toast.success("Użytkownik został deaktywowany");
        await fetchUsers();
      } catch (err) {
        const msg = errorMessage(err, "Nie udało się deaktywować użytkownika");
        toast.error(msg);
        throw err;
      }
    },
    [api, fetchUsers],
  );

  const resetPassword = useCallback(
    async (id: string, body: ResetPasswordRequest): Promise<void> => {
      try {
        await api.post<void>(`/api/v1/admin/users/${id}/reset-password`, body);
        toast.success("Hasło zostało zresetowane");
      } catch (err) {
        const msg = errorMessage(err, "Nie udało się zresetować hasła");
        toast.error(msg);
        throw err;
      }
    },
    [api],
  );

  const regenerateInvite = useCallback(
    async (id: string): Promise<InviteLinkDto> => {
      try {
        const result = await api.post<InviteResponse>(`/api/v1/admin/users/${id}/invite`, {});
        toast.success("Nowy link aktywacyjny wygenerowany");
        return result.inviteLink;
      } catch (err) {
        const msg = errorMessage(err, "Nie udało się wygenerować linku");
        toast.error(msg);
        throw err;
      }
    },
    [api],
  );

  return {
    users,
    total,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 25,
    totalPages,
    filters,
    isLoading,
    error,
    setFilters,
    setPage,
    refetch,
    createUser,
    updateUser,
    deactivateUser,
    resetPassword,
    regenerateInvite,
  };
}

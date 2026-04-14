/**
 * Serwis administracyjny userów — logika CRUD + invite link.
 *
 * Obsługuje:
 *  - listowanie userów z paginacją i filtrami (LIKE sanitized)
 *  - tworzenie usera (auth.users + user_profiles + invite token)
 *  - aktualizację profilu (email/fullName/phone/role/isActive)
 *  - deaktywację (soft delete: is_active=false + signOut)
 *  - reset hasła przez admina
 *  - regenerację invite linka
 *
 * Wszystkie metody wymagają klienta service_role (auth.admin.* wymaga uprawnień admina Supabase).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type {
  AdminUserDto,
  CreateUserRequest,
  InviteLinkDto,
  UpdateUserRequest,
  UserListQuery,
} from "../../types/user-profile.types";
import type { PaginatedResponse, UserRole } from "../../types/common";
import { buildActivateUrl, generateInviteToken } from "./invite-token.service";

/** Publiczny base URL aplikacji — używany do budowania linków invite. */
function getPublicBaseUrl(): string {
  return (
    import.meta.env.PUBLIC_BASE_URL ??
    process.env.PUBLIC_BASE_URL ??
    "http://localhost:4321"
  );
}

// ---------------------------------------------------------------------------
// Service-role client — opcjonalny helper (endpoint może przekazać własny)
// ---------------------------------------------------------------------------

/**
 * Tworzy klienta service_role dla operacji admin (auth.admin.*).
 * Wymaga SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY w env.
 */
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY — nie można utworzyć klienta admin."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Mappery
// ---------------------------------------------------------------------------

/** Surowy wiersz user_profiles z DB. */
type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

/**
 * Mapuje wiersz DB (snake_case) na DTO (camelCase).
 * Centralne miejsce — wszystkie endpointy zwracają spójną strukturę.
 */
export function mapRowToAdminUserDto(row: UserProfileRow): AdminUserDto {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    // rola w DB jest stringiem — rzutujemy na UserRole (walidowane przez CHECK constraint w DB)
    role: row.role as UserRole,
    isActive: row.is_active,
    invitedAt: row.invited_at,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// GET /admin/users — listowanie z paginacją
// ---------------------------------------------------------------------------

/**
 * Zwraca paginowaną listę userów dla panelu admina.
 * Sortowanie: created_at DESC. Search LIKE %...% po username/email/full_name (sanitized).
 */
export async function listUsers(
  supabase: SupabaseClient<Database>,
  query: UserListQuery
): Promise<PaginatedResponse<AdminUserDto>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let q = supabase
    .from("user_profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Filtr po roli
  if (query.role !== undefined) {
    q = q.eq("role", query.role);
  }

  // Filtr po aktywności
  if (query.isActive !== undefined) {
    q = q.eq("is_active", query.isActive);
  }

  // Search: LIKE na username || email || full_name z sanitize `%`, `_`, `\`
  if (query.search !== undefined && query.search.trim() !== "") {
    const escaped = query.search.trim().replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;
    // PostgREST `.or()` wymaga syntaxu `pole.operator.value,pole2.operator.value`
    q = q.or(
      `username.ilike.${pattern},email.ilike.${pattern},full_name.ilike.${pattern}`
    );
  }

  const { data, error, count } = await q;
  if (error) {
    throw new Error(`Błąd pobierania listy userów: ${error.message}`);
  }

  const items = (data ?? []).map(mapRowToAdminUserDto);
  const totalItems = count ?? 0;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

// ---------------------------------------------------------------------------
// POST /admin/users — tworzenie usera
// ---------------------------------------------------------------------------

/**
 * Tworzy usera: auth.users + user_profiles + invite token.
 *
 * Transakcyjność (compensation): gdy INSERT user_profiles się nie powiedzie po
 * utworzeniu auth.users, usuwamy auth.users, żeby nie zostawić osieroconej sesji.
 */
export async function createUser(
  supabase: SupabaseClient<Database>,
  request: CreateUserRequest
): Promise<{ user: AdminUserDto; inviteLink: InviteLinkDto }> {
  // 1. Utwórz konto w auth.users (email_confirm: true — nie wysyłamy maila Supabase)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: request.email,
    password: request.password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    throw new Error(
      `Błąd tworzenia konta w Supabase Auth: ${authError?.message ?? "brak danych usera"}`
    );
  }

  const userId = authData.user.id;

  // 2. Generuj invite token + hash + expiry (TTL 7 dni — konfiguracja w invite-token.service)
  const token = generateInviteToken();
  const nowIso = new Date().toISOString();
  const expiresAtIso = token.expiresAt.toISOString();

  // 3. INSERT user_profiles (compensation przy błędzie)
  const { data: profileRow, error: profileError } = await supabase
    .from("user_profiles")
    .insert({
      id: userId,
      email: request.email,
      username: request.username,
      full_name: request.fullName,
      phone: request.phone ?? null,
      role: request.role,
      is_active: false,
      invited_at: nowIso,
      invite_token_hash: token.hash,
      invite_expires_at: expiresAtIso,
    })
    .select("*")
    .single();

  if (profileError || !profileRow) {
    // Kompensacja — usuń auth.users, żeby nie było sieroty
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch {
      // Nawet jeśli usunięcie padnie, propagujemy oryginalny błąd profile
    }
    throw new Error(
      `Błąd tworzenia profilu: ${profileError?.message ?? "brak danych profilu"}`
    );
  }

  return {
    user: mapRowToAdminUserDto(profileRow),
    inviteLink: {
      url: buildActivateUrl(token.plainToken, getPublicBaseUrl()),
      expiresAt: expiresAtIso,
    },
  };
}

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id — aktualizacja
// ---------------------------------------------------------------------------

/**
 * Aktualizuje dane profilu usera.
 *  - zmiana email: sync z auth.users (auth.admin.updateUserById)
 *  - zmiana isActive: true → false — natychmiastowe wylogowanie (signOut)
 *  - self-deactivation zabronione (sprawdzane w endpoincie ORAZ tu jako safety net)
 */
export async function updateUser(
  supabase: SupabaseClient<Database>,
  id: string,
  data: UpdateUserRequest,
  currentUserId: string
): Promise<{ user: AdminUserDto }> {
  // Zabezpieczenie: admin nie może deaktywować siebie
  if (data.isActive === false && id === currentUserId) {
    throw new Error("SELF_DEACTIVATION");
  }

  // Pobierz aktualny stan, żeby wiedzieć czy isActive się zmienia (potrzebne do signOut)
  const { data: currentRow, error: fetchErr } = await supabase
    .from("user_profiles")
    .select("is_active, email")
    .eq("id", id)
    .single();

  if (fetchErr || !currentRow) {
    throw new Error("USER_NOT_FOUND");
  }

  // Budujemy update payload — tylko zmienione pola
  const updatePayload: Database["public"]["Tables"]["user_profiles"]["Update"] = {};
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.fullName !== undefined) updatePayload.full_name = data.fullName;
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.isActive !== undefined) updatePayload.is_active = data.isActive;

  // UPDATE user_profiles
  const { data: updatedRow, error: updateErr } = await supabase
    .from("user_profiles")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedRow) {
    throw new Error(
      `Błąd aktualizacji profilu: ${updateErr?.message ?? "brak danych"}`
    );
  }

  // Sync auth.users przy zmianie email
  if (data.email !== undefined && data.email !== currentRow.email) {
    const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(id, {
      email: data.email,
    });
    if (authUpdateErr) {
      throw new Error(`Błąd synchronizacji email w Auth: ${authUpdateErr.message}`);
    }
  }

  // Deaktywacja: wyloguj wszystkie sesje usera
  if (currentRow.is_active === true && data.isActive === false) {
    // Nie blokuj odpowiedzi przy błędzie signOut — logujemy, ale nie rzucamy
    await supabase.auth.admin.signOut(id).catch(() => {
      // Swallow: user zostanie wylogowany przy następnym refresh JWT (is_active=false w middleware)
    });
  }

  return { user: mapRowToAdminUserDto(updatedRow) };
}

// ---------------------------------------------------------------------------
// DELETE /admin/users/:id — deaktywacja (soft delete)
// ---------------------------------------------------------------------------

/**
 * Miękka deaktywacja usera.
 * Hard delete nie jest możliwy ze względu na FK (transport_orders.created_by_user_id itp.).
 */
export async function deactivateUser(
  supabase: SupabaseClient<Database>,
  id: string,
  currentUserId: string
): Promise<void> {
  if (id === currentUserId) {
    throw new Error("SELF_DEACTIVATION");
  }

  const { error: updateErr, count } = await supabase
    .from("user_profiles")
    .update({ is_active: false }, { count: "exact" })
    .eq("id", id);

  if (updateErr) {
    throw new Error(`Błąd deaktywacji: ${updateErr.message}`);
  }
  if (count === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  // Wyloguj wszystkie sesje (best-effort)
  await supabase.auth.admin.signOut(id).catch(() => {
    // Swallow — is_active=false w middleware i tak zablokuje dostęp
  });
}

// ---------------------------------------------------------------------------
// POST /admin/users/:id/reset-password
// ---------------------------------------------------------------------------

/**
 * Ustawia nowe hasło dla wskazanego usera (admin flow).
 * Nie wymaga znajomości starego hasła.
 */
export async function resetUserPassword(
  supabase: SupabaseClient<Database>,
  id: string,
  newPassword: string
): Promise<void> {
  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (error) {
    throw new Error(`Błąd resetu hasła: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// POST /admin/users/:id/invite — regeneracja tokenu
// ---------------------------------------------------------------------------

/**
 * Generuje nowy invite token dla usera (np. po wygaśnięciu poprzedniego).
 * Nie zmienia is_active — aktywacja odbywa się przez POST /auth/activate.
 */
export async function regenerateInvite(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<InviteLinkDto> {
  const token = generateInviteToken();
  const nowIso = new Date().toISOString();
  const expiresAtIso = token.expiresAt.toISOString();

  const { error, count } = await supabase
    .from("user_profiles")
    .update(
      {
        invite_token_hash: token.hash,
        invite_expires_at: expiresAtIso,
        invited_at: nowIso,
      },
      { count: "exact" }
    )
    .eq("id", id);

  if (error) {
    throw new Error(`Błąd regeneracji invite: ${error.message}`);
  }
  if (count === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    url: buildActivateUrl(token.plainToken, getPublicBaseUrl()),
    expiresAt: expiresAtIso,
  };
}

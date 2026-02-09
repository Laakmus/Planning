import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { UserRole } from "../../types";
import { errorResponse } from "./api-response";

/**
 * Result returned by requireAuth when authentication succeeds.
 * Contains the authenticated user's id plus their profile from user_profiles.
 */
export interface AuthResult {
  userId: string;
  email: string;
  profile: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: UserRole;
  };
  supabase: SupabaseClient<Database>;
}

/**
 * Verifies JWT authentication and loads the user profile from user_profiles.
 *
 * Uses supabase.auth.getUser() (not getSession()) for server-side verification
 * as recommended by Supabase — getUser() always validates the JWT against the
 * auth server, while getSession() only reads the local token without verification.
 *
 * @returns AuthResult on success, or a Response (401/500) on failure.
 */
export async function requireAuth(
  supabase: SupabaseClient<Database>
): Promise<AuthResult | Response> {
  // 1. Verify JWT — getUser() validates token server-side
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("UNAUTHORIZED", "Nie jesteś zalogowany", 401);
  }

  // 2. Load profile from user_profiles
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, phone, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return errorResponse(
      "PROFILE_NOT_FOUND",
      "Profil użytkownika nie istnieje",
      401
    );
  }

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      role: profile.role as UserRole,
    },
    supabase,
  };
}

/**
 * Checks if the user has one of the allowed roles.
 * Returns null if authorized, or a 403 Response if not.
 *
 * @param userRole - The authenticated user's role
 * @param allowedRoles - Roles that are permitted for the operation
 */
export function requireRole(
  userRole: UserRole,
  ...allowedRoles: UserRole[]
): Response | null {
  if (!allowedRoles.includes(userRole)) {
    return errorResponse("FORBIDDEN", "Brak uprawnień do tej operacji", 403);
  }
  return null;
}

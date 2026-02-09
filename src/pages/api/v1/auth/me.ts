import type { APIRoute } from "astro";
import type { AuthMeDto } from "../../../../types";
import { requireAuth } from "../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../lib/utils/api-response";

/**
 * GET /api/v1/auth/me
 *
 * Returns the currently authenticated user's profile and role.
 * Called by the frontend after app load to establish identity and permissions.
 *
 * Requires: Authorization: Bearer <jwt_token>
 * Returns: AuthMeDto (200) or error (401, 500)
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // 1. Verify authentication and load profile
    const authResult = await requireAuth(locals.supabase);

    // If requireAuth returned a Response, it means authentication failed
    if (authResult instanceof Response) {
      return authResult;
    }

    // 2. Map profile to AuthMeDto (camelCase response)
    const responseData: AuthMeDto = {
      id: authResult.profile.id,
      email: authResult.profile.email,
      fullName: authResult.profile.fullName,
      phone: authResult.profile.phone,
      role: authResult.profile.role,
    };

    // 3. Return JSON response
    return jsonResponse(responseData);
  } catch {
    // Unexpected error (network, DB connection, etc.)
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};

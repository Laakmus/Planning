/**
 * GET /api/v1/warehouse/orders — tygodniowy widok magazynowy.
 *
 * Query params (opcjonalne):
 *   week       — numer tygodnia ISO (1-53)
 *   year       — rok (2020-2099)
 *   locationId — UUID oddziału wewnętrznego (opcjonalny override)
 * Gdy brak parametrów week/year, zwraca dane dla bieżącego tygodnia ISO.
 * Gdy brak locationId, używa oddziału przypisanego do profilu użytkownika.
 *
 * Wymaga zalogowanego użytkownika z przypisanym oddziałem (locationId w profilu)
 * LUB jawnie podanym locationId w query.
 * Odpowiedź: 200 + WarehouseWeekResponseDto.
 * Błędy: 400, 401, 403, 500.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/api-helpers";
import {
  getCurrentISOWeek,
  getWarehouseWeekOrders,
} from "../../../../lib/services/warehouse.service";
import { warehouseQuerySchema } from "../../../../lib/validators/order.validator";

export const GET: APIRoute = async ({ locals, request }) => {
  if (!locals.supabase) {
    return errorResponse(
      500,
      "Internal Server Error",
      "Konfiguracja serwera: brak klienta Supabase."
    );
  }

  // Autoryzacja
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) {
    return authResult;
  }

  // Parsuj query params
  const url = new URL(request.url);
  const rawWeek = url.searchParams.get("week");
  const rawYear = url.searchParams.get("year");
  const rawLocationId = url.searchParams.get("locationId");

  let week: number;
  let year: number;
  let validatedLocationId: string | undefined;

  if (rawWeek && rawYear) {
    // Walidacja Zod (week + year + opcjonalny locationId)
    const parsed = warehouseQuerySchema.safeParse({
      week: rawWeek,
      year: rawYear,
      ...(rawLocationId != null && { locationId: rawLocationId }),
    });
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!details[path]) details[path] = [];
        details[path].push(issue.message);
      }
      return errorResponse(
        400,
        "Bad Request",
        "Nieprawidłowe parametry tygodnia.",
        details
      );
    }
    week = parsed.data.week;
    year = parsed.data.year;
    validatedLocationId = parsed.data.locationId;
  } else {
    // Domyślnie bieżący tydzień ISO; waliduj sam locationId jeśli podany
    if (rawLocationId != null) {
      const parsed = warehouseQuerySchema.safeParse({
        week: 1,
        year: 2025,
        locationId: rawLocationId,
      });
      if (!parsed.success) {
        const locationIssues = parsed.error.issues.filter(
          (i) => i.path[0] === "locationId"
        );
        if (locationIssues.length > 0) {
          return errorResponse(
            400,
            "Bad Request",
            "Nieprawidłowy format locationId (wymagany UUID)."
          );
        }
      }
      validatedLocationId = parsed.success ? parsed.data.locationId : undefined;
    }
    const current = getCurrentISOWeek(new Date());
    week = current.week;
    year = current.year;
  }

  // Ustal effectiveLocationId — z query param lub z profilu użytkownika
  let effectiveLocationId: string;

  if (validatedLocationId) {
    // Sprawdź czy lokalizacja istnieje i należy do firmy wewnętrznej (INTERNAL)
    const { data: loc } = await (locals.supabase
      .from("locations")
      .select("id, companies!inner(type)")
      .eq("id", validatedLocationId)
      .eq("companies.type", "INTERNAL")
      .maybeSingle() as any);

    if (!loc) {
      return errorResponse(
        400,
        "Bad Request",
        "Podana lokalizacja nie istnieje lub nie jest oddziałem wewnętrznym."
      );
    }
    effectiveLocationId = validatedLocationId;
  } else if (authResult.locationId) {
    effectiveLocationId = authResult.locationId;
  } else {
    return errorResponse(
      403,
      "Forbidden",
      "Brak przypisanego oddziału magazynowego."
    );
  }

  try {
    // Pobierz nazwę lokalizacji
    const { data: location } = await (locals.supabase
      .from("locations")
      .select("name")
      .eq("id", effectiveLocationId)
      .maybeSingle() as any);

    const result = await getWarehouseWeekOrders(
      locals.supabase,
      effectiveLocationId,
      week,
      year,
      location?.name ?? "Nieznany oddział"
    );

    return jsonResponse(result, 200);
  } catch (err) {
    console.error("[GET /api/v1/warehouse/orders]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas pobierania widoku magazynowego."
    );
  }
};

/**
 * GET /api/v1/dictionaries — wszystkie słowniki w jednym zapytaniu.
 * Zwraca companies, locations, products, transportTypes, orderStatuses, vehicleVariants.
 * Identyczny format jak poszczególne endpointy (camelCase, items[]).
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  logError,
} from "../../../lib/api-helpers";
import {
  getCompanies,
  getLocations,
  getOrderStatuses,
  getProducts,
  getTransportTypes,
  getVehicleVariants,
} from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    // Równoległe pobranie wszystkich 6 słowników
    const [companies, locations, products, transportTypes, orderStatuses, vehicleVariants] =
      await Promise.all([
        getCompanies(locals.supabase),
        getLocations(locals.supabase),
        getProducts(locals.supabase),
        getTransportTypes(locals.supabase),
        getOrderStatuses(locals.supabase),
        getVehicleVariants(locals.supabase),
      ]);

    return jsonResponse(
      {
        companies: companies.items,
        locations: locations.items,
        products: products.items,
        transportTypes: transportTypes.items,
        orderStatuses: orderStatuses.items,
        vehicleVariants: vehicleVariants.items,
      },
      200,
      { "Cache-Control": "private, max-age=3600" },
    );
  } catch (err) {
    logError("[GET /api/v1/dictionaries]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania słowników.");
  }
};

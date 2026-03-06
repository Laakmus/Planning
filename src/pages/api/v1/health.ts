/**
 * GET /api/v1/health — sprawdza connectivity z bazą danych.
 * Zwraca 200 gdy DB odpowiada, 503 gdy nie.
 */

import type { APIRoute } from "astro";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const { data, error } = await locals.supabase
      .from("order_statuses")
      .select("code")
      .limit(1);

    if (error) {
      return errorResponse(503, "Service Unavailable", `DB check failed: ${error.message}`);
    }

    return jsonResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "connected",
    });
  } catch (err) {
    return errorResponse(503, "Service Unavailable", err instanceof Error ? err.message : "Unknown error");
  }
};

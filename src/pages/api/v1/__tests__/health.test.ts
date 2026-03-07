/**
 * Testy GET /api/v1/health — sprawdza connectivity z bazą danych.
 *
 * Pokrywa:
 * - 200 OK — DB odpowiada prawidłowo
 * - 503 Service Unavailable — DB zwraca error
 * - 503 Service Unavailable — wyjątek (catch block)
 * - Brak autentykacji — health NIE wymaga auth (publiczny endpoint)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/helpers/api-context";

// ---------------------------------------------------------------------------
// Mocki
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", () => ({
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
}));

import { GET } from "../health";
import * as apiHelpers from "@/lib/api-helpers";

const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string) =>
      new Response(JSON.stringify({ error, message, statusCode }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }),
  );

  mockJsonResponse.mockImplementation(
    (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
});

// ---------------------------------------------------------------------------
// Helpers — mock supabase z kontrolowaną odpowiedzią
// ---------------------------------------------------------------------------

function makeSupabaseWithResult(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function makeSupabaseThrows(errorMsg: string) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error(errorMsg)),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("GET /api/v1/health", () => {
  it("returns 200 when DB is connected", async () => {
    // Arrange — supabase query zwraca dane
    const supabase = makeSupabaseWithResult({
      data: [{ code: "nowe" }],
      error: null,
    });

    const ctx = makeApiContext({
      url: "/api/v1/health",
      locals: { supabase },
    });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("db", "connected");
    expect(body).toHaveProperty("timestamp");
  });

  it("calls supabase.from('order_statuses').select('code').limit(1)", async () => {
    // Arrange
    const supabase = makeSupabaseWithResult({ data: [{ code: "nowe" }], error: null });

    const ctx = makeApiContext({
      url: "/api/v1/health",
      locals: { supabase },
    });

    // Act
    await GET(ctx);

    // Assert — weryfikacja łańcucha wywołań
    expect(supabase.from).toHaveBeenCalledWith("order_statuses");
    expect(supabase.from("order_statuses").select).toHaveBeenCalledWith("code");
  });

  it("returns 503 when DB returns an error", async () => {
    // Arrange — supabase query zwraca error
    const supabase = makeSupabaseWithResult({
      data: null,
      error: { message: "connection refused" },
    });

    const ctx = makeApiContext({
      url: "/api/v1/health",
      locals: { supabase },
    });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(503);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      503,
      "Service Unavailable",
      "DB check failed: connection refused",
    );
  });

  it("returns 503 when supabase query throws an exception", async () => {
    // Arrange — supabase rzuca wyjątek
    const supabase = makeSupabaseThrows("Network error");

    const ctx = makeApiContext({
      url: "/api/v1/health",
      locals: { supabase },
    });

    // Act
    const response = await GET(ctx);

    // Assert
    expect(response.status).toBe(503);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      503,
      "Service Unavailable",
      "Network error",
    );
  });

  it("does NOT require authentication", async () => {
    // Arrange — health.ts nie importuje getAuthenticatedUser
    const supabase = makeSupabaseWithResult({ data: [], error: null });

    const ctx = makeApiContext({
      url: "/api/v1/health",
      locals: { supabase },
    });

    // Act
    const response = await GET(ctx);

    // Assert — endpoint dostępny bez auth
    expect(response.status).toBe(200);
  });
});

/**
 * Testy findInternalLocation (location.service.ts).
 */

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import { findInternalLocation } from "../location.service";

function makeClient(result: { data: unknown; error: unknown }) {
  const eq = vi.fn();
  const chain = { select: vi.fn(), eq, maybeSingle: vi.fn().mockResolvedValue(result) };
  chain.select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  return { client: { from } as unknown as SupabaseClient<Database>, from, eq };
}

describe("findInternalLocation", () => {
  it("zwraca id i nazwę oddziału wewnętrznego", async () => {
    const { client, from, eq } = makeClient({
      data: { id: "loc-1", name: "Oddział A", companies: { type: "INTERNAL" } },
      error: null,
    });

    await expect(findInternalLocation(client, "loc-1")).resolves.toEqual({ id: "loc-1", name: "Oddział A" });
    expect(from).toHaveBeenCalledWith("locations");
    expect(eq).toHaveBeenCalledWith("companies.type", "INTERNAL");
  });

  it("zwraca null, gdy lokalizacja nie istnieje lub nie jest INTERNAL", async () => {
    const { client } = makeClient({ data: null, error: null });

    await expect(findInternalLocation(client, "loc-x")).resolves.toBeNull();
  });

  it("rzuca błąd bazy zamiast udawać brak lokalizacji", async () => {
    const { client } = makeClient({ data: null, error: new Error("db down") });

    await expect(findInternalLocation(client, "loc-1")).rejects.toThrow("db down");
  });
});

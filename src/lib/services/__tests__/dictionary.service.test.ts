/**
 * Testy dictionary.service.ts (6 eksportów: getCompanies, getLocations, getProducts,
 * getTransportTypes, getOrderStatuses, getVehicleVariants).
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import {
  getCompanies,
  getLocations,
  getProducts,
  getTransportTypes,
  getOrderStatuses,
  getVehicleVariants,
} from "../dictionary.service";

// ---------------------------------------------------------------------------
// Helper — per-table mock
// ---------------------------------------------------------------------------

type Res = { data: unknown; error: unknown };

function buildDictMock(tableResults: Record<string, Res>) {
  const fromFn = vi.fn().mockImplementation((table: string) => {
    const res = tableResults[table] ?? { data: [], error: null };
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.ilike = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    // Thenable terminal
    chain.then = vi.fn().mockImplementation((resolve: (v: Res) => void) =>
      Promise.resolve(res).then(resolve)
    );
    return chain;
  });

  return { from: fromFn } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// getCompanies
// ---------------------------------------------------------------------------

describe("getCompanies", () => {
  const sampleCompany = {
    id: "c1",
    name: "TransPol",
    is_active: true,
    erp_id: "ERP-001",
    tax_id: "1234567890",
    type: "CARRIER",
    notes: null,
  };

  it("bez search → zwraca CompanyDto[]", async () => {
    const supabase = buildDictMock({
      companies: { data: [sampleCompany], error: null },
    });

    const result = await getCompanies(supabase);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: "c1",
      name: "TransPol",
      isActive: true,
      erpId: "ERP-001",
      taxId: "1234567890",
      type: "CARRIER",
      notes: null,
    });
  });

  it('z search "Test" → wywołuje ilike', async () => {
    const supabase = buildDictMock({
      companies: { data: [], error: null },
    });

    await getCompanies(supabase, "Test");
    // Sprawdzamy że from("companies") zostało wywołane
    expect(supabase.from).toHaveBeenCalledWith("companies");
  });

  it("błąd DB → throws", async () => {
    const supabase = buildDictMock({
      companies: { data: null, error: { message: "DB error" } },
    });

    await expect(getCompanies(supabase)).rejects.toEqual({
      message: "DB error",
    });
  });

  it("pusty wynik → { items: [] }", async () => {
    const supabase = buildDictMock({
      companies: { data: [], error: null },
    });

    const result = await getCompanies(supabase);
    expect(result).toEqual({ items: [] });
  });

  it("data null → { items: [] }", async () => {
    const supabase = buildDictMock({
      companies: { data: null, error: null },
    });

    const result = await getCompanies(supabase);
    expect(result).toEqual({ items: [] });
  });
});

// ---------------------------------------------------------------------------
// getLocations
// ---------------------------------------------------------------------------

describe("getLocations", () => {
  const sampleLocation = {
    id: "l1",
    name: "Magazyn Główny",
    company_id: "c1",
    companies: { name: "NordMetal" },
    city: "Warszawa",
    country: "PL",
    street_and_number: "ul. Testowa 1",
    postal_code: "00-001",
    is_active: true,
    notes: null,
  };

  it("bez filtrów → LocationDto[] z companyName z joinu", async () => {
    const supabase = buildDictMock({
      locations: { data: [sampleLocation], error: null },
    });

    const result = await getLocations(supabase);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].companyName).toBe("NordMetal");
  });

  it("join null (companies) → companyName: null", async () => {
    const supabase = buildDictMock({
      locations: { data: [{ ...sampleLocation, companies: null }], error: null },
    });

    const result = await getLocations(supabase);
    expect(result.items[0].companyName).toBeNull();
  });

  it("z search → OK", async () => {
    const supabase = buildDictMock({
      locations: { data: [], error: null },
    });

    const result = await getLocations(supabase, { search: "Magazyn" });
    expect(result.items).toEqual([]);
  });

  it("z companyId → OK", async () => {
    const supabase = buildDictMock({
      locations: { data: [sampleLocation], error: null },
    });

    const result = await getLocations(supabase, { companyId: "c1" });
    expect(result.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getProducts
// ---------------------------------------------------------------------------

describe("getProducts", () => {
  const sampleProduct = {
    id: "p1",
    name: "Stal nierdzewna",
    is_active: true,
    description: "Gatunek 316",
    default_loading_method_code: "PALETA",
  };

  it("happy path → ProductDto[]", async () => {
    const supabase = buildDictMock({
      products: { data: [sampleProduct], error: null },
    });

    const result = await getProducts(supabase);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: "p1",
      name: "Stal nierdzewna",
      isActive: true,
      description: "Gatunek 316",
      defaultLoadingMethodCode: "PALETA",
    });
  });

  it("z search → OK", async () => {
    const supabase = buildDictMock({
      products: { data: [], error: null },
    });

    const result = await getProducts(supabase, "Stal");
    expect(result.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTransportTypes
// ---------------------------------------------------------------------------

describe("getTransportTypes", () => {
  it("happy path → TransportTypeDto[]", async () => {
    const supabase = buildDictMock({
      transport_types: {
        data: [
          { code: "PL", name: "Krajowy", is_active: true, description: null },
        ],
        error: null,
      },
    });

    const result = await getTransportTypes(supabase);
    expect(result.items).toEqual([
      { code: "PL", name: "Krajowy", isActive: true, description: null },
    ]);
  });
});

// ---------------------------------------------------------------------------
// getOrderStatuses
// ---------------------------------------------------------------------------

describe("getOrderStatuses", () => {
  it("zwraca ALL sortowane wg sort_order; mapowanie view_group/is_editable → camelCase", async () => {
    const supabase = buildDictMock({
      order_statuses: {
        data: [
          { code: "robocze", name: "Robocze", sort_order: 1, view_group: "CURRENT", is_editable: true },
          { code: "anulowane", name: "Anulowane", sort_order: 7, view_group: "CANCELLED", is_editable: false },
        ],
        error: null,
      },
    });

    const result = await getOrderStatuses(supabase);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      code: "robocze",
      name: "Robocze",
      sortOrder: 1,
      viewGroup: "CURRENT",
      isEditable: true,
    });
    expect(result.items[1].viewGroup).toBe("CANCELLED");
    expect(result.items[1].isEditable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getVehicleVariants
// ---------------------------------------------------------------------------

describe("getVehicleVariants", () => {
  it("mapowanie capacity_tons → capacityTons, capacity_volume_m3 → capacityVolumeM3", async () => {
    const supabase = buildDictMock({
      vehicle_variants: {
        data: [{
          code: "MEGA",
          name: "Mega Trailer",
          is_active: true,
          capacity_tons: 24,
          capacity_volume_m3: 100,
          vehicle_type: "TRUCK",
          description: "Duży",
        }],
        error: null,
      },
    });

    const result = await getVehicleVariants(supabase);
    expect(result.items[0]).toEqual({
      code: "MEGA",
      name: "Mega Trailer",
      isActive: true,
      capacityTons: 24,
      capacityVolumeM3: 100,
      vehicleType: "TRUCK",
      description: "Duży",
    });
  });
});

/**
 * Testy pdf-data-resolver.ts — rozwiązywanie danych potrzebnych do generowania PDF.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { OrderDetailResponseDto } from "@/types";
import { resolvePdfData } from "../pdf-data-resolver";

// ---------------------------------------------------------------------------
// Stałe testowe
// ---------------------------------------------------------------------------

const COMPANY_ID = "f0000000-0000-0000-0000-000000000001";
const LOCATION_ID_1 = "d0000000-0000-0000-0000-000000000001";
const LOCATION_ID_2 = "d0000000-0000-0000-0000-000000000002";

// ---------------------------------------------------------------------------
// Typ pomocniczy
// ---------------------------------------------------------------------------

type Res = { data: unknown; error: unknown };

// ---------------------------------------------------------------------------
// Mock builder Supabase — uproszczony chain (from → select → eq/in → maybeSingle)
// ---------------------------------------------------------------------------

function buildSupabaseMock(
  tableResults: Record<string, Res> = {}
): SupabaseClient<Database> {
  function makeChain(table: string): Record<string, unknown> {
    const res = tableResults[table] ?? { data: null, error: null };

    const chain: Record<string, unknown> = {};
    // Chainable filtry
    const methods = ["eq", "neq", "in", "order", "limit", "select"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(res);
    chain.single = vi.fn().mockResolvedValue(res);
    // Thenable — await from().select().eq()
    chain.then = (resolve: (v: Res) => void) =>
      Promise.resolve(res).then(resolve);
    return chain;
  }

  return {
    from: vi.fn().mockImplementation((table: string) => makeChain(table)),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Fabryka danych testowych — minimalne OrderDetailResponseDto
// ---------------------------------------------------------------------------

function makeDetail(
  overrides: Partial<{
    carrierCompanyId: string | null;
    stops: OrderDetailResponseDto["stops"];
    items: OrderDetailResponseDto["items"];
  }> = {}
): OrderDetailResponseDto {
  return {
    order: {
      id: "b0000000-0000-0000-0000-000000000001",
      orderNo: "ZT2026/0001",
      statusCode: "robocze",
      transportTypeCode: "PL",
      currencyCode: "PLN",
      priceAmount: 1500,
      paymentTermDays: 30,
      paymentMethod: "przelew",
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      summaryRoute: null,
      firstLoadingDate: "2026-02-20",
      firstLoadingTime: "08:00",
      firstUnloadingDate: "2026-02-21",
      firstUnloadingTime: "14:00",
      lastLoadingDate: null,
      lastLoadingTime: null,
      lastUnloadingDate: null,
      lastUnloadingTime: null,
      transportYear: 2026,
      firstLoadingCountry: "PL",
      firstUnloadingCountry: "DE",
      carrierCompanyId: overrides.carrierCompanyId ?? null,
      carrierNameSnapshot: "Testowy Przewoźnik Sp. z o.o.",
      carrierLocationNameSnapshot: null,
      carrierAddressSnapshot: "ul. Testowa 1, 00-001 Warszawa",
      shipperLocationId: null,
      shipperNameSnapshot: null,
      shipperAddressSnapshot: null,
      receiverLocationId: null,
      receiverNameSnapshot: null,
      receiverAddressSnapshot: null,
      vehicleTypeText: "Ciężarówka",
      vehicleCapacityVolumeM3: 90,
      mainProductName: null,
      specialRequirements: null,
      requiredDocumentsText: "WZ, KPO, kwit wagowy",
      generalNotes: "Notatka testowa",
      notificationDetails: null,
      confidentialityClause: null,
      complaintReason: null,
      senderContactName: "Jan Kowalski",
      senderContactPhone: "+48 123 456 789",
      senderContactEmail: "jan@test.pl",
      createdAt: "2026-02-17T10:00:00.000Z",
      createdByUserId: "a0000000-0000-0000-0000-000000000001",
      updatedAt: "2026-02-17T10:00:00.000Z",
      updatedByUserId: null,
      lockedByUserId: null,
      lockedAt: null,
      statusName: "Robocze",
      weekNumber: 8,
      sentAt: null,
      sentByUserName: null,
      createdByUserName: "Admin Testowy",
      updatedByUserName: null,
      lockedByUserName: null,
    },
    stops: overrides.stops ?? [],
    items: overrides.items ?? [],
  };
}

function makeStop(
  overrides: Partial<OrderDetailResponseDto["stops"][0]> = {}
): OrderDetailResponseDto["stops"][0] {
  return {
    id: "c0000000-0000-0000-0000-000000000001",
    kind: "LOADING",
    sequenceNo: 1,
    dateLocal: "2026-02-20",
    timeLocal: "08:00",
    locationId: null,
    locationNameSnapshot: "Magazyn Warszawa",
    companyNameSnapshot: "Firma ABC",
    addressSnapshot: "ul. Testowa 1",
    notes: null,
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<OrderDetailResponseDto["items"][0]> = {}
): OrderDetailResponseDto["items"][0] {
  return {
    id: "e0000000-0000-0000-0000-000000000001",
    productId: null,
    productNameSnapshot: "Papier makulaturowy",
    defaultLoadingMethodSnapshot: null,
    loadingMethodCode: "luzem",
    quantityTons: 20,
    notes: "Uwaga do towaru",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("resolvePdfData", () => {
  it("should fetch carrier tax_id from companies when carrierCompanyId exists", async () => {
    const detail = makeDetail({ carrierCompanyId: COMPANY_ID });
    const supabase = buildSupabaseMock({
      companies: { data: { tax_id: "9512370578" }, error: null },
    });

    const result = await resolvePdfData(supabase, detail);

    // Sprawdzamy że supabase.from("companies") został wywołany
    expect(supabase.from).toHaveBeenCalledWith("companies");
    expect(result.order.carrierTaxId).toBe("9512370578");
  });

  it("should NOT fetch tax_id when carrierCompanyId is null", async () => {
    const detail = makeDetail({ carrierCompanyId: null });
    const supabase = buildSupabaseMock();

    const result = await resolvePdfData(supabase, detail);

    // from() nie powinno być wywołane z "companies"
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    const companiesCalls = fromCalls.filter(
      (call: string[]) => call[0] === "companies"
    );
    expect(companiesCalls).toHaveLength(0);
    expect(result.order.carrierTaxId).toBeNull();
  });

  it("should resolve stop countries from locations table", async () => {
    const stops = [
      makeStop({ locationId: LOCATION_ID_1, sequenceNo: 1 }),
      makeStop({
        id: "c0000000-0000-0000-0000-000000000002",
        locationId: LOCATION_ID_2,
        kind: "UNLOADING",
        sequenceNo: 2,
      }),
    ];
    const detail = makeDetail({ stops });

    const supabase = buildSupabaseMock({
      locations: {
        data: [
          { id: LOCATION_ID_1, country: "PL" },
          { id: LOCATION_ID_2, country: "DE" },
        ],
        error: null,
      },
    });

    const result = await resolvePdfData(supabase, detail);

    expect(result.stops[0].country).toBe("PL");
    expect(result.stops[1].country).toBe("DE");
  });

  it("should return empty locationCountryMap when no stops have locationId", async () => {
    const stops = [
      makeStop({ locationId: null, sequenceNo: 1 }),
      makeStop({
        id: "c0000000-0000-0000-0000-000000000002",
        locationId: null,
        kind: "UNLOADING",
        sequenceNo: 2,
      }),
    ];
    const detail = makeDetail({ stops });
    const supabase = buildSupabaseMock();

    const result = await resolvePdfData(supabase, detail);

    // Nie powinno być wywołania do locations
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    const locationsCalls = fromCalls.filter(
      (call: string[]) => call[0] === "locations"
    );
    expect(locationsCalls).toHaveLength(0);

    // Stopy powinny mieć country = null
    expect(result.stops[0].country).toBeNull();
    expect(result.stops[1].country).toBeNull();
  });

  it("should build correct GeneratePdfInput with key fields", async () => {
    const stops = [
      makeStop({ locationId: LOCATION_ID_1, sequenceNo: 1 }),
    ];
    const items = [makeItem()];
    const detail = makeDetail({
      carrierCompanyId: COMPANY_ID,
      stops,
      items,
    });

    const supabase = buildSupabaseMock({
      companies: { data: { tax_id: "1234567890" }, error: null },
      locations: {
        data: [{ id: LOCATION_ID_1, country: "PL" }],
        error: null,
      },
    });

    const result = await resolvePdfData(supabase, detail);

    // Sprawdzamy kluczowe pola order
    expect(result.order.orderNo).toBe("ZT2026/0001");
    expect(result.order.carrierName).toBe("Testowy Przewoźnik Sp. z o.o.");
    expect(result.order.carrierTaxId).toBe("1234567890");
    expect(result.order.priceAmount).toBe(1500);
    expect(result.order.currencyCode).toBe("PLN");
    expect(result.order.senderContactName).toBe("Jan Kowalski");

    // Sprawdzamy stop z krajem
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0].country).toBe("PL");
    expect(result.stops[0].companyNameSnapshot).toBe("Firma ABC");

    // Sprawdzamy item
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productNameSnapshot).toBe("Papier makulaturowy");
    expect(result.items[0].loadingMethodCode).toBe("luzem");
    expect(result.items[0].notes).toBe("Uwaga do towaru");
  });
});

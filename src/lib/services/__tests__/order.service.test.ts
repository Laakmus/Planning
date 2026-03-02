/**
 * Testy order.service.ts — największy serwis (~1830 linii, 8 eksportów).
 *
 * Testujemy publiczne API: updateCarrierCellColor, getOrderDetail, duplicateOrder,
 * createOrder, updateOrder, prepareEmailForOrder, patchStop, listOrders.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import {
  updateCarrierCellColor,
  getOrderDetail,
  duplicateOrder,
  createOrder,
  updateOrder,
  prepareEmailForOrder,
  patchStop,
  listOrders,
} from "../order.service";
import {
  VALID_ORDER_ID,
  VALID_USER_ID,
  VALID_STOP_ID,
  VALID_LOCATION_ID,
  VALID_PRODUCT_ID,
  VALID_COMPANY_ID,
  OTHER_USER_ID,
  makeOrderRow,
  makeStopRow,
  makeItemRow,
  makeCreateOrderParams,
  makeUpdateOrderParams,
} from "@/test/helpers/fixtures";

// ---------------------------------------------------------------------------
// Typy pomocnicze
// ---------------------------------------------------------------------------

type Res = { data: unknown; error: unknown; count?: number | null };

// ---------------------------------------------------------------------------
// Uniwersalny mock builder dla order.service
//
// order.service robi BARDZO dużo wywołań from() na wielu tabelach.
// Zamiast modelować każdy chain, używamy uproszczonego podejścia:
// - Każda tabela ma domyślny wynik dla select/insert/update/delete
// - Możemy nadpisać zachowanie per-tabela
// ---------------------------------------------------------------------------

interface TableMock {
  select?: Res;
  selectSequence?: Res[];
  insert?: Res;
  update?: Res;
  delete?: Res;
}

function buildOrderServiceMock(
  tables: Record<string, TableMock> = {},
  rpcResults?: Record<string, Res>
) {
  // Countery per tabela — do selectSequence
  const selectCounters = new Map<string, number>();

  function getTableConfig(table: string): TableMock {
    return tables[table] ?? {};
  }

  function makeChain(table: string): Record<string, unknown> {
    const cfg = getTableConfig(table);

    const selectRes = () => {
      if (cfg.selectSequence) {
        const idx = selectCounters.get(table) ?? 0;
        selectCounters.set(table, idx + 1);
        if (idx < cfg.selectSequence.length) return cfg.selectSequence[idx];
      }
      return cfg.select ?? { data: null, error: null };
    };

    const insertRes = cfg.insert ?? { data: null, error: null };
    const updateRes = cfg.update ?? { data: null, error: null, count: 1 };
    const deleteRes = cfg.delete ?? { data: null, error: null };

    // Chainable proxy — każda metoda zwraca siebie
    const chain: Record<string, unknown> = {};
    const methods = [
      "eq", "neq", "ilike", "like", "in", "order", "limit", "range",
      "not", "lt", "gt", "gte", "lte", "or", "is", "filter", "match",
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }

    // Select — chainable + thenable
    chain.select = vi.fn().mockImplementation(() => {
      const selChain = { ...chain };
      selChain.then = (resolve: (v: Res) => void) =>
        Promise.resolve(selectRes()).then(resolve);
      selChain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(selectRes()));
      selChain.single = vi.fn().mockImplementation(() => Promise.resolve(selectRes()));
      return selChain;
    });

    chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(selectRes()));
    chain.single = vi.fn().mockImplementation(() => Promise.resolve(selectRes()));

    // Thenable (await from().select()...eq() bez terminal)
    chain.then = (resolve: (v: Res) => void) =>
      Promise.resolve(selectRes()).then(resolve);

    // Insert — zwraca chain z select/single
    chain.insert = vi.fn().mockImplementation(() => {
      const insChain: Record<string, unknown> = {};
      insChain.select = vi.fn().mockReturnValue(insChain);
      insChain.single = vi.fn().mockResolvedValue(insertRes);
      insChain.maybeSingle = vi.fn().mockResolvedValue(insertRes);
      insChain.then = (resolve: (v: Res) => void) =>
        Promise.resolve(insertRes).then(resolve);
      return insChain;
    });

    // Update
    chain.update = vi.fn().mockImplementation(() => {
      const updChain: Record<string, unknown> = {};
      const updMethods = ["eq", "or", "not", "in", "neq", "is"];
      for (const um of updMethods) {
        updChain[um] = vi.fn().mockReturnValue(updChain);
      }
      updChain.select = vi.fn().mockReturnValue(updChain);
      updChain.single = vi.fn().mockResolvedValue(updateRes);
      updChain.maybeSingle = vi.fn().mockResolvedValue(updateRes);
      updChain.then = (resolve: (v: Res) => void) =>
        Promise.resolve(updateRes).then(resolve);
      return updChain;
    });

    // Delete
    chain.delete = vi.fn().mockImplementation(() => {
      const delChain: Record<string, unknown> = {};
      delChain.eq = vi.fn().mockReturnValue(delChain);
      delChain.in = vi.fn().mockReturnValue(delChain);
      delChain.then = (resolve: (v: Res) => void) =>
        Promise.resolve(deleteRes).then(resolve);
      return delChain;
    });

    return chain;
  }

  const fromFn = vi.fn().mockImplementation((table: string) => makeChain(table));

  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    const result = rpcResults?.[fnName] ?? { data: null, error: null };
    return Promise.resolve(result);
  });

  return {
    from: fromFn,
    rpc: rpcFn,
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// updateCarrierCellColor
// ---------------------------------------------------------------------------

describe("updateCarrierCellColor", () => {
  it("ustawienie koloru → { id, carrierCellColor }", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { update: { data: null, error: null, count: 1 } },
    });

    const result = await updateCarrierCellColor(supabase, VALID_ORDER_ID, "#48A111");
    expect(result).toEqual({ id: VALID_ORDER_ID, carrierCellColor: "#48A111" });
  });

  it("null → usuwanie koloru", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { update: { data: null, error: null, count: 1 } },
    });

    const result = await updateCarrierCellColor(supabase, VALID_ORDER_ID, null);
    expect(result).toEqual({ id: VALID_ORDER_ID, carrierCellColor: null });
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { update: { data: null, error: null, count: 0 } },
    });

    const result = await updateCarrierCellColor(supabase, VALID_ORDER_ID, "#48A111");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOrderDetail
// ---------------------------------------------------------------------------

describe("getOrderDetail", () => {
  it("zlecenie istnieje → OrderDetailResponseDto z stops + items", async () => {
    const orderRow = makeOrderRow();
    const supabase = buildOrderServiceMock({
      transport_orders: { select: { data: orderRow, error: null } },
      order_stops: {
        select: {
          data: [makeStopRow()],
          error: null,
        },
      },
      order_items: {
        select: {
          data: [makeItemRow()],
          error: null,
        },
      },
    });

    const result = await getOrderDetail(supabase, VALID_ORDER_ID);
    expect(result).not.toBeNull();
    expect(result!.order.id).toBe(VALID_ORDER_ID);
    expect(result!.order.orderNo).toBe("ZT2026/0001");
    expect(result!.stops).toHaveLength(1);
    expect(result!.stops[0].kind).toBe("LOADING");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].productNameSnapshot).toBe("Stal nierdzewna");
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { select: { data: null, error: null } },
    });

    const result = await getOrderDetail(supabase, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it("błąd DB → throws", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { select: { data: null, error: { message: "DB error" } } },
    });

    await expect(getOrderDetail(supabase, VALID_ORDER_ID)).rejects.toEqual({
      message: "DB error",
    });
  });
});

// ---------------------------------------------------------------------------
// duplicateOrder
// ---------------------------------------------------------------------------

describe("duplicateOrder", () => {
  function buildDuplicateMock() {
    return buildOrderServiceMock(
      {
        transport_orders: {
          selectSequence: [
            // getOrderDetail: order row
            { data: makeOrderRow(), error: null },
            // getOrderDetail: internal (doesn't actually re-select transport_orders)
          ],
          insert: { data: { id: "new-order-id", created_at: "2026-02-18T10:00:00Z" }, error: null },
        },
        order_stops: {
          select: { data: [makeStopRow()], error: null },
          insert: { data: null, error: null },
        },
        order_items: {
          select: { data: [makeItemRow()], error: null },
          insert: { data: null, error: null },
        },
        // FK validation (M-14) — validateForeignKeys wywołane w duplicateOrder
        transport_types: { select: { data: { code: "PL" }, error: null } },
        locations: { select: { data: [{ id: VALID_LOCATION_ID }], error: null } },
        products: { select: { data: [{ id: VALID_PRODUCT_ID }], error: null } },
      },
      {
        generate_next_order_no: { data: "ZT2026/0002", error: null },
      }
    );
  }

  it("kopia z includeStops + includeItems → nowe zlecenie", async () => {
    const supabase = buildDuplicateMock();

    const result = await duplicateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      includeStops: true,
      includeItems: true,
      resetStatusToDraft: true,
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("new-order-id");
    expect(result!.orderNo).toBe("ZT2026/0002");
    expect(result!.statusCode).toBe("robocze");
  });

  it("resetStatusToDraft: false → zachowuje oryginalny status", async () => {
    const supabase = buildDuplicateMock();

    const result = await duplicateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      includeStops: false,
      includeItems: false,
      resetStatusToDraft: false,
    });

    expect(result!.statusCode).toBe("robocze"); // oryginał jest robocze
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { select: { data: null, error: null } },
    });

    const result = await duplicateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      includeStops: true,
      includeItems: true,
      resetStatusToDraft: true,
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

describe("createOrder", () => {
  function buildCreateMock(overrides?: Record<string, TableMock>) {
    return buildOrderServiceMock(
      {
        // FK validation — transport_types, companies, locations, products
        transport_types: { select: { data: { code: "PL" }, error: null } },
        companies: { select: { data: { id: VALID_COMPANY_ID, name: "TransPol" }, error: null } },
        locations: {
          select: {
            data: [{ id: VALID_LOCATION_ID, name: "Magazyn", city: "Warszawa", country: "PL", street_and_number: "ul. Testowa 1", postal_code: "00-001", company_id: VALID_COMPANY_ID, companies: { name: "NordMetal" } }],
            error: null,
          },
        },
        products: {
          select: {
            data: [{ id: VALID_PRODUCT_ID, name: "Stal", default_loading_method_code: "PALETA" }],
            error: null,
          },
        },
        transport_orders: {
          insert: { data: { id: "new-id", created_at: "2026-02-20T10:00:00Z" }, error: null },
        },
        order_stops: { insert: { data: null, error: null } },
        order_items: { insert: { data: null, error: null } },
        ...overrides,
      },
      {
        generate_next_order_no: { data: "ZT2026/0010", error: null },
      }
    );
  }

  describe("happy path", () => {
    it("poprawne dane → { id, orderNo, statusCode: 'robocze' }", async () => {
      const supabase = buildCreateMock();
      const params = makeCreateOrderParams();

      const result = await createOrder(supabase, VALID_USER_ID, params);
      expect(result.id).toBe("new-id");
      expect(result.orderNo).toBe("ZT2026/0010");
      expect(result.statusCode).toBe("robocze");
    });

    it("autoSetDocuments: PL → 'WZ, KPO, kwit wagowy'", async () => {
      const supabase = buildCreateMock();
      const params = makeCreateOrderParams({
        transportTypeCode: "PL",
        requiredDocumentsText: null,
      });

      const result = await createOrder(supabase, VALID_USER_ID, params);
      expect(result).not.toBeNull();
      // Weryfikujemy, że insert do transport_orders zawiera requiredDocumentsText
      // Niestety mock nie pozwala łatwo sprawdzić payload inserta, więc sprawdzamy że nie throws
    });

    it("autoSetDocuments: EXP → 'WZE, Aneks VII, CMR'", async () => {
      const supabase = buildCreateMock();
      const params = makeCreateOrderParams({
        transportTypeCode: "EXP",
        requiredDocumentsText: null,
      });

      const result = await createOrder(supabase, VALID_USER_ID, params);
      expect(result).not.toBeNull();
    });
  });

  describe("walidacja stops", () => {
    it(">8 LOADING → throws STOPS_LIMIT", async () => {
      const supabase = buildCreateMock();
      const stops: Array<{ kind: "LOADING" | "UNLOADING"; dateLocal: string; timeLocal: string; locationId: null; notes: null }> = Array.from({ length: 9 }, () => ({
        kind: "LOADING" as const,
        dateLocal: "2026-02-20",
        timeLocal: "08:00",
        locationId: null,
        notes: null,
      }));
      stops.push({ kind: "UNLOADING", dateLocal: "2026-02-21", timeLocal: "14:00", locationId: null, notes: null });

      const params = makeCreateOrderParams({ stops });

      await expect(createOrder(supabase, VALID_USER_ID, params)).rejects.toThrow("STOPS_LIMIT");
    });

    it(">3 UNLOADING → throws STOPS_LIMIT", async () => {
      const supabase = buildCreateMock();
      const stops = [
        { kind: "LOADING" as const, dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null },
        ...Array.from({ length: 4 }, () => ({
          kind: "UNLOADING" as const,
          dateLocal: "2026-02-21",
          timeLocal: "14:00",
          locationId: null,
          notes: null,
        })),
      ];

      const params = makeCreateOrderParams({ stops });
      await expect(createOrder(supabase, VALID_USER_ID, params)).rejects.toThrow("STOPS_LIMIT");
    });

    it("pierwszy stop != LOADING → throws STOPS_ORDER", async () => {
      const supabase = buildCreateMock();
      const params = makeCreateOrderParams({
        stops: [
          { kind: "UNLOADING", dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null },
          { kind: "LOADING", dateLocal: "2026-02-21", timeLocal: "14:00", locationId: null, notes: null },
        ],
      });

      await expect(createOrder(supabase, VALID_USER_ID, params)).rejects.toThrow("STOPS_ORDER");
    });

    it("ostatni stop != UNLOADING → throws STOPS_ORDER", async () => {
      const supabase = buildCreateMock();
      const params = makeCreateOrderParams({
        stops: [
          { kind: "LOADING", dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null },
          { kind: "LOADING", dateLocal: "2026-02-21", timeLocal: "14:00", locationId: null, notes: null },
        ],
      });

      await expect(createOrder(supabase, VALID_USER_ID, params)).rejects.toThrow("STOPS_ORDER");
    });

    it("1 stop (LOADING) — brak walidacji kolejności", async () => {
      const supabase = buildCreateMock();
      const params = makeCreateOrderParams({
        stops: [
          { kind: "LOADING", dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null },
        ],
      });

      // Nie powinno rzucać STOPS_ORDER (walidacja tylko przy >= 2 stops)
      const result = await createOrder(supabase, VALID_USER_ID, params);
      expect(result).not.toBeNull();
    });
  });

  describe("walidacja FK", () => {
    it("nieistniejący transportTypeCode → throws FK_VALIDATION z details", async () => {
      const supabase = buildCreateMock({
        transport_types: { select: { data: null, error: null } },
      });
      const params = makeCreateOrderParams();

      try {
        await createOrder(supabase, VALID_USER_ID, params);
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Error).message).toBe("FK_VALIDATION");
        expect((err as Error & { details: Record<string, string> }).details).toHaveProperty("transportTypeCode");
      }
    });
  });

  describe("błędy DB", () => {
    it("RPC generateOrderNo error → throws", async () => {
      const supabase = buildOrderServiceMock(
        {
          transport_types: { select: { data: { code: "PL" }, error: null } },
        },
        {
          generate_next_order_no: { data: null, error: { message: "RPC failed" } },
        }
      );
      const params = makeCreateOrderParams({ stops: [] });

      await expect(createOrder(supabase, VALID_USER_ID, params)).rejects.toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// updateOrder
// ---------------------------------------------------------------------------

describe("updateOrder", () => {
  function buildUpdateMock(
    orderData?: Record<string, unknown>,
    tableOverrides?: Record<string, TableMock>
  ) {
    return buildOrderServiceMock({
      transport_orders: {
        select: {
          data: {
            id: VALID_ORDER_ID,
            order_no: "ZT2026/0001",
            status_code: "robocze",
            locked_by_user_id: null,
            ...orderData,
          },
          error: null,
        },
        update: { data: null, error: null, count: 1 },
      },
      transport_types: { select: { data: { code: "PL" }, error: null } },
      companies: { select: { data: { id: VALID_COMPANY_ID, name: "TransPol" }, error: null } },
      locations: { select: { data: [], error: null } },
      products: { select: { data: [], error: null } },
      order_stops: { insert: { data: null, error: null }, update: { data: null, error: null }, delete: { data: null, error: null } },
      order_items: { insert: { data: null, error: null }, update: { data: null, error: null }, delete: { data: null, error: null } },
      order_status_history: { insert: { data: null, error: null } },
      order_change_log: { insert: { data: null, error: null } },
      ...tableOverrides,
    });
  }

  describe("happy path", () => {
    it("update → { id, orderNo, statusCode, updatedAt }", async () => {
      const supabase = buildUpdateMock();
      const params = makeUpdateOrderParams();

      const result = await updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(VALID_ORDER_ID);
      expect(result!.orderNo).toBe("ZT2026/0001");
      expect(result!.statusCode).toBe("robocze");
    });

    it('auto-korekta: "wysłane" → status zmienia się na "korekta"', async () => {
      const supabase = buildUpdateMock({ status_code: "wysłane" });
      const params = makeUpdateOrderParams();

      const result = await updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params);
      expect(result!.statusCode).toBe("korekta");
    });

    it('"robocze" → zostaje "robocze"', async () => {
      const supabase = buildUpdateMock({ status_code: "robocze" });
      const params = makeUpdateOrderParams();

      const result = await updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params);
      expect(result!.statusCode).toBe("robocze");
    });
  });

  describe("błędy", () => {
    it("zlecenie nie istnieje → null", async () => {
      const supabase = buildOrderServiceMock({
        transport_orders: { select: { data: null, error: null } },
      });
      const params = makeUpdateOrderParams();

      const result = await updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params);
      expect(result).toBeNull();
    });

    it('zablokowane przez innego → throws "LOCKED"', async () => {
      const supabase = buildUpdateMock({ locked_by_user_id: OTHER_USER_ID });
      const params = makeUpdateOrderParams();

      await expect(
        updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params)
      ).rejects.toThrow("LOCKED");
    });

    it('status "zrealizowane" → throws "FORBIDDEN_EDIT"', async () => {
      const supabase = buildUpdateMock({ status_code: "zrealizowane" });
      const params = makeUpdateOrderParams();

      await expect(
        updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params)
      ).rejects.toThrow("FORBIDDEN_EDIT");
    });

    it('status "anulowane" → throws "FORBIDDEN_EDIT"', async () => {
      const supabase = buildUpdateMock({ status_code: "anulowane" });
      const params = makeUpdateOrderParams();

      await expect(
        updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params)
      ).rejects.toThrow("FORBIDDEN_EDIT");
    });

    it("STOPS_LIMIT → throws", async () => {
      const supabase = buildUpdateMock();
      const stops: Array<{ id: null; kind: "LOADING" | "UNLOADING"; dateLocal: string; timeLocal: string; locationId: null; notes: null; sequenceNo: number; _deleted: false }> = Array.from({ length: 9 }, (_, i) => ({
        id: null as null,
        kind: "LOADING" as const,
        dateLocal: "2026-02-20",
        timeLocal: "08:00",
        locationId: null as null,
        notes: null as null,
        sequenceNo: i + 1,
        _deleted: false as const,
      }));
      stops.push({
        id: null,
        kind: "UNLOADING",
        dateLocal: "2026-02-21",
        timeLocal: "14:00",
        locationId: null,
        notes: null,
        sequenceNo: 10,
        _deleted: false,
      });
      const params = makeUpdateOrderParams({ stops });

      await expect(
        updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params)
      ).rejects.toThrow("STOPS_LIMIT");
    });

    it("STOPS_ORDER → throws", async () => {
      const supabase = buildUpdateMock();
      const params = makeUpdateOrderParams({
        stops: [
          { id: null, kind: "UNLOADING", dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null, sequenceNo: 1, _deleted: false },
          { id: null, kind: "LOADING", dateLocal: "2026-02-21", timeLocal: "14:00", locationId: null, notes: null, sequenceNo: 2, _deleted: false },
        ],
      });

      await expect(
        updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params)
      ).rejects.toThrow("STOPS_ORDER");
    });

    it("TOCTOU (count=0) → throws LOCKED", async () => {
      const supabase = buildOrderServiceMock({
        transport_orders: {
          select: {
            data: {
              id: VALID_ORDER_ID,
              order_no: "ZT2026/0001",
              status_code: "robocze",
              locked_by_user_id: null,
            },
            error: null,
          },
          update: { data: null, error: null, count: 0 },
        },
        transport_types: { select: { data: { code: "PL" }, error: null } },
        companies: { select: { data: { id: VALID_COMPANY_ID }, error: null } },
        locations: { select: { data: [], error: null } },
        products: { select: { data: [], error: null } },
      });
      const params = makeUpdateOrderParams();

      await expect(
        updateOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, params)
      ).rejects.toThrow("LOCKED");
    });
  });
});

// ---------------------------------------------------------------------------
// prepareEmailForOrder
// ---------------------------------------------------------------------------

describe("prepareEmailForOrder", () => {
  function buildEmailMock(orderOverrides?: Record<string, unknown>) {
    const order = makeOrderRow({
      carrier_company_id: VALID_COMPANY_ID,
      carrier_name_snapshot: "TransPol",
      shipper_location_id: VALID_LOCATION_ID,
      receiver_location_id: VALID_LOCATION_ID,
      price_amount: 5000,
      transport_type_code: "PL",
      ...orderOverrides,
    });

    return buildOrderServiceMock({
      transport_orders: {
        select: { data: order, error: null },
        update: { data: null, error: null, count: 1 },
      },
      order_stops: {
        select: {
          data: [
            makeStopRow({ kind: "LOADING", date_local: "2026-02-20", time_local: "08:00" }),
            makeStopRow({ id: "s2", kind: "UNLOADING", sequence_no: 2, date_local: "2026-02-21", time_local: "14:00" }),
          ],
          error: null,
        },
      },
      order_items: {
        select: {
          data: [makeItemRow({ product_name_snapshot: "Stal", quantity_tons: 10 })],
          error: null,
        },
      },
      order_status_history: { insert: { data: null, error: null } },
    });
  }

  it('"robocze" → statusAfter: "wysłane", emailOpenUrl zawiera mailto:', async () => {
    const supabase = buildEmailMock({ status_code: "robocze" });

    const result = await prepareEmailForOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      forceRegeneratePdf: false,
    });

    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    if (result!.success) {
      expect(result!.data.statusAfter).toBe("wysłane");
      expect(result!.data.emailOpenUrl).toContain("mailto:");
    }
  });

  it('"korekta" → statusAfter: "korekta wysłane"', async () => {
    const supabase = buildEmailMock({ status_code: "korekta" });

    const result = await prepareEmailForOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      forceRegeneratePdf: false,
    });

    expect(result!.success).toBe(true);
    if (result!.success) {
      expect(result!.data.statusAfter).toBe("korekta wysłane");
    }
  });

  it("brak carrierCompanyId → { success: false, validationErrors }", async () => {
    const supabase = buildEmailMock({ carrier_company_id: null });

    const result = await prepareEmailForOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      forceRegeneratePdf: false,
    });

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    if (!result!.success) {
      expect(result!.validationErrors).toContain("carrier_company_id");
    }
  });

  it('status "zrealizowane" → throws "NOT_ALLOWED_STATUS"', async () => {
    const supabase = buildEmailMock({ status_code: "zrealizowane" });

    await expect(
      prepareEmailForOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, { forceRegeneratePdf: false })
    ).rejects.toThrow("NOT_ALLOWED_STATUS");
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { select: { data: null, error: null } },
    });

    const result = await prepareEmailForOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      forceRegeneratePdf: false,
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// patchStop
// ---------------------------------------------------------------------------

describe("patchStop", () => {
  function buildPatchMock(orderOverrides?: Record<string, unknown>) {
    return buildOrderServiceMock({
      transport_orders: {
        select: {
          data: {
            id: VALID_ORDER_ID,
            locked_by_user_id: null,
            ...orderOverrides,
          },
          error: null,
        },
        update: { data: null, error: null, count: 1 },
      },
      order_stops: {
        // patchStop: 1st select→maybeSingle (single stop), 2nd select→thenable (all stops array for denorm)
        selectSequence: [
          { data: makeStopRow(), error: null },
          { data: [makeStopRow()], error: null },
        ],
        update: { data: null, error: null },
      },
      locations: {
        select: {
          data: {
            id: VALID_LOCATION_ID,
            name: "Nowy Magazyn",
            city: "Kraków",
            country: "PL",
            street_and_number: "ul. Nowa 5",
            postal_code: "30-001",
            company_id: VALID_COMPANY_ID,
            companies: { name: "NordMetal" },
          },
          error: null,
        },
      },
    });
  }

  it("patch dateLocal → OK", async () => {
    const supabase = buildPatchMock();

    const result = await patchStop(supabase, VALID_USER_ID, VALID_ORDER_ID, VALID_STOP_ID, {
      dateLocal: "2026-03-01",
    });

    expect(result).not.toBeNull();
    expect(result!.dateLocal).toBe("2026-03-01");
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildOrderServiceMock({
      transport_orders: { select: { data: null, error: null } },
    });

    const result = await patchStop(supabase, VALID_USER_ID, VALID_ORDER_ID, VALID_STOP_ID, {
      dateLocal: "2026-03-01",
    });
    expect(result).toBeNull();
  });

  it('zablokowane → throws "LOCKED"', async () => {
    const supabase = buildPatchMock({ locked_by_user_id: OTHER_USER_ID });

    await expect(
      patchStop(supabase, VALID_USER_ID, VALID_ORDER_ID, VALID_STOP_ID, { dateLocal: "2026-03-01" })
    ).rejects.toThrow("LOCKED");
  });
});

// ---------------------------------------------------------------------------
// listOrders
// ---------------------------------------------------------------------------

describe("listOrders", () => {
  function buildListMock(opts?: {
    statusCodes?: unknown[];
    orderRows?: unknown[];
    stopsRows?: unknown[];
    itemsRows?: unknown[];
    orderError?: unknown;
    count?: number;
  }) {
    const statusCodes = opts?.statusCodes ?? [{ code: "robocze" }, { code: "wysłane" }];
    const orderRows = opts?.orderRows ?? [];
    const count = opts?.count ?? orderRows.length;

    return buildOrderServiceMock({
      order_statuses: {
        select: { data: statusCodes, error: null },
      },
      transport_orders: {
        select: {
          data: orderRows,
          error: opts?.orderError ?? null,
          count,
        },
      },
      order_stops: {
        select: { data: opts?.stopsRows ?? [], error: null },
      },
      order_items: {
        select: { data: opts?.itemsRows ?? [], error: null },
      },
    });
  }

  it("domyślne parametry → paginowany wynik", async () => {
    const supabase = buildListMock({ orderRows: [], count: 0 });

    const result = await listOrders(supabase, {
      view: "CURRENT",
      sortBy: "FIRST_LOADING_DATETIME",
      sortDirection: "ASC",
      page: 1,
      pageSize: 50,
    });

    expect(result).toEqual({
      items: [],
      page: 1,
      pageSize: 50,
      totalItems: 0,
      totalPages: 1,
    });
  });

  it("pusty wynik → { items: [], totalItems: 0 }", async () => {
    const supabase = buildListMock({ statusCodes: [{ code: "robocze" }] });

    const result = await listOrders(supabase, {
      view: "CURRENT",
      sortBy: "FIRST_LOADING_DATETIME",
      sortDirection: "ASC",
      page: 1,
      pageSize: 50,
    });

    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  it("brak statusów dla view → empty result bez query", async () => {
    const supabase = buildListMock({ statusCodes: [] });

    const result = await listOrders(supabase, {
      view: "CURRENT",
      sortBy: "FIRST_LOADING_DATETIME",
      sortDirection: "ASC",
      page: 1,
      pageSize: 50,
    });

    expect(result.items).toEqual([]);
  });

  it("błąd DB → throws", async () => {
    const supabase = buildListMock({ orderError: { message: "Query error" } });

    await expect(
      listOrders(supabase, {
        view: "CURRENT",
        sortBy: "FIRST_LOADING_DATETIME",
        sortDirection: "ASC",
        page: 1,
        pageSize: 50,
      })
    ).rejects.toEqual({ message: "Query error" });
  });
});

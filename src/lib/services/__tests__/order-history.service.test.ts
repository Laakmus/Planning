/**
 * Testy order-history.service.ts (getStatusHistory, getChangeLog).
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { getStatusHistory, getChangeLog } from "../order-history.service";
import { VALID_ORDER_ID, VALID_USER_ID } from "@/test/helpers/fixtures";

// ---------------------------------------------------------------------------
// Helpers — Supabase mock per-table
// ---------------------------------------------------------------------------

type Res = { data: unknown; error: unknown };

function buildMock(opts: {
  orderCheck: Res;
  historyRows?: Res;
}) {
  const historyRes = opts.historyRows ?? { data: [], error: null };

  // Budujemy chain per tabela
  function chainFor(res: Res) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.maybeSingle = vi.fn().mockResolvedValue(res);
    chain.single = vi.fn().mockResolvedValue(res);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    // Thenable — await query zwraca dane (dla history query bez maybeSingle)
    chain.then = vi.fn().mockImplementation((resolve: (v: Res) => void) =>
      Promise.resolve(res).then(resolve)
    );
    return chain;
  }

  // Tabela transport_orders → check istnienia
  const ordersChain = chainFor(opts.orderCheck);
  // Tabela order_status_history / order_change_log → lista wpisów
  const historyChain = chainFor(historyRes);

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "transport_orders") return ordersChain;
    return historyChain;
  });

  return { from: fromFn } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// getStatusHistory
// ---------------------------------------------------------------------------

describe("getStatusHistory", () => {
  it("zlecenie istnieje, 2 wpisy → zmapowane StatusHistoryItemDto[]", async () => {
    const supabase = buildMock({
      orderCheck: { data: { id: VALID_ORDER_ID }, error: null },
      historyRows: {
        data: [
          {
            id: 1,
            order_id: VALID_ORDER_ID,
            old_status_code: "robocze",
            new_status_code: "wysłane",
            changed_at: "2026-02-17T10:00:00Z",
            changed_by_user_id: VALID_USER_ID,
            changed_by_user: { full_name: "Jan Kowalski" },
          },
          {
            id: 2,
            order_id: VALID_ORDER_ID,
            old_status_code: "wysłane",
            new_status_code: "zrealizowane",
            changed_at: "2026-02-18T10:00:00Z",
            changed_by_user_id: VALID_USER_ID,
            changed_by_user: { full_name: "Jan Kowalski" },
          },
        ],
        error: null,
      },
    });

    const result = await getStatusHistory(supabase, VALID_ORDER_ID);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({
      id: 1,
      orderId: VALID_ORDER_ID,
      oldStatusCode: "robocze",
      newStatusCode: "wysłane",
      changedAt: "2026-02-17T10:00:00Z",
      changedByUserId: VALID_USER_ID,
      changedByUserName: "Jan Kowalski",
    });
  });

  it("zlecenie istnieje, 0 wpisów → []", async () => {
    const supabase = buildMock({
      orderCheck: { data: { id: VALID_ORDER_ID }, error: null },
      historyRows: { data: [], error: null },
    });

    const result = await getStatusHistory(supabase, VALID_ORDER_ID);
    expect(result).toEqual([]);
  });

  it("changedByUser null → changedByUserName: null", async () => {
    const supabase = buildMock({
      orderCheck: { data: { id: VALID_ORDER_ID }, error: null },
      historyRows: {
        data: [{
          id: 1,
          order_id: VALID_ORDER_ID,
          old_status_code: "robocze",
          new_status_code: "anulowane",
          changed_at: "2026-02-17T10:00:00Z",
          changed_by_user_id: VALID_USER_ID,
          changed_by_user: null,
        }],
        error: null,
      },
    });

    const result = await getStatusHistory(supabase, VALID_ORDER_ID);
    expect(result![0].changedByUserName).toBeNull();
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildMock({
      orderCheck: { data: null, error: null },
    });

    const result = await getStatusHistory(supabase, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it("błąd DB na check istnienia → throws", async () => {
    const supabase = buildMock({
      orderCheck: { data: null, error: { message: "DB error" } },
    });

    await expect(getStatusHistory(supabase, VALID_ORDER_ID)).rejects.toEqual({
      message: "DB error",
    });
  });
});

// ---------------------------------------------------------------------------
// getChangeLog
// ---------------------------------------------------------------------------

describe("getChangeLog", () => {
  it("zlecenie istnieje, wpisy → zmapowane ChangeLogItemDto[]", async () => {
    const supabase = buildMock({
      orderCheck: { data: { id: VALID_ORDER_ID }, error: null },
      historyRows: {
        data: [{
          id: 10,
          order_id: VALID_ORDER_ID,
          field_name: "status_code",
          old_value: "robocze",
          new_value: "wysłane",
          changed_at: "2026-02-17T10:00:00Z",
          changed_by_user_id: VALID_USER_ID,
          changed_by_user: { full_name: "Anna Nowak" },
        }],
        error: null,
      },
    });

    const result = await getChangeLog(supabase, VALID_ORDER_ID);
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({
      id: 10,
      orderId: VALID_ORDER_ID,
      fieldName: "status_code",
      oldValue: "robocze",
      newValue: "wysłane",
      changedAt: "2026-02-17T10:00:00Z",
      changedByUserId: VALID_USER_ID,
      changedByUserName: "Anna Nowak",
    });
  });

  it("pusty log → []", async () => {
    const supabase = buildMock({
      orderCheck: { data: { id: VALID_ORDER_ID }, error: null },
      historyRows: { data: [], error: null },
    });

    const result = await getChangeLog(supabase, VALID_ORDER_ID);
    expect(result).toEqual([]);
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildMock({
      orderCheck: { data: null, error: null },
    });

    const result = await getChangeLog(supabase, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it("błąd DB → throws", async () => {
    const supabase = buildMock({
      orderCheck: { data: { id: VALID_ORDER_ID }, error: null },
      historyRows: { data: null, error: { message: "Query failed" } },
    });

    await expect(getChangeLog(supabase, VALID_ORDER_ID)).rejects.toEqual({
      message: "Query failed",
    });
  });
});

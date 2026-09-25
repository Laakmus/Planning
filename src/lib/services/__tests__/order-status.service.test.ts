/**
 * Testy order-status.service.ts (cancelOrder, changeStatus, restoreOrder).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { cancelOrder, changeStatus, restoreOrder } from "../order-status.service";
import { VALID_ORDER_ID, VALID_USER_ID } from "@/test/helpers/fixtures";

// ---------------------------------------------------------------------------
// Helper — buduje mock Supabase z rozróżnieniem tabel
// ---------------------------------------------------------------------------

type Res = { data: unknown; error: unknown; count?: number | null };

function buildStatusMock(opts: {
  orderSelect?: Res;
  orderUpdate?: Res;
  historyInsert?: Res;
  changeLogInsert?: Res;
  historySelect?: Res; // dla restoreOrder (order_status_history query)
}) {
  const orderSelectRes = opts.orderSelect ?? { data: null, error: null };
  const orderUpdateRes = opts.orderUpdate ?? { data: { id: VALID_ORDER_ID }, error: null };
  const historyInsertRes = opts.historyInsert ?? { data: null, error: null };
  const changeLogInsertRes = opts.changeLogInsert ?? { data: null, error: null };
  const historySelectRes = opts.historySelect ?? { data: null, error: null };

  // Track insert calls per-table
  const insertTracker = {
    order_status_history: historyInsertRes,
    order_change_log: changeLogInsertRes,
  };

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "transport_orders") {
      // Chain obsługujący select i update
      const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
      updateChain.eq = vi.fn().mockReturnValue(updateChain);
      updateChain.select = vi.fn().mockReturnValue(updateChain);
      updateChain.maybeSingle = vi.fn().mockResolvedValue(orderUpdateRes);

      const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
      selectChain.eq = vi.fn().mockReturnValue(selectChain);
      selectChain.maybeSingle = vi.fn().mockResolvedValue(orderSelectRes);

      return {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }

    if (table === "order_status_history") {
      // Obsługa zarówno insert jak i select (dla restoreOrder)
      const historyChain: Record<string, ReturnType<typeof vi.fn>> = {};
      historyChain.eq = vi.fn().mockReturnValue(historyChain);
      historyChain.order = vi.fn().mockReturnValue(historyChain);
      historyChain.limit = vi.fn().mockReturnValue(historyChain);
      historyChain.maybeSingle = vi.fn().mockResolvedValue(historySelectRes);
      historyChain.select = vi.fn().mockReturnValue(historyChain);

      return {
        insert: vi.fn().mockResolvedValue(insertTracker.order_status_history),
        select: vi.fn().mockReturnValue(historyChain),
      };
    }

    if (table === "order_change_log") {
      return {
        insert: vi.fn().mockResolvedValue(insertTracker.order_change_log),
      };
    }

    // Domyślny
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  // Zapis statusu + historii + logu idzie jednym RPC (apply_order_changes).
  // orderUpdate.data === null symuluje równoległą zmianę statusu (CONFLICT).
  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    if (fnName !== "apply_order_changes") return Promise.resolve({ data: null, error: null });
    if (orderUpdateRes.error) return Promise.resolve({ data: null, error: orderUpdateRes.error });
    return Promise.resolve({
      data: orderUpdateRes.data ? { status: "OK", updated_at: "2026-03-07T12:00:00Z" } : { status: "CONFLICT" },
      error: null,
    });
  });

  return { from: fromFn, rpc: rpcFn } as unknown as SupabaseClient<Database>;
}

/** Argumenty wywołania RPC apply_order_changes. */
function applyArgs(supabase: SupabaseClient<Database>): Record<string, unknown> {
  const calls = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c: unknown[]) => c[0] === "apply_order_changes"
  );
  expect(calls).toHaveLength(1);
  return calls[0][1] as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// cancelOrder
// ---------------------------------------------------------------------------

describe("cancelOrder", () => {
  it('z "robocze" → { id, statusCode: "anulowane" }', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toEqual({ id: VALID_ORDER_ID, statusCode: "anulowane" });
  });

  it('z "wysłane" → OK', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "wysłane" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toEqual({ id: VALID_ORDER_ID, statusCode: "anulowane" });
  });

  it('z "reklamacja" → OK', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "reklamacja" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).not.toBeNull();
  });

  it("status + historia + log jednym RPC (guard statusu, bez wymogu blokady)", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
    });

    await cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);

    expect(applyArgs(supabase)).toMatchObject({
      p_order_id: VALID_ORDER_ID,
      p_expected_status: "robocze",
      p_order: { status_code: "anulowane" },
      p_status_history: { old_status_code: "robocze", new_status_code: "anulowane" },
      p_change_log: [{ field_name: "status_code", old_value: "robocze", new_value: "anulowane" }],
      p_ignore_lock: true,
    });
    // Brak bezpośrednich zapisów przez from() (updated_by_user_id ustawia RPC = auth.uid())
    const tables = (supabase.from as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).not.toContain("order_change_log");
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: null, error: null },
    });

    const result = await cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it('z "zrealizowane" → throws "FORBIDDEN_TRANSITION"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "zrealizowane" }, error: null },
    });

    await expect(cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "FORBIDDEN_TRANSITION"
    );
  });

  it('z "anulowane" → throws "FORBIDDEN_TRANSITION"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "anulowane" }, error: null },
    });

    await expect(cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "FORBIDDEN_TRANSITION"
    );
  });

  it('TOCTOU: UPDATE=null → throws "FORBIDDEN_TRANSITION"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
      orderUpdate: { data: null, error: null },
    });

    await expect(cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "FORBIDDEN_TRANSITION"
    );
  });

  it("błąd DB na SELECT → throws", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: null, error: { message: "DB error" } },
    });

    await expect(cancelOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toEqual({
      message: "DB error",
    });
  });
});

// ---------------------------------------------------------------------------
// changeStatus
// ---------------------------------------------------------------------------

describe("changeStatus", () => {
  it("robocze → zrealizowane → OK", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      newStatusCode: "zrealizowane",
    });
    expect(result).toEqual({
      id: VALID_ORDER_ID,
      oldStatusCode: "robocze",
      newStatusCode: "zrealizowane",
    });
  });

  it("wysłane → reklamacja + complaintReason → OK", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "wysłane" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      newStatusCode: "reklamacja",
      complaintReason: "Uszkodzenie towaru",
    });
    expect(result!.newStatusCode).toBe("reklamacja");
    expect(applyArgs(supabase).p_order).toEqual({
      status_code: "reklamacja",
      complaint_reason: "Uszkodzenie towaru",
    });
  });

  it("korekta → reklamacja → OK (H-04 fix)", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "korekta" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      newStatusCode: "reklamacja",
      complaintReason: "Brak dokumentów",
    });
    expect(result!.newStatusCode).toBe("reklamacja");
    expect(applyArgs(supabase).p_order).toEqual({
      status_code: "reklamacja",
      complaint_reason: "Brak dokumentów",
    });
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: null, error: null },
    });

    const result = await changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
      newStatusCode: "zrealizowane",
    });
    expect(result).toBeNull();
  });

  it('robocze → reklamacja → throws "FORBIDDEN_TRANSITION"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
    });

    await expect(
      changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
        newStatusCode: "reklamacja",
        complaintReason: "test",
      })
    ).rejects.toThrow("FORBIDDEN_TRANSITION");
  });

  it('anulowane → zrealizowane → throws "FORBIDDEN_TRANSITION"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "anulowane" }, error: null },
    });

    await expect(
      changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
        newStatusCode: "zrealizowane",
      })
    ).rejects.toThrow("FORBIDDEN_TRANSITION");
  });

  it("TOCTOU guard → throws", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
      orderUpdate: { data: null, error: null },
    });

    await expect(
      changeStatus(supabase, VALID_USER_ID, VALID_ORDER_ID, {
        newStatusCode: "zrealizowane",
      })
    ).rejects.toThrow("FORBIDDEN_TRANSITION");
  });
});

// ---------------------------------------------------------------------------
// restoreOrder
// ---------------------------------------------------------------------------

describe("restoreOrder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('z "zrealizowane" → { id, statusCode: "korekta" }', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "zrealizowane" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
    });

    const result = await restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toEqual({ id: VALID_ORDER_ID, statusCode: "korekta" });
  });

  it('z "anulowane" < 24h → OK', async () => {
    vi.setSystemTime(new Date("2026-02-18T12:00:00Z"));
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "anulowane" }, error: null },
      orderUpdate: { data: { id: VALID_ORDER_ID }, error: null },
      // Anulowane 2h temu (< 24h)
      historySelect: { data: { changed_at: "2026-02-18T10:00:00Z" }, error: null },
    });

    const result = await restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toEqual({ id: VALID_ORDER_ID, statusCode: "korekta" });
  });

  it('z "anulowane" > 24h → throws "GONE_24H"', async () => {
    vi.setSystemTime(new Date("2026-02-18T12:00:00Z"));
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "anulowane" }, error: null },
      // Anulowane 26h temu (> 24h)
      historySelect: { data: { changed_at: "2026-02-17T10:00:00Z" }, error: null },
    });

    await expect(restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "GONE_24H"
    );
  });

  it("status korekta + historia + log jednym RPC", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "zrealizowane" }, error: null },
    });

    await restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);

    expect(applyArgs(supabase)).toMatchObject({
      p_expected_status: "zrealizowane",
      p_order: { status_code: "korekta" },
      p_status_history: { old_status_code: "zrealizowane", new_status_code: "korekta" },
      p_ignore_lock: true,
    });
  });

  it('z "robocze" → throws "FORBIDDEN_RESTORE"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "robocze" }, error: null },
    });

    await expect(restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "FORBIDDEN_RESTORE"
    );
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: null, error: null },
    });

    const result = await restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it('TOCTOU: UPDATE=null → throws "FORBIDDEN_RESTORE"', async () => {
    const supabase = buildStatusMock({
      orderSelect: { data: { id: VALID_ORDER_ID, status_code: "zrealizowane" }, error: null },
      orderUpdate: { data: null, error: null },
    });

    await expect(restoreOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "FORBIDDEN_RESTORE"
    );
  });
});

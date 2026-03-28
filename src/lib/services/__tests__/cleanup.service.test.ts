/**
 * Testy cleanup.service.ts — czyszczenie anulowanych zleceń po 24h.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import {
  cleanupCancelledOrders,
  startCleanupScheduler,
  stopCleanupScheduler,
} from "../cleanup.service";
import { VALID_ORDER_ID } from "@/test/helpers/fixtures";

// Mock loggera pino — zastępuje console.log/error w cleanup.service
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Stałe testowe
// ---------------------------------------------------------------------------

const ORDER_ID_1 = "b0000000-0000-0000-0000-000000000010";
const ORDER_ID_2 = "b0000000-0000-0000-0000-000000000020";
const ORDER_ID_3 = "b0000000-0000-0000-0000-000000000030";

// ---------------------------------------------------------------------------
// Mock builder — buduje mocka Supabase z konfigurowalnymi odpowiedziami
// ---------------------------------------------------------------------------

interface MockOpts {
  /** Wynik zapytania do order_status_history (kandydaci do usunięcia) */
  historyResult?: { data: unknown; error: unknown };
  /** Wynik zapytania weryfikującego status zleceń */
  confirmResult?: { data: unknown; error: unknown };
  /** Wynik operacji delete */
  deleteResult?: { data: unknown; error: unknown };
}

function buildCleanupMock(opts: MockOpts) {
  // Chain dla order_status_history select
  const historyChain: Record<string, ReturnType<typeof vi.fn>> = {};
  historyChain.select = vi.fn().mockReturnValue(historyChain);
  historyChain.eq = vi.fn().mockReturnValue(historyChain);
  historyChain.lt = vi.fn().mockReturnValue(historyChain);
  historyChain.order = vi.fn().mockResolvedValue(
    opts.historyResult ?? { data: [], error: null }
  );

  // Chain dla transport_orders select (weryfikacja statusu)
  const confirmChain: Record<string, ReturnType<typeof vi.fn>> = {};
  confirmChain.select = vi.fn().mockReturnValue(confirmChain);
  confirmChain.in = vi.fn().mockReturnValue(confirmChain);
  confirmChain.eq = vi.fn().mockResolvedValue(
    opts.confirmResult ?? { data: [], error: null }
  );

  // Chain dla transport_orders delete
  const deleteChain: Record<string, ReturnType<typeof vi.fn>> = {};
  deleteChain.in = vi.fn().mockResolvedValue(
    opts.deleteResult ?? { data: null, error: null }
  );

  let fromCallCount = 0;
  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "order_status_history") {
      return { select: historyChain.select };
    }
    // transport_orders — pierwsze wywołanie = select (confirm), drugie = delete
    fromCallCount++;
    if (fromCallCount <= 1) {
      return { select: confirmChain.select };
    }
    return { delete: vi.fn().mockReturnValue(deleteChain) };
  });

  return {
    mock: { from: fromFn } as unknown as SupabaseClient<Database>,
    chains: { historyChain, confirmChain, deleteChain },
    fromFn,
  };
}

// ---------------------------------------------------------------------------
// cleanupCancelledOrders
// ---------------------------------------------------------------------------

describe("cleanupCancelledOrders", () => {
  it("brak kandydatów → deletedCount = 0", async () => {
    const { mock } = buildCleanupMock({
      historyResult: { data: [], error: null },
    });

    const result = await cleanupCancelledOrders(mock);

    expect(result.deletedCount).toBe(0);
    expect(result.deletedOrderIds).toEqual([]);
  });

  it("null data z historii → deletedCount = 0", async () => {
    const { mock } = buildCleanupMock({
      historyResult: { data: null, error: null },
    });

    const result = await cleanupCancelledOrders(mock);

    expect(result.deletedCount).toBe(0);
    expect(result.deletedOrderIds).toEqual([]);
  });

  it("błąd zapytania do historii → throws", async () => {
    const { mock } = buildCleanupMock({
      historyResult: { data: null, error: { message: "DB error" } },
    });

    await expect(cleanupCancelledOrders(mock)).rejects.toThrow(
      "Błąd pobierania historii statusów: DB error"
    );
  });

  it("kandydaci istnieją, ale żaden nie ma już statusu 'anulowane' → deletedCount = 0", async () => {
    const { mock } = buildCleanupMock({
      historyResult: {
        data: [
          { order_id: ORDER_ID_1, changed_at: "2026-03-17T08:00:00Z" },
        ],
        error: null,
      },
      confirmResult: { data: [], error: null },
    });

    const result = await cleanupCancelledOrders(mock);

    expect(result.deletedCount).toBe(0);
    expect(result.deletedOrderIds).toEqual([]);
  });

  it("błąd weryfikacji statusu → throws", async () => {
    const { mock } = buildCleanupMock({
      historyResult: {
        data: [
          { order_id: ORDER_ID_1, changed_at: "2026-03-17T08:00:00Z" },
        ],
        error: null,
      },
      confirmResult: { data: null, error: { message: "Confirm error" } },
    });

    await expect(cleanupCancelledOrders(mock)).rejects.toThrow(
      "Błąd weryfikacji statusu zleceń: Confirm error"
    );
  });

  it("2 zlecenia do usunięcia → deletedCount = 2", async () => {
    const { mock } = buildCleanupMock({
      historyResult: {
        data: [
          { order_id: ORDER_ID_1, changed_at: "2026-03-17T08:00:00Z" },
          { order_id: ORDER_ID_2, changed_at: "2026-03-17T09:00:00Z" },
        ],
        error: null,
      },
      confirmResult: {
        data: [{ id: ORDER_ID_1 }, { id: ORDER_ID_2 }],
        error: null,
      },
      deleteResult: { data: null, error: null },
    });

    const result = await cleanupCancelledOrders(mock);

    expect(result.deletedCount).toBe(2);
    expect(result.deletedOrderIds).toEqual([ORDER_ID_1, ORDER_ID_2]);
  });

  it("duplikaty order_id w historii → deduplikacja", async () => {
    const { mock } = buildCleanupMock({
      historyResult: {
        data: [
          { order_id: ORDER_ID_1, changed_at: "2026-03-17T08:00:00Z" },
          { order_id: ORDER_ID_1, changed_at: "2026-03-17T07:00:00Z" },
          { order_id: ORDER_ID_2, changed_at: "2026-03-17T09:00:00Z" },
        ],
        error: null,
      },
      confirmResult: {
        data: [{ id: ORDER_ID_1 }, { id: ORDER_ID_2 }],
        error: null,
      },
      deleteResult: { data: null, error: null },
    });

    const result = await cleanupCancelledOrders(mock);

    expect(result.deletedCount).toBe(2);
    expect(result.deletedOrderIds).toContain(ORDER_ID_1);
    expect(result.deletedOrderIds).toContain(ORDER_ID_2);
  });

  it("błąd usuwania → throws", async () => {
    const { mock } = buildCleanupMock({
      historyResult: {
        data: [
          { order_id: ORDER_ID_1, changed_at: "2026-03-17T08:00:00Z" },
        ],
        error: null,
      },
      confirmResult: {
        data: [{ id: ORDER_ID_1 }],
        error: null,
      },
      deleteResult: { data: null, error: { message: "Delete failed" } },
    });

    await expect(cleanupCancelledOrders(mock)).rejects.toThrow(
      "Błąd usuwania zleceń: Delete failed"
    );
  });

  it("custom retentionMs jest przekazywany do cutoff date", async () => {
    // Z retentionMs = 0 — każde anulowane zlecenie kwalifikuje się
    const { mock, chains } = buildCleanupMock({
      historyResult: {
        data: [
          { order_id: ORDER_ID_1, changed_at: new Date().toISOString() },
        ],
        error: null,
      },
      confirmResult: {
        data: [{ id: ORDER_ID_1 }],
        error: null,
      },
      deleteResult: { data: null, error: null },
    });

    // retentionMs = 0 → cutoff = teraz → lt(changed_at, now) powinno złapać
    const result = await cleanupCancelledOrders(mock, 0);

    expect(result.deletedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// startCleanupScheduler / stopCleanupScheduler
// ---------------------------------------------------------------------------

describe("startCleanupScheduler / stopCleanupScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Upewnij się, że scheduler jest zatrzymany
    stopCleanupScheduler();
  });

  afterEach(() => {
    stopCleanupScheduler();
    vi.useRealTimers();
  });

  it("startCleanupScheduler nie rzuca błędów", () => {
    // Scheduler startuje ale nie uruchamia natychmiast cleanup
    // (pierwsze uruchomienie po 60s)
    expect(() => startCleanupScheduler()).not.toThrow();
  });

  it("drugie wywołanie startCleanupScheduler nie tworzy duplikatu", () => {
    startCleanupScheduler();
    startCleanupScheduler(); // drugie — powinno logować warning

    // logger.warn powinien być wywołany z komunikatem o duplikacie
    const warnMock = vi.mocked(logger.warn);
    const lastCall = warnMock.mock.calls[warnMock.mock.calls.length - 1];
    expect(lastCall?.[1]).toContain("duplikat");
  });

  it("stopCleanupScheduler zatrzymuje interwał", () => {
    startCleanupScheduler();
    // Nie powinno rzucać
    expect(() => stopCleanupScheduler()).not.toThrow();
    // Kolejne stop — też OK (idempotentne)
    expect(() => stopCleanupScheduler()).not.toThrow();
  });
});

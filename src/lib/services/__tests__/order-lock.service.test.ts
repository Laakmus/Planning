/**
 * Testy order-lock.service.ts (lockOrder, unlockOrder, cleanupExpiredLocks).
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { lockOrder, unlockOrder, cleanupExpiredLocks } from "../order-lock.service";
import { VALID_ORDER_ID, VALID_USER_ID, ADMIN_USER_ID, OTHER_USER_ID } from "@/test/helpers/fixtures";

// ---------------------------------------------------------------------------
// Helper — mock builder
// ---------------------------------------------------------------------------

type Res = { data: unknown; error: unknown; count?: number | null };

function buildLockMock(opts: {
  rpcResult?: Res;
  orderSelect?: Res;
  updateResult?: Res;
}) {
  const rpcFn = vi.fn().mockResolvedValue(
    opts.rpcResult ?? { data: null, error: null }
  );

  // Chain dla from()
  const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
  updateChain.eq = vi.fn().mockReturnValue(updateChain);
  updateChain.not = vi.fn().mockReturnValue(updateChain);
  updateChain.lt = vi.fn().mockReturnValue(updateChain);
  updateChain.select = vi.fn().mockReturnValue(updateChain);
  updateChain.then = vi.fn().mockImplementation((resolve: (v: Res) => void) =>
    Promise.resolve(opts.updateResult ?? { data: [], error: null }).then(resolve)
  );

  const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
  selectChain.eq = vi.fn().mockReturnValue(selectChain);
  selectChain.maybeSingle = vi.fn().mockResolvedValue(
    opts.orderSelect ?? { data: null, error: null }
  );
  selectChain.select = vi.fn().mockReturnValue(selectChain);

  const fromFn = vi.fn().mockImplementation(() => {
    return {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    };
  });

  return {
    from: fromFn,
    rpc: rpcFn,
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// lockOrder
// ---------------------------------------------------------------------------

describe("lockOrder", () => {
  it('RPC "OK" → LockOrderResponseDto', async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "robocze" }, error: null },
      rpcResult: {
        data: {
          status: "OK",
          lockedByUserId: VALID_USER_ID,
          lockedAt: "2026-02-17T10:00:00Z",
        },
        error: null,
      },
    });

    const result = await lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toEqual({
      id: VALID_ORDER_ID,
      lockedByUserId: VALID_USER_ID,
      lockedAt: "2026-02-17T10:00:00Z",
    });
  });

  it('RPC "NOT_FOUND" → null', async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "robocze" }, error: null },
      rpcResult: { data: { status: "NOT_FOUND" }, error: null },
    });

    const result = await lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it('RPC "CONFLICT" → throws "LOCK_CONFLICT" z lockedByUserName', async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "robocze" }, error: null },
      rpcResult: {
        data: {
          status: "CONFLICT",
          lockedByUserName: "Anna Nowak",
        },
        error: null,
      },
    });

    await expect(lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow("LOCK_CONFLICT");

    try {
      await lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    } catch (err) {
      expect((err as Error & { lockedByUserName?: string }).lockedByUserName).toBe("Anna Nowak");
    }
  });

  it("RPC null → throws", async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "robocze" }, error: null },
      rpcResult: { data: null, error: null },
    });

    await expect(lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "Unexpected null"
    );
  });

  it("RPC error → throws", async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "robocze" }, error: null },
      rpcResult: { data: null, error: { message: "RPC error" } },
    });

    await expect(lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toEqual({
      message: "RPC error",
    });
  });

  it('status "anulowane" → throws "LOCK_TERMINAL_STATUS"', async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "anulowane" }, error: null },
    });

    await expect(lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "LOCK_TERMINAL_STATUS"
    );
  });

  it('status "zrealizowane" → throws "LOCK_TERMINAL_STATUS"', async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "zrealizowane" }, error: null },
    });

    await expect(lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID)).rejects.toThrow(
      "LOCK_TERMINAL_STATUS"
    );
  });

  it("order not found (status select returns null) → null", async () => {
    const supabase = buildLockMock({
      orderSelect: { data: null, error: null },
    });

    const result = await lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);
    expect(result).toBeNull();
  });

  it("sprawdź p_lock_expiry_minutes = 15", async () => {
    const supabase = buildLockMock({
      orderSelect: { data: { status_code: "robocze" }, error: null },
      rpcResult: { data: { status: "OK" }, error: null },
    });

    await lockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID);

    expect(supabase.rpc).toHaveBeenCalledWith("try_lock_order", {
      p_order_id: VALID_ORDER_ID,
      p_user_id: VALID_USER_ID,
      p_lock_expiry_minutes: 15,
    });
  });
});

// ---------------------------------------------------------------------------
// unlockOrder
// ---------------------------------------------------------------------------

describe("unlockOrder", () => {
  it("właściciel blokady → OK", async () => {
    const supabase = buildLockMock({
      orderSelect: {
        data: { id: VALID_ORDER_ID, locked_by_user_id: VALID_USER_ID },
        error: null,
      },
      updateResult: { data: null, error: null },
    });

    const result = await unlockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, false);
    expect(result).toEqual({
      id: VALID_ORDER_ID,
      lockedByUserId: null,
      lockedAt: null,
    });
  });

  it("ADMIN odblokowuje cudzą → OK", async () => {
    const supabase = buildLockMock({
      orderSelect: {
        data: { id: VALID_ORDER_ID, locked_by_user_id: OTHER_USER_ID },
        error: null,
      },
      updateResult: { data: null, error: null },
    });

    const result = await unlockOrder(supabase, ADMIN_USER_ID, VALID_ORDER_ID, true);
    expect(result).not.toBeNull();
  });

  it('nie-ADMIN cudzą blokadę → throws "FORBIDDEN_UNLOCK"', async () => {
    const supabase = buildLockMock({
      orderSelect: {
        data: { id: VALID_ORDER_ID, locked_by_user_id: OTHER_USER_ID },
        error: null,
      },
    });

    await expect(
      unlockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, false)
    ).rejects.toThrow("FORBIDDEN_UNLOCK");
  });

  it("zlecenie nie istnieje → null", async () => {
    const supabase = buildLockMock({
      orderSelect: { data: null, error: null },
    });

    const result = await unlockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, false);
    expect(result).toBeNull();
  });

  it("zlecenie bez blokady (locked_by_user_id: null) → OK", async () => {
    const supabase = buildLockMock({
      orderSelect: {
        data: { id: VALID_ORDER_ID, locked_by_user_id: null },
        error: null,
      },
      updateResult: { data: null, error: null },
    });

    const result = await unlockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, false);
    expect(result).toEqual({
      id: VALID_ORDER_ID,
      lockedByUserId: null,
      lockedAt: null,
    });
  });

  it("błąd DB → throws", async () => {
    const supabase = buildLockMock({
      orderSelect: { data: null, error: { message: "Fetch error" } },
    });

    await expect(
      unlockOrder(supabase, VALID_USER_ID, VALID_ORDER_ID, false)
    ).rejects.toEqual({ message: "Fetch error" });
  });
});

// ---------------------------------------------------------------------------
// cleanupExpiredLocks
// ---------------------------------------------------------------------------

describe("cleanupExpiredLocks", () => {
  it("3 wygasłe → zwraca 3", async () => {
    const supabase = buildLockMock({
      updateResult: {
        data: [{ id: "a" }, { id: "b" }, { id: "c" }],
        error: null,
      },
    });

    const result = await cleanupExpiredLocks(supabase);
    expect(result).toBe(3);
  });

  it("0 wygasłych → 0", async () => {
    const supabase = buildLockMock({
      updateResult: { data: [], error: null },
    });

    const result = await cleanupExpiredLocks(supabase);
    expect(result).toBe(0);
  });

  it("błąd DB → throws", async () => {
    const supabase = buildLockMock({
      updateResult: { data: null, error: { message: "Update failed" } },
    });

    await expect(cleanupExpiredLocks(supabase)).rejects.toEqual({
      message: "Update failed",
    });
  });
});

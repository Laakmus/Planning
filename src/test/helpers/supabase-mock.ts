/**
 * Generyczny builder mocków Supabase do testów serwisów.
 *
 * Tworzy minimalny obiekt SupabaseClient z chainable mock methods,
 * rozróżniający wywołania per-tabela (from("transport_orders") vs from("order_stops")).
 */

import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

// ---------------------------------------------------------------------------
// Typy konfiguracyjne
// ---------------------------------------------------------------------------

/** Wynik terminalu chain (data + error). */
export interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

/** Konfiguracja jednej tabeli — terminale chain (select/insert/update/delete). */
export interface TableConfig {
  /** Domyślny wynik dla SELECT (.select().eq()...maybeSingle()/single()) */
  select?: QueryResult;
  /** Wynik dla INSERT (.insert().select().single()) */
  insert?: QueryResult;
  /** Wynik dla UPDATE (.update().eq()...) */
  update?: QueryResult;
  /** Wynik dla DELETE (.delete().eq()...) */
  delete?: QueryResult;
  /** Sekwencja wyników SELECT (mockReturnValueOnce) */
  selectSequence?: QueryResult[];
}

export type MockConfig = Record<string, TableConfig>;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Buduje chainable mock chain dla jednej tabeli.
 * Wszystkie metody chain (eq, ilike, in, order, limit, range, not, lt, or, gte, lte, select)
 * zwracają ten sam obiekt (this pattern).
 */
function buildChain(config: TableConfig) {
  const selectResult = config.select ?? { data: null, error: null };
  const insertResult = config.insert ?? { data: null, error: null };
  const updateResult = config.update ?? { data: null, error: null, count: null };
  const deleteResult = config.delete ?? { data: null, error: null };

  let selectCallIndex = 0;
  const selectSequence = config.selectSequence;

  function getSelectResult(): QueryResult {
    if (selectSequence && selectCallIndex < selectSequence.length) {
      return selectSequence[selectCallIndex++];
    }
    return selectResult;
  }

  // Proxy obiekt — każda metoda chain zwraca siebie
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // Metody terminalne
  chain.maybeSingle = vi.fn().mockImplementation(() => {
    const r = getSelectResult();
    return Promise.resolve(r);
  });
  chain.single = vi.fn().mockImplementation(() => {
    const r = getSelectResult();
    return Promise.resolve(r);
  });

  // Metody chain — zwracają chain
  const chainMethods = [
    "eq", "neq", "ilike", "like", "in", "order", "limit", "range",
    "not", "lt", "gt", "gte", "lte", "or", "is", "contains",
    "filter", "match", "textSearch",
  ];
  for (const method of chainMethods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // select() — chainable, ale też terminal gdy wywoływane bezpośrednio z then
  chain.select = vi.fn().mockImplementation((_columns?: string, _opts?: unknown) => {
    // Zwracamy chain z thenable — dzięki temu await query działa z count
    const result = {
      ...chain,
      then: (resolve: (v: QueryResult) => void) => {
        const r = getSelectResult();
        return Promise.resolve(r).then(resolve);
      },
    };
    // Nadpisujemy chain.single/maybeSingle żeby brały aktualny result
    return result;
  });

  // insert() — zwraca chain (z .select().single() po)
  chain.insert = vi.fn().mockImplementation(() => {
    // Po insert będą chainowane select/single — zwrócimy insertResult
    const insertChain: Record<string, ReturnType<typeof vi.fn>> = {};
    insertChain.select = vi.fn().mockReturnValue(insertChain);
    insertChain.single = vi.fn().mockResolvedValue(insertResult);
    insertChain.maybeSingle = vi.fn().mockResolvedValue(insertResult);

    // Ale insert bez .select() ma then (dla { error })
    insertChain.then = vi.fn().mockImplementation((resolve: (v: QueryResult) => void) => {
      return Promise.resolve(insertResult).then(resolve);
    });

    return insertChain;
  });

  // update() — zwraca chain z eq, or, select, count
  chain.update = vi.fn().mockImplementation(() => {
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
    const updateChainMethods = ["eq", "or", "not", "in", "neq", "is"];
    for (const m of updateChainMethods) {
      updateChain[m] = vi.fn().mockReturnValue(updateChain);
    }
    updateChain.select = vi.fn().mockReturnValue(updateChain);
    updateChain.single = vi.fn().mockResolvedValue(updateResult);
    updateChain.maybeSingle = vi.fn().mockResolvedValue(updateResult);

    updateChain.then = vi.fn().mockImplementation((resolve: (v: QueryResult) => void) => {
      return Promise.resolve(updateResult).then(resolve);
    });

    return updateChain;
  });

  // delete() — zwraca chain z eq
  chain.delete = vi.fn().mockImplementation(() => {
    const deleteChain: Record<string, ReturnType<typeof vi.fn>> = {};
    deleteChain.eq = vi.fn().mockReturnValue(deleteChain);
    deleteChain.in = vi.fn().mockReturnValue(deleteChain);
    deleteChain.then = vi.fn().mockImplementation((resolve: (v: QueryResult) => void) => {
      return Promise.resolve(deleteResult).then(resolve);
    });
    return deleteChain;
  });

  return chain;
}

/**
 * Tworzy mock SupabaseClient z rozróżnieniem tabel.
 *
 * @param config — konfiguracja per tabela (klucz = nazwa tabeli)
 * @param rpcResults — opcjonalny mock RPC (klucz = nazwa funkcji, wartość = { data, error })
 */
export function createSupabaseMock(
  config: MockConfig = {},
  rpcResults?: Record<string, QueryResult>
): SupabaseClient<Database> {
  const chains = new Map<string, ReturnType<typeof buildChain>>();

  // Pre-build chains dla skonfigurowanych tabel
  for (const [table, tableConfig] of Object.entries(config)) {
    chains.set(table, buildChain(tableConfig));
  }

  // Domyślny chain dla nieskonfigurowanych tabel
  const defaultChain = buildChain({});

  const fromFn = vi.fn().mockImplementation((table: string) => {
    return chains.get(table) ?? defaultChain;
  });

  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    const result = rpcResults?.[fnName] ?? { data: null, error: null };
    return Promise.resolve(result);
  });

  return {
    from: fromFn,
    rpc: rpcFn,
  } as unknown as SupabaseClient<Database>;
}

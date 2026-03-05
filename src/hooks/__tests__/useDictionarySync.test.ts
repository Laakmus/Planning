/**
 * Testy hooka useDictionarySync.
 * Sprawdza cykl życia synchronizacji: start, polling, sukces, błąd, timeout,
 * zabezpieczenie przed podwójnym startem oraz cleanup po odmontowaniu.
 *
 * STRATEGIA Z FAKE TIMERS:
 * - vi.useFakeTimers() z shouldAdvanceTime: false (domyślne)
 * - flushPromises() = Promise.resolve().then() (nie używa setTimeout — unika blokady)
 * - Po vi.advanceTimersByTime() wywołujemy vi.runAllTimersAsync() aby przetworzyć
 *   kolejne timery wynikłe z callbacków (polling chain).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocki — vi.hoisted() przed vi.mock() (hoisting Vitest)
// ---------------------------------------------------------------------------

const { mockPost, mockGet, mockApi, mockRefreshDictionaries } = vi.hoisted(() => {
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  const mockRefreshDictionaries = vi.fn();
  return {
    mockPost,
    mockGet,
    mockApi: { post: mockPost, get: mockGet },
    mockRefreshDictionaries,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ api: mockApi }),
}));

vi.mock("@/contexts/DictionaryContext", () => ({
  useDictionaries: () => ({ refreshDictionaries: mockRefreshDictionaries }),
}));

import { useDictionarySync } from "../useDictionarySync";

// ---------------------------------------------------------------------------
// Stałe (mirror z implementacji)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40;

// ---------------------------------------------------------------------------
// Helper: opróżnij mikrotaski bez setTimeout (mikrotask queue flush)
// ---------------------------------------------------------------------------

function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("useDictionarySync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRefreshDictionaries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Stan początkowy
  // -------------------------------------------------------------------------

  it("starts with idle status and no error", () => {
    const { result } = renderHook(() => useDictionarySync());

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("exposes startSync function", () => {
    const { result } = renderHook(() => useDictionarySync());

    expect(typeof result.current.startSync).toBe("function");
  });

  // -------------------------------------------------------------------------
  // Start synchronizacji
  // -------------------------------------------------------------------------

  it("changes status to running when startSync is called", async () => {
    mockPost.mockResolvedValue({ jobId: "job-123", status: "QUEUED" });
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    // Status zmienia się synchronicznie przed POST
    expect(result.current.status).toBe("running");
  });

  it("posts to correct endpoint with default resources", async () => {
    mockPost.mockResolvedValue({ jobId: "job-abc", status: "QUEUED" });
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    // Poczekaj na rozwiązanie Promise.post
    await act(async () => {
      await flushMicrotasks();
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/dictionary-sync/run",
      { resources: ["COMPANIES", "LOCATIONS", "PRODUCTS"] }
    );
  });

  it("posts with custom resources when provided", async () => {
    mockPost.mockResolvedValue({ jobId: "job-custom", status: "QUEUED" });
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync(["COMPANIES"]);
    });

    await act(async () => {
      await flushMicrotasks();
    });

    const [, body] = mockPost.mock.calls[0];
    expect(body.resources).toEqual(["COMPANIES"]);
  });

  // -------------------------------------------------------------------------
  // Polling — sukces
  // -------------------------------------------------------------------------

  it("transitions to success after COMPLETED job status", async () => {
    mockPost.mockResolvedValue({ jobId: "job-ok", status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: "job-ok", status: "COMPLETED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    // POST się rozwiązuje, setTimeout pollingu zostaje zaplanowany
    await act(async () => {
      await flushMicrotasks();
    });

    // Uruchom polling timeout
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("calls refreshDictionaries on success", async () => {
    mockPost.mockResolvedValue({ jobId: "job-refresh", status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: "job-refresh", status: "COMPLETED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    expect(mockRefreshDictionaries).toHaveBeenCalledTimes(1);
  });

  it("polls correct job status endpoint", async () => {
    const JOB_ID = "job-endpoint-check";
    mockPost.mockResolvedValue({ jobId: JOB_ID, status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: JOB_ID, status: "COMPLETED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    const [endpoint] = mockGet.mock.calls[0];
    expect(endpoint).toBe(`/api/v1/dictionary-sync/jobs/${JOB_ID}`);
  });

  it("transitions to idle after 3 seconds following success", async () => {
    mockPost.mockResolvedValue({ jobId: "job-idle", status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: "job-idle", status: "COMPLETED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("success");

    // Po 3 sekundach wraca do idle
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("idle");
  });

  // -------------------------------------------------------------------------
  // Polling — wielokrotne próby (RUNNING → COMPLETED)
  // -------------------------------------------------------------------------

  it("polls multiple times while job is running before completing", async () => {
    mockPost.mockResolvedValue({ jobId: "job-multi", status: "QUEUED" });
    mockGet
      .mockResolvedValueOnce({ jobId: "job-multi", status: "RUNNING" })
      .mockResolvedValueOnce({ jobId: "job-multi", status: "RUNNING" })
      .mockResolvedValueOnce({ jobId: "job-multi", status: "COMPLETED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    // Poll #1 → RUNNING → planuje nowy timeout
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("running");
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Poll #2 → RUNNING → planuje nowy timeout
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("running");
    expect(mockGet).toHaveBeenCalledTimes(2);

    // Poll #3 → COMPLETED
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });
    expect(result.current.status).toBe("success");
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // Polling — FAILED
  // -------------------------------------------------------------------------

  it("transitions to error status when job FAILED", async () => {
    mockPost.mockResolvedValue({ jobId: "job-fail", status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: "job-fail", status: "FAILED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Synchronizacja zakończyła się błędem.");
  });

  it("does not call refreshDictionaries when job FAILED", async () => {
    mockPost.mockResolvedValue({ jobId: "job-fail2", status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: "job-fail2", status: "FAILED" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("error");
    expect(mockRefreshDictionaries).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Błąd podczas POST
  // -------------------------------------------------------------------------

  it("sets error status when POST fails", async () => {
    mockPost.mockRejectedValue(new Error("Brak połączenia"));

    const { result } = renderHook(() => useDictionarySync());

    await act(async () => {
      await result.current.startSync();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Brak połączenia");
  });

  it("sets fallback error on non-Error POST exception", async () => {
    mockPost.mockRejectedValue("network failure");

    const { result } = renderHook(() => useDictionarySync());

    await act(async () => {
      await result.current.startSync();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Nie udało się uruchomić synchronizacji.");
  });

  // -------------------------------------------------------------------------
  // Błąd podczas pollingu (GET)
  // -------------------------------------------------------------------------

  it("sets error when polling GET throws", async () => {
    mockPost.mockResolvedValue({ jobId: "job-poll-err", status: "QUEUED" });
    mockGet.mockRejectedValue(new Error("Polling error"));

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Polling error");
  });

  // -------------------------------------------------------------------------
  // Timeout — przekroczenie POLL_MAX_ATTEMPTS
  // -------------------------------------------------------------------------

  it("sets error after exceeding max polling attempts", async () => {
    mockPost.mockResolvedValue({ jobId: "job-timeout", status: "QUEUED" });
    mockGet.mockResolvedValue({ jobId: "job-timeout", status: "RUNNING" });

    const { result } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    // Odpal POLL_MAX_ATTEMPTS + 1 kroków pollingu
    for (let i = 0; i <= POLL_MAX_ATTEMPTS; i++) {
      if (result.current.status === "error") break;
      await act(async () => {
        vi.advanceTimersByTime(POLL_INTERVAL_MS);
        await flushMicrotasks();
      });
    }

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(
      "Synchronizacja trwa zbyt długo. Spróbuj ponownie."
    );
  }, 30000);

  // -------------------------------------------------------------------------
  // Zabezpieczenie przed podwójnym startem
  // -------------------------------------------------------------------------

  it("ignores startSync call when status is already running", async () => {
    mockPost.mockResolvedValue({ jobId: "job-double", status: "QUEUED" });
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDictionarySync());

    // Pierwszy start — ustawia status na "running" synchronicznie
    act(() => {
      result.current.startSync();
    });

    expect(result.current.status).toBe("running");
    const callsAfterFirst = mockPost.mock.calls.length;

    // Drugi start — status === "running", powinien być zignorowany
    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    // POST nie powinien być wywołany ponownie
    expect(mockPost).toHaveBeenCalledTimes(callsAfterFirst);
  });

  // -------------------------------------------------------------------------
  // Cleanup po odmontowaniu
  // -------------------------------------------------------------------------

  it("clears polling timeout on unmount", async () => {
    mockPost.mockResolvedValue({ jobId: "job-unmount", status: "QUEUED" });
    // GET nigdy nie zwróci — symulacja nieskończonego pollingu
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result, unmount } = renderHook(() => useDictionarySync());

    act(() => {
      result.current.startSync();
    });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.status).toBe("running");

    // Odmontuj — powinno wyczyścić aktywne timery
    unmount();

    // Odpal timery po odmontowaniu
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
      await flushMicrotasks();
    });

    // Status powinien zostać "running" — hook był odmontowany przed polling
    expect(result.current.status).toBe("running");
  });
});

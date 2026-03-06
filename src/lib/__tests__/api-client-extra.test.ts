/**
 * Dodatkowe testy dla createApiClient (src/lib/api-client.ts).
 *
 * Pokrywa:
 * - postRaw ustawia Accept: dowolny typ (raw mode)
 * - postRaw zwraca surowy Response (nie parsuje JSON)
 * - AbortController przerywa request po timeout
 * - Normalne requesty (get, post) używają Accept: application/json
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiClient, ApiError } from "../api-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tworzy minimalne Response-like dla fetchMock. */
function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  const isOk = ok ?? (status >= 200 && status < 300);
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  // Parsujemy JSON tylko gdy body jest obiektem (nie stringiem)
  const jsonValue = typeof body === "object" && body !== null ? body : {};
  return {
    status,
    ok: isOk,
    statusText: status >= 400 ? "Error" : "OK",
    text: vi.fn().mockResolvedValue(bodyStr),
    json: vi.fn().mockResolvedValue(jsonValue),
    headers: new Headers({ "content-type": "application/pdf" }),
    blob: vi.fn().mockResolvedValue(new Blob(["fake-pdf"], { type: "application/pdf" })),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup — window.location + fetchMock
// ---------------------------------------------------------------------------

const _locDescriptor = Object.getOwnPropertyDescriptor(window, "location");
if (!_locDescriptor || _locDescriptor.configurable) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { origin: "http://localhost:4321", href: "/" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Zapobiegaj prawdziwym timeoutom — przyspieszamy setTimeout
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Testy postRaw
// ---------------------------------------------------------------------------

describe("postRaw — nagłówek Accept i surowy Response", () => {
  it("ustawia Accept: */* (tryb raw)", async () => {
    // postRaw używa raw: true → Accept: */* (patrz: api-client.ts linia 90)
    const fakeResp = makeResponse(200, "pdf-bytes");
    fetchMock.mockResolvedValue(fakeResp);

    const api = createApiClient({
      getToken: () => "token-123",
      onUnauthorized: vi.fn(),
    });

    // Musimy odpalić obietnicę i przesunąć timery (AbortController timeout)
    const promise = api.postRaw("/api/v1/orders/123/pdf", { format: "A4" });
    vi.advanceTimersByTime(0);
    await promise;

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Accept"]).toBe("*/*");
  });

  it("zwraca surowy Response (nie parsuje JSON)", async () => {
    const fakeResp = makeResponse(200, "raw-body");
    fetchMock.mockResolvedValue(fakeResp);

    const api = createApiClient({
      getToken: () => "token",
      onUnauthorized: vi.fn(),
    });

    const promise = api.postRaw("/api/v1/orders/123/pdf");
    vi.advanceTimersByTime(0);
    const result = await promise;

    // Powinien zwrócić ten sam obiekt Response — nie sparsowany JSON
    expect(result).toBe(fakeResp);
    // text() NIE powinien być wywoływany (w trybie raw nie parsujemy ciała)
    expect(fakeResp.text).not.toHaveBeenCalled();
  });

  it("rzuca ApiError gdy postRaw dostaje status 500", async () => {
    const errorResp = makeResponse(500, {
      error: "InternalError",
      message: "PDF generation failed",
      statusCode: 500,
    });
    fetchMock.mockResolvedValue(errorResp);

    const api = createApiClient({
      getToken: () => "token",
      onUnauthorized: vi.fn(),
    });

    const promise = api.postRaw("/api/v1/orders/123/pdf");
    vi.advanceTimersByTime(0);
    const err = await promise.catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Testy AbortController timeout
// ---------------------------------------------------------------------------

describe("AbortController — timeout 30s", () => {
  it("przerywa request po 30s i rzuca komunikat o timeout", async () => {
    // fetch nigdy się nie resolwuje — symulujemy nieskończone oczekiwanie
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          // Nasłuchujemy na abort signal
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const promise = api.get("/api/v1/orders");

    // Przesuwamy czas o 30s — to powoduje abort
    vi.advanceTimersByTime(30_000);

    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/limit czasu/);
  });
});

// ---------------------------------------------------------------------------
// Testy nagłówka Accept w normalnych requestach
// ---------------------------------------------------------------------------

describe("Normalne requesty — Accept: application/json", () => {
  it("GET ustawia Accept: application/json", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { ok: true }));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const promise = api.get("/api/v1/orders");
    vi.advanceTimersByTime(0);
    await promise;

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });

  it("POST ustawia Accept: application/json", async () => {
    fetchMock.mockResolvedValue(makeResponse(201, { id: "new" }));

    const api = createApiClient({
      getToken: () => "token",
      onUnauthorized: vi.fn(),
    });

    const promise = api.post("/api/v1/orders", { name: "test" });
    vi.advanceTimersByTime(0);
    await promise;

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });

  it("PUT ustawia Accept: application/json", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { ok: true }));

    const api = createApiClient({
      getToken: () => "token",
      onUnauthorized: vi.fn(),
    });

    const promise = api.put("/api/v1/orders/123", { name: "updated" });
    vi.advanceTimersByTime(0);
    await promise;

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });

  it("DELETE ustawia Accept: application/json", async () => {
    fetchMock.mockResolvedValue(makeResponse(204, ""));
    // 204 nie parsuje JSON, ale wciąż powinien wysłać application/json w Accept

    const api = createApiClient({
      getToken: () => "token",
      onUnauthorized: vi.fn(),
    });

    const promise = api.delete("/api/v1/orders/123");
    vi.advanceTimersByTime(0);
    await promise;

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });
});

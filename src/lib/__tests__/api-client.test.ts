/**
 * Tests for createApiClient (src/lib/api-client.ts).
 *
 * Covers:
 * - Authorization header presence/absence based on token
 * - 401 response triggers onUnauthorized callback
 * - ApiError construction from structured error body
 * - ApiError construction from plain text fallback
 * - Successful JSON response parsing
 * - 204 No Content returns undefined
 * - Network error (fetch throws) becomes a plain Error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiClient, ApiError } from "../api-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  const isOk = ok ?? (status >= 200 && status < 300);
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return {
    status,
    ok: isOk,
    statusText: status === 401 ? "Unauthorized" : status >= 400 ? "Error" : "OK",
    text: vi.fn().mockResolvedValue(bodyStr),
    json: vi.fn().mockResolvedValue(typeof body === "string" ? JSON.parse(body) : body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// jsdom does not define window.location correctly for assignment; patch origin.
// Guard against TypeError when deskryptor is not configurable in current environment.
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createApiClient — Authorization header", () => {
  it("adds Authorization header when token is present", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { ok: true }));

    const api = createApiClient({
      getToken: () => "test-jwt-token",
      onUnauthorized: vi.fn(),
    });

    await api.get("/api/v1/orders");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-jwt-token",
    );
  });

  it("omits Authorization header when token is null", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { ok: true }));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    await api.get("/api/v1/orders");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("always sends Accept: application/json", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { ok: true }));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    await api.get("/api/v1/orders");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });
});

describe("createApiClient — 401 interceptor", () => {
  it("calls onUnauthorized when response is 401", async () => {
    fetchMock.mockResolvedValue(makeResponse(401, {}));
    const onUnauthorized = vi.fn();

    const api = createApiClient({
      getToken: () => "some-token",
      onUnauthorized,
    });

    await expect(api.get("/api/v1/orders")).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("throws ApiError with statusCode 401 after 401 response", async () => {
    fetchMock.mockResolvedValue(makeResponse(401, {}));

    const api = createApiClient({
      getToken: () => "some-token",
      onUnauthorized: vi.fn(),
    });

    const err = await api.get("/api/v1/orders").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(401);
  });

  it("does NOT call onUnauthorized on 403", async () => {
    fetchMock.mockResolvedValue(
      makeResponse(403, {
        error: "Forbidden",
        message: "Brak uprawnień.",
        statusCode: 403,
      }),
    );
    const onUnauthorized = vi.fn();

    const api = createApiClient({
      getToken: () => "some-token",
      onUnauthorized,
    });

    await expect(api.get("/api/v1/orders")).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("createApiClient — ApiError parsing", () => {
  it("parses structured error body into ApiError fields", async () => {
    const errorBody = {
      error: "NotFound",
      message: "Nie znaleziono zasobu.",
      statusCode: 404,
      details: { id: "invalid UUID" },
    };
    fetchMock.mockResolvedValue(makeResponse(404, errorBody));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const err = await api.get("/api/v1/orders/missing-id").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(404);
    expect((err as ApiError).errorCode).toBe("NotFound");
    expect((err as ApiError).message).toBe("Nie znaleziono zasobu.");
    expect((err as ApiError).details).toEqual({ id: "invalid UUID" });
  });

  it("falls back to plain ApiError when body is not JSON", async () => {
    const resp = {
      status: 500,
      ok: false,
      statusText: "Internal Server Error",
      text: vi.fn().mockResolvedValue("Unexpected server error"),
    } as unknown as Response;
    fetchMock.mockResolvedValue(resp);

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const err = await api.get("/api/v1/orders").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(500);
    expect((err as ApiError).message).toBe("Unexpected server error");
  });
});

describe("createApiClient — successful responses", () => {
  it("returns parsed JSON on 200", async () => {
    const payload = { items: [{ id: "1" }], totalItems: 1 };
    fetchMock.mockResolvedValue(makeResponse(200, payload));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const result = await api.get<typeof payload>("/api/v1/orders");
    expect(result).toEqual(payload);
  });

  it("returns undefined on 204 No Content", async () => {
    const resp = {
      status: 204,
      ok: true,
      statusText: "No Content",
      text: vi.fn().mockResolvedValue(""),
    } as unknown as Response;
    fetchMock.mockResolvedValue(resp);

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const result = await api.delete("/api/v1/orders/123");
    expect(result).toBeUndefined();
  });

  it("sends POST with JSON body and Content-Type header", async () => {
    fetchMock.mockResolvedValue(makeResponse(201, { id: "new-id" }));

    const api = createApiClient({
      getToken: () => "token",
      onUnauthorized: vi.fn(),
    });

    const body = { name: "Test" };
    await api.post("/api/v1/orders", body);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify(body));
  });
});

describe("createApiClient — network errors", () => {
  it("throws plain Error when fetch rejects (network failure)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    const err = await api.get("/api/v1/orders").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as Error).message).toMatch(/połączenia z serwerem/);
  });
});

describe("createApiClient — query params", () => {
  it("appends scalar query params to URL", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, []));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    await api.get("/api/v1/orders", { page: 2, view: "CURRENT" });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("page=2");
    expect(url).toContain("view=CURRENT");
  });

  it("skips undefined/null query param values", async () => {
    fetchMock.mockResolvedValue(makeResponse(200, []));

    const api = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
    });

    await api.get("/api/v1/orders", { page: undefined, view: null });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain("page=");
    expect(url).not.toContain("view=");
  });
});

/**
 * Testy dla src/lib/send-email.ts (Graph flow + .eml fallback).
 *
 * Pokrycie:
 * - connected=false → fallback .eml (postRaw)
 * - connected=true + sukces Graph → window.open(webLink), brak postRaw
 * - connected=true + 412 ApiError → fallback .eml
 * - connected=true + 500 Graph → fallback .eml + toast.message
 * - connected=true + 422 missing → onValidationError, brak fallbacku
 * - status cache (sessionStorage 60s) — drugi call nie pyta backendu
 * - invalidateMsOAuthStatusCache → usuwa wpis
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { ApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Mock toast (sonner)
// ---------------------------------------------------------------------------

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastMessage = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    message: (...args: unknown[]) => toastMessage(...args),
  },
}));

import {
  invalidateMsOAuthStatusCache,
  sendEmailForOrder,
} from "../send-email";
import { setEmailOpenMode } from "../email-open-mode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApiClient(overrides?: {
  getStatus?: () => Promise<unknown>;
  postGraph?: () => Promise<unknown>;
  postRaw?: () => Promise<Response>;
}): ApiClient {
  return {
    get: vi.fn(async (path: string) => {
      if (path === "/api/v1/ms-oauth/status") {
        if (overrides?.getStatus) return overrides.getStatus();
        return { connected: false, msEmail: null, expiresAt: null, connectedAt: null };
      }
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path: string) => {
      if (path.endsWith("/prepare-email-graph")) {
        if (overrides?.postGraph) return overrides.postGraph();
        return { draftId: "D-1", webLink: "https://outlook.office.com/X" };
      }
      throw new Error(`Unexpected POST ${path}`);
    }),
    postRaw: vi.fn(async (path: string) => {
      if (path.endsWith("/prepare-email")) {
        if (overrides?.postRaw) return overrides.postRaw();
        return {
          blob: async () => new Blob(["dummy"], { type: "message/rfc822" }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected postRaw ${path}`);
    }),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  } as unknown as ApiClient;
}

function setupDomMocks() {
  // window.open mock
  const opened = { closed: false, location: { href: "" }, close: vi.fn() };
  vi.spyOn(window, "open").mockImplementation(
    () => opened as unknown as Window
  );

  // URL.createObjectURL / revokeObjectURL (jsdom ich nie ma)
  const createObjectURL = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:fake");
  const revokeObjectURL = vi
    .spyOn(URL, "revokeObjectURL")
    .mockReturnValue(undefined);

  // HTMLAnchorElement.click — w jsdom istnieje, ale w niektórych scenariuszach
  // może powodować navigation. Wyciszamy, by uniknąć efektów ubocznych.
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  return { opened, createObjectURL, revokeObjectURL, clickSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Wyczyść cache statusu i wszystkie spy/mocki DOM
  invalidateMsOAuthStatusCache();
  sessionStorage.clear();
  // localStorage trzyma preferencję EmailOpenMode — czyść, by default = heurystyka
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// connected=false → .eml fallback
// ---------------------------------------------------------------------------

describe("sendEmailForOrder — connected=false", () => {
  it("falls back to .eml when MS not connected", async () => {
    // Arrange
    setupDomMocks();
    const api = buildApiClient({
      getStatus: async () => ({
        connected: false,
        msEmail: null,
        expiresAt: null,
        connectedAt: null,
      }),
    });
    const onSuccess = vi.fn();
    const onValidationError = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-1",
      api,
      onSuccess,
      onValidationError,
    });

    // Assert
    expect(api.post).not.toHaveBeenCalled(); // brak Graph flow
    expect(api.postRaw).toHaveBeenCalledWith(
      "/api/v1/orders/o-1/prepare-email",
      {}
    );
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// connected=true → Graph happy path
// ---------------------------------------------------------------------------

describe("sendEmailForOrder — connected=true (Graph happy path)", () => {
  it("opens webLink in new tab when Graph flow succeeds", async () => {
    // Arrange — explicit preferencja "web" (niezależna od heurystyki dla u@c.com)
    setEmailOpenMode("web");
    const dom = setupDomMocks();
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@c.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => ({
        draftId: "DRAFT-77",
        webLink: "https://outlook.office.com/deeplink/compose/draft-77",
      }),
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "order-77",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/orders/order-77/prepare-email-graph",
      {}
    );
    expect(api.postRaw).not.toHaveBeenCalled(); // brak fallbacku
    // Karta otwarta i ustawiona na webLink
    expect(dom.opened.location.href).toBe(
      "https://outlook.office.com/deeplink/compose/draft-77"
    );
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// connected=true + 412 → fallback
// ---------------------------------------------------------------------------

describe("sendEmailForOrder — Graph returns 412", () => {
  it("falls back to .eml when Graph returns 412 MS_NOT_CONNECTED", async () => {
    // Arrange — explicit "web" by zmusić wywołanie Graph (heurystyka u@c.com = desktop)
    setEmailOpenMode("web");
    setupDomMocks();
    const apiError = new ApiError({
      statusCode: 412,
      error: "Precondition Failed",
      message: "MS not connected",
      details: { code: "MS_NOT_CONNECTED" },
    });
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@c.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => {
        throw apiError;
      },
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-X",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert — fallback na .eml
    expect(api.post).toHaveBeenCalledOnce(); // próbowaliśmy Graph
    expect(api.postRaw).toHaveBeenCalledWith(
      "/api/v1/orders/o-X/prepare-email",
      {}
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// connected=true + 500 → fallback z toast
// ---------------------------------------------------------------------------

describe("sendEmailForOrder — Graph returns 500", () => {
  it("falls back to .eml + shows toast.message when Graph fails (500)", async () => {
    // Arrange — explicit "web" by zmusić wywołanie Graph
    setEmailOpenMode("web");
    setupDomMocks();
    const apiError = new ApiError({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Graph error",
    });
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@c.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => {
        throw apiError;
      },
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-Y",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert
    expect(api.postRaw).toHaveBeenCalled();
    expect(toastMessage).toHaveBeenCalled(); // toast.message — "Microsoft Graph niedostępny"
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 422 missing fields → onValidationError, brak fallbacku
// ---------------------------------------------------------------------------

describe("sendEmailForOrder — 422 validation error", () => {
  it("calls onValidationError and does NOT fallback to .eml (Graph path)", async () => {
    // Arrange — explicit "web" by przejść przez Graph (heurystyka u@c.com = desktop)
    setEmailOpenMode("web");
    setupDomMocks();
    const apiError = new ApiError({
      statusCode: 422,
      error: "Unprocessable Entity",
      message: "Missing fields",
      details: { missing: ["carrier", "rate"] },
    });
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@c.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => {
        throw apiError;
      },
    });
    const onValidationError = vi.fn();
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-Z",
      api,
      onSuccess,
      onValidationError,
    });

    // Assert
    expect(onValidationError).toHaveBeenCalledWith(["carrier", "rate"]);
    expect(api.postRaw).not.toHaveBeenCalled(); // BRAK fallbacku na 422
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onValidationError when .eml fallback returns 422", async () => {
    // Arrange — connected=false, ale .eml też failuje z 422
    setupDomMocks();
    const apiError = new ApiError({
      statusCode: 422,
      error: "Unprocessable Entity",
      message: "Missing",
      details: { missing: ["x"] },
    });
    const api = buildApiClient({
      postRaw: async () => {
        throw apiError;
      },
    });
    const onValidationError = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-Q",
      api,
      onSuccess: vi.fn(),
      onValidationError,
    });

    // Assert
    expect(onValidationError).toHaveBeenCalledWith(["x"]);
  });
});

// ---------------------------------------------------------------------------
// Status cache (sessionStorage 60s)
// ---------------------------------------------------------------------------

describe("status cache", () => {
  it("does NOT hit backend on second call within 60s TTL", async () => {
    // Arrange
    setupDomMocks();
    const api = buildApiClient({
      getStatus: async () => ({
        connected: false,
        msEmail: null,
        expiresAt: null,
        connectedAt: null,
      }),
    });

    // Act — pierwsze wywołanie zapisuje cache
    await sendEmailForOrder({
      orderId: "o-1",
      api,
      onSuccess: vi.fn(),
      onValidationError: vi.fn(),
    });
    // Drugie — w obrębie TTL powinno użyć cache
    await sendEmailForOrder({
      orderId: "o-2",
      api,
      onSuccess: vi.fn(),
      onValidationError: vi.fn(),
    });

    // Assert — api.get wywołane tylko raz (status z cache w drugim wywołaniu)
    const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
    const statusCalls = getMock.mock.calls.filter(
      (c: unknown[]) => c[0] === "/api/v1/ms-oauth/status"
    );
    expect(statusCalls).toHaveLength(1);
  });

  it("invalidateMsOAuthStatusCache forces fresh fetch on next call", async () => {
    // Arrange
    setupDomMocks();
    const api = buildApiClient({
      getStatus: async () => ({
        connected: false,
        msEmail: null,
        expiresAt: null,
        connectedAt: null,
      }),
    });

    // Act — pierwsze + invalidate + drugie
    await sendEmailForOrder({
      orderId: "o-1",
      api,
      onSuccess: vi.fn(),
      onValidationError: vi.fn(),
    });
    invalidateMsOAuthStatusCache();
    await sendEmailForOrder({
      orderId: "o-2",
      api,
      onSuccess: vi.fn(),
      onValidationError: vi.fn(),
    });

    // Assert — drugie wywołanie odpytało status
    const getMock = api.get as unknown as ReturnType<typeof vi.fn>;
    const statusCalls = getMock.mock.calls.filter(
      (c: unknown[]) => c[0] === "/api/v1/ms-oauth/status"
    );
    expect(statusCalls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// EmailOpenMode — preferencja sposobu otwierania draftu (localStorage)
// ---------------------------------------------------------------------------

describe("sendEmailForOrder — EmailOpenMode preferences", () => {
  it("mode=desktop: skips Graph flow even when connected, uses .eml", async () => {
    // Arrange — user wybrał "desktop" w ustawieniach, MS połączony
    setupDomMocks();
    setEmailOpenMode("desktop");
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@contoso.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-desk",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert — Graph POMINIĘTY mimo connected=true
    expect(api.post).not.toHaveBeenCalled();
    expect(api.postRaw).toHaveBeenCalledWith(
      "/api/v1/orders/o-desk/prepare-email",
      {}
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("mode=web (explicit): uses Graph flow when connected", async () => {
    // Arrange — user wybrał "web"
    const dom = setupDomMocks();
    setEmailOpenMode("web");
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@contoso.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => ({
        draftId: "D-WEB",
        webLink: "https://outlook.office.com/web-link",
      }),
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-web",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert — Graph zostało wywołane, postRaw NIE
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/orders/o-web/prepare-email-graph",
      {}
    );
    expect(api.postRaw).not.toHaveBeenCalled();
    expect(dom.opened.location.href).toBe("https://outlook.office.com/web-link");
  });

  it("mode=ask + user picks OK (web): uses Graph flow", async () => {
    // Arrange — user wybrał "ask", w dialogu klika OK
    const dom = setupDomMocks();
    setEmailOpenMode("ask");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@contoso.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => ({
        draftId: "D-ASK-WEB",
        webLink: "https://outlook.office.com/ask-web",
      }),
    });

    // Act
    await sendEmailForOrder({
      orderId: "o-ask-w",
      api,
      onSuccess: vi.fn(),
      onValidationError: vi.fn(),
    });

    // Assert
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(api.post).toHaveBeenCalledOnce(); // Graph flow
    expect(dom.opened.location.href).toBe("https://outlook.office.com/ask-web");

    confirmSpy.mockRestore();
  });

  it("mode=ask + user picks Cancel (desktop): uses .eml flow", async () => {
    // Arrange — user wybrał "ask", w dialogu klika Anuluj
    setupDomMocks();
    setEmailOpenMode("ask");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "u@contoso.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-ask-d",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert — Graph POMINIĘTY, .eml wywołane
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.postRaw).toHaveBeenCalledWith(
      "/api/v1/orders/o-ask-d/prepare-email",
      {}
    );
    expect(onSuccess).toHaveBeenCalledOnce();

    confirmSpy.mockRestore();
  });

  it("no preference + corporate msEmail: heuristic = desktop (.eml flow)", async () => {
    // Arrange — brak preferencji, konto firmowe → heurystyka "desktop"
    setupDomMocks();
    // localStorage czysty (po beforeEach) — wymusza heurystykę
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "user@odylion.com", // domena firmowa → desktop
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
    });
    const onSuccess = vi.fn();

    // Act
    await sendEmailForOrder({
      orderId: "o-heur-d",
      api,
      onSuccess,
      onValidationError: vi.fn(),
    });

    // Assert — Graph POMINIĘTY mimo connected=true (heurystyka chciała desktop)
    expect(api.post).not.toHaveBeenCalled();
    expect(api.postRaw).toHaveBeenCalled();
  });

  it("no preference + personal msEmail: heuristic = web (Graph flow)", async () => {
    // Arrange — brak preferencji, @outlook.com → heurystyka "web"
    const dom = setupDomMocks();
    const api = buildApiClient({
      getStatus: async () => ({
        connected: true,
        msEmail: "user@outlook.com",
        expiresAt: "2027-01-01T00:00:00Z",
        connectedAt: "2026-04-01T00:00:00Z",
      }),
      postGraph: async () => ({
        draftId: "D-PERS",
        webLink: "https://outlook.office.com/pers",
      }),
    });

    // Act
    await sendEmailForOrder({
      orderId: "o-heur-w",
      api,
      onSuccess: vi.fn(),
      onValidationError: vi.fn(),
    });

    // Assert — Graph wywołane (web mode)
    expect(api.post).toHaveBeenCalled();
    expect(dom.opened.location.href).toBe("https://outlook.office.com/pers");
  });
});

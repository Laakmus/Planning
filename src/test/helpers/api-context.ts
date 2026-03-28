/**
 * Wspólny helper do tworzenia kontekstu APIRoute w testach (NEW-05).
 * Eliminuje duplikację makeContext() w plikach testowych API.
 */

import { vi } from "vitest";
import type { APIContext } from "astro";

interface MakeContextOptions {
  /** URL endpointu (domyślnie /api/v1/orders) */
  url?: string;
  /** Metoda HTTP (domyślnie GET) */
  method?: string;
  /** Body żądania (dla POST/PUT/PATCH) */
  body?: string;
  /** Parametry ścieżki (np. { orderId: "abc-123" }) */
  params?: Record<string, string>;
  /** Nadpisanie locals (np. supabase mock) */
  locals?: Record<string, unknown>;
  /** Dodatkowe headers */
  headers?: Record<string, string>;
}

/**
 * Tworzy mock kontekstu Astro APIRoute do testów.
 * Użycie: `const ctx = makeApiContext({ url: "/api/v1/orders/123", method: "PUT", body: JSON.stringify(data) });`
 */
export function makeApiContext(options: MakeContextOptions = {}): APIContext {
  const {
    url = "http://localhost:4321/api/v1/orders",
    method = "GET",
    body,
    params = {},
    locals = {},
    headers = {},
  } = options;

  const requestUrl = url.startsWith("http") ? url : `http://localhost:4321${url}`;
  const reqHeaders = new Headers(headers);
  if (body && !reqHeaders.has("content-type")) {
    reqHeaders.set("content-type", "application/json");
  }

  const request = new Request(requestUrl, {
    method,
    headers: reqHeaders,
    ...(body ? { body } : {}),
  });

  return {
    locals: { supabase: { from: vi.fn() }, ...locals },
    request,
    params,
    url: new URL(requestUrl),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as APIContext["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: new URL(requestUrl).pathname,
    originPathname: new URL(requestUrl).pathname,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as APIContext;
}

import type { ApiErrorResponse } from "@/types";

/**
 * Typed API error thrown by api-client on 4xx/5xx responses.
 * Carries the parsed ApiErrorResponse body so callers can inspect details.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse,
  ) {
    super(body.error.message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "method" | "body"> & {
  params?: Record<string, string | number | boolean | undefined | null>;
};

let _getToken: (() => string | null) | null = null;
let _onUnauthorized: (() => void) | null = null;

/**
 * Configure the API client with auth helpers.
 * Called once from AuthProvider on mount.
 */
export function configureApiClient(options: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}) {
  _getToken = options.getToken;
  _onUnauthorized = options.onUnauthorized;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const token = _getToken?.();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const url = buildUrl(path, options?.params);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network error (no connection, DNS failure, CORS, etc.)
    throw new ApiError(0, {
      error: {
        code: "NETWORK_ERROR",
        message: "Brak połączenia z serwerem. Sprawdź połączenie sieciowe.",
      },
    });
  }

  // 401 — use server message; redirect to login only if not during auth/me (login flow)
  if (response.status === 401) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await response.clone().json();
    } catch {
      errorBody = {
        error: { code: "UNAUTHORIZED", message: "Sesja wygasła. Zaloguj się ponownie." },
      };
    }
    const isAuthMeRequest = url.includes("/api/v1/auth/me");
    if (!isAuthMeRequest) {
      _onUnauthorized?.();
    }
    throw new ApiError(401, errorBody);
  }

  // 204 No Content — return empty
  if (response.status === 204) {
    return undefined as T;
  }

  // Check for non-JSON responses (e.g. PDF blob)
  const contentType = response.headers.get("Content-Type") ?? "";

  if (!response.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await response.json();
    } catch {
      // Fallback messages for common HTTP status codes when body is not JSON
      const fallbackMessages: Record<number, string> = {
        403: "Brak uprawnień do tej operacji",
        404: "Nie znaleziono zasobu",
        500: "Wystąpił błąd serwera. Spróbuj ponownie.",
        502: "Serwer tymczasowo niedostępny",
        503: "Serwer tymczasowo niedostępny",
      };
      errorBody = {
        error: {
          code: response.status === 403 ? "FORBIDDEN" : response.status === 404 ? "NOT_FOUND" : "UNKNOWN",
          message: fallbackMessages[response.status] ?? `Błąd serwera (${response.status})`,
        },
      };
    }
    throw new ApiError(response.status, errorBody);
  }

  // PDF / binary responses
  if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
    return (await response.blob()) as T;
  }

  return response.json();
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PUT", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },
};

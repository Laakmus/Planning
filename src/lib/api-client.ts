/**
 * Klient HTTP dla frontendowych zapytań do REST API (api/v1).
 *
 * Odpowiedzialność:
 * - Automatyczne dodawanie nagłówka Authorization: Bearer {token}
 * - Parsowanie odpowiedzi JSON z obsługą typów generycznych
 * - Interceptor 401 → wywołanie callbacka wylogowania
 * - Rzucanie typowanego ApiError przy 4xx/5xx
 */

/** Struktura błędu zwracanego przez API (zgodna z errorResponse w api-helpers.ts). */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, string | string[]>;
}

/** Wyjątek HTTP z pełnymi danymi odpowiedzi serwera. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, string | string[]>;

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.name = "ApiError";
    this.statusCode = response.statusCode;
    this.errorCode = response.error;
    this.details = response.details;
  }
}

/** Konfiguracja klienta API przekazywana przy tworzeniu instancji. */
interface ApiClientConfig {
  /** Bazowy URL (domyślnie pusty — zapytania do tego samego hosta). */
  baseUrl?: string;
  /** Funkcja zwracająca aktualny token JWT (lub null gdy brak sesji). */
  getToken: () => string | null;
  /** Callback wywoływany przy odpowiedzi 401 (np. wylogowanie). */
  onUnauthorized: () => void;
}

/**
 * Tworzy instancję klienta API z wbudowaną obsługą autoryzacji i błędów.
 *
 * Przykład użycia:
 * ```ts
 * const api = createApiClient({
 *   getToken: () => sessionStorage.getItem("token"),
 *   onUnauthorized: () => { window.location.href = "/"; },
 * });
 * const orders = await api.get<OrderListResponseDto>("/api/v1/orders", { view: "CURRENT" });
 * ```
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl = "", getToken, onUnauthorized } = config;

  /**
   * Wykonuje zapytanie HTTP i zwraca sparsowaną odpowiedź JSON.
   * Obsługuje: 401 → onUnauthorized, 4xx/5xx → ApiError, błąd sieci → Error.
   */
  async function request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | string[] | number | boolean | undefined | null>;
      /** Jeśli true, zwraca Response zamiast parsować JSON (np. dla PDF blob). */
      raw?: boolean;
    }
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`, window.location.origin);

    // Dodaj parametry zapytania (pomija undefined/null)
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: options?.raw ? "*/*" : "application/json",
    };

    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Body JSON — tylko dla metod z ciałem
    let bodyStr: string | undefined;
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      bodyStr = JSON.stringify(options.body);
    }

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Przekroczono limit czasu żądania (30s). Sprawdź połączenie sieciowe.");
      }
      throw new Error("Brak połączenia z serwerem. Sprawdź połączenie sieciowe.");
    }
    clearTimeout(timeoutId);

    // 401 → interceptor wylogowania
    if (response.status === 401) {
      onUnauthorized();
      throw new ApiError({
        statusCode: 401,
        error: "Unauthorized",
        message: "Sesja wygasła. Zaloguj się ponownie.",
      });
    }

    // Dla trybu raw (np. PDF) — zwróć Response bezpośrednio
    if (options?.raw) {
      if (!response.ok) {
        // Próbuj sparsować błąd JSON z odpowiedzi
        const errorBody = await parseErrorBody(response);
        throw new ApiError(errorBody);
      }
      // Zaufanie do API response — frontend i backend w jednym repo
      return response as unknown as T;
    }

    // Odpowiedź 204 No Content — brak ciała
    if (response.status === 204) {
      // Rzutowanie konieczne — 204 nie ma ciała, T może być void/undefined
      return undefined as T;
    }

    // Parsowanie ciała odpowiedzi
    const text = await response.text();

    if (!response.ok) {
      // Próbuj sparsować strukturę błędu API
      try {
        // Rzutowanie konieczne — JSON.parse zwraca unknown
        const errorBody = JSON.parse(text) as ApiErrorResponse;
        throw new ApiError(errorBody);
      } catch (e) {
        if (e instanceof ApiError) throw e;
        // Fallback gdy ciało nie jest poprawnym JSON
        throw new ApiError({
          statusCode: response.status,
          error: response.statusText || "Error",
          message: text || `Błąd serwera (${response.status})`,
        });
      }
    }

    // Parsowanie sukcesu
    if (!text.trim()) {
      // Rzutowanie konieczne — puste ciało przy 200, T może być void/undefined
      return undefined as T;
    }

    try {
      // Rzutowanie konieczne — JSON.parse zwraca unknown
      return JSON.parse(text) as T;
    } catch {
      // Ignorujemy — niepoprawny JSON powoduje rzucenie czytelnego Error poniżej
      throw new Error(`Nieprawidłowa odpowiedź serwera (nie JSON): ${text.substring(0, 200)}`);
    }
  }

  /** Próbuje sparsować ciało błędu z Response. */
  async function parseErrorBody(response: Response): Promise<ApiErrorResponse> {
    try {
      const text = await response.text();
      // Rzutowanie konieczne — JSON.parse zwraca unknown
      return JSON.parse(text) as ApiErrorResponse;
    } catch {
      // Ignorujemy — niepoprawne ciało odpowiedzi; zwracamy generyczny fallback poniżej
      return {
        statusCode: response.status,
        error: response.statusText || "Error",
        message: `Błąd serwera (${response.status})`,
      };
    }
  }

  return {
    /** GET z opcjonalnymi parametrami zapytania. */
    get<T>(path: string, params?: Record<string, string | string[] | number | boolean | undefined | null>): Promise<T> {
      return request<T>("GET", path, { params });
    },

    /** POST z opcjonalnym ciałem JSON. */
    post<T>(path: string, body?: unknown): Promise<T> {
      return request<T>("POST", path, { body });
    },

    /** PUT z ciałem JSON. */
    put<T>(path: string, body: unknown): Promise<T> {
      return request<T>("PUT", path, { body });
    },

    /** DELETE bez ciała. */
    delete<T>(path: string): Promise<T> {
      return request<T>("DELETE", path);
    },

    /** PATCH z ciałem JSON. */
    patch<T>(path: string, body: unknown): Promise<T> {
      return request<T>("PATCH", path, { body });
    },

    /** POST zwracający surowy Response (np. dla pobierania PDF jako blob). */
    postRaw(path: string, body?: unknown): Promise<Response> {
      return request<Response>("POST", path, { body, raw: true });
    },
  };
}

/** Typ instancji klienta API (do przekazywania przez kontekst). */
export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Testy komponentu EmailConnectionCard (AUTH-MIG B4).
 *
 * Pokrycie:
 * - Loading state (isLoading=true)
 * - Disconnected: pokazuje "Niepołączono" + przycisk "Połącz z Microsoft"
 * - Connected: pokazuje msEmail + przycisk "Rozłącz"
 * - Klik "Rozłącz" → AlertDialog → confirm → API disconnect → odświeżenie statusu
 * - Klik "Anuluj" w dialogu → brak wywołania API
 * - Query param ?ms_connected=1 → toast.success
 * - Query param ?ms_error=... → toast.error
 * - Klik "Połącz z Microsoft" → window.location.href = "/api/v1/ms-oauth/start"
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// vi.hoisted — referencje muszą istnieć w czasie hoistowania vi.mock
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// Mock useAuth — vi.hoisted dla stabilnych referencji do mocków API.
// WAŻNE: cały obiekt useAuth() musi być STABILNĄ referencją, inaczej useCallback([api])
// w komponencie tworzy nowe loadStatus przy każdym renderze → useEffect re-run → race.
const { mockApiGet, mockApiPost, mockAuthValue } = vi.hoisted(() => {
  const get = vi.fn();
  const post = vi.fn();
  const auth = {
    user: { id: "u1", email: "a@b.com", fullName: "User", role: "PLANNER" },
    api: { get, post },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  };
  return { mockApiGet: get, mockApiPost: post, mockAuthValue: auth };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/lib/send-email", () => ({
  invalidateMsOAuthStatusCache: vi.fn(),
}));

import { EmailConnectionCard } from "../EmailConnectionCard";

// ---------------------------------------------------------------------------
// Helpers — kontrola location/search
// ---------------------------------------------------------------------------

function setSearchParam(search: string) {
  // jsdom — używamy current origin, by uniknąć SecurityError z replaceState
  window.history.replaceState({}, "", `/settings/email${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  toastSuccess.mockClear();
  toastError.mockClear();

  mockApiGet.mockReset();
  mockApiGet.mockResolvedValue({
    connected: false,
    msEmail: null,
    expiresAt: null,
    connectedAt: null,
  });
  mockApiPost.mockReset();
  mockApiPost.mockResolvedValue(undefined);

  // Czyść search params między testami (relatywny URL, omija SecurityError)
  window.history.replaceState({}, "", "/settings/email");
  // Czyść preferencję EmailOpenMode między testami (komponent czyta localStorage)
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("EmailConnectionCard — initial render", () => {
  it("shows loading state initially", () => {
    // Arrange — pendujący get (nie rozwiążemy go)
    mockApiGet.mockImplementation(() => new Promise(() => {}));

    // Act
    render(<EmailConnectionCard />);

    // Assert
    expect(screen.getByTestId("email-connection-loading")).toBeInTheDocument();
    expect(screen.getByText(/Sprawdzanie statusu/i)).toBeInTheDocument();
  });

  it("renders disconnected state when status.connected=false", async () => {
    // Act
    render(<EmailConnectionCard />);

    // Assert — po fetch
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnected")).toBeInTheDocument();
    });
    expect(screen.getByText("Niepołączono")).toBeInTheDocument();
    expect(screen.getByTestId("email-connection-connect")).toBeInTheDocument();
    expect(screen.getByText("Połącz z Microsoft")).toBeInTheDocument();
  });

  it("renders connected state with msEmail when status.connected=true", async () => {
    // Arrange
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@contoso.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T10:00:00Z",
    });

    // Act
    render(<EmailConnectionCard />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-connected")).toBeInTheDocument();
    });
    expect(screen.getByText("user@contoso.com")).toBeInTheDocument();
    expect(screen.getByTestId("email-connection-disconnect")).toBeInTheDocument();
  });

  it("shows fallback '(nieznany adres)' when msEmail is null but connected=true", async () => {
    // Arrange
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: null,
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T10:00:00Z",
    });

    // Act
    render(<EmailConnectionCard />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/nieznany adres/)).toBeInTheDocument();
    });
  });

  it("shows disconnected on API error (graceful default)", async () => {
    // Arrange
    mockApiGet.mockRejectedValue(new Error("Network error"));

    // Act
    render(<EmailConnectionCard />);

    // Assert — fallback do disconnected + toast
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnected")).toBeInTheDocument();
    });
    expect(toastError).toHaveBeenCalled();
  });
});

describe("EmailConnectionCard — connect button", () => {
  it("clicking 'Połącz z Microsoft' fetches authorizeUrl and navigates", async () => {
    // Arrange — mock api.get zwraca authorizeUrl, podmień href setter
    const user = userEvent.setup();
    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: new Proxy(originalLocation, {
        set(target, prop, value) {
          if (prop === "href") {
            hrefSetter(value);
            return true;
          }
          (target as unknown as Record<string | symbol, unknown>)[prop] = value;
          return true;
        },
        get(target, prop) {
          return Reflect.get(target, prop);
        },
      }),
    });

    // Mock: pierwszy api.get to status (disconnected), drugi to /start (authorizeUrl)
    mockApiGet.mockImplementation((path: string) => {
      if (path === "/api/v1/ms-oauth/status") {
        return Promise.resolve({
          connected: false,
          msEmail: null,
          expiresAt: null,
          connectedAt: null,
        });
      }
      if (path === "/api/v1/ms-oauth/start") {
        return Promise.resolve({
          authorizeUrl: "https://login.microsoftonline.com/test/authorize?x=1",
        });
      }
      return Promise.resolve({});
    });

    try {
      render(<EmailConnectionCard />);
      await waitFor(() => {
        expect(screen.getByTestId("email-connection-connect")).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByTestId("email-connection-connect"));

      // Assert — backend zostało wywołane + browser nawigowany na URL z response
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith("/api/v1/ms-oauth/start");
        expect(hrefSetter).toHaveBeenCalledWith(
          "https://login.microsoftonline.com/test/authorize?x=1"
        );
      });
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });
});

describe("EmailConnectionCard — disconnect flow", () => {
  it("clicking 'Rozłącz' opens AlertDialog with confirm button", async () => {
    // Arrange
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@contoso.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T10:00:00Z",
    });
    const user = userEvent.setup();
    render(<EmailConnectionCard />);
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnect")).toBeInTheDocument();
    });

    // Act
    await user.click(screen.getByTestId("email-connection-disconnect"));

    // Assert
    expect(screen.getByText(/Rozłączyć konto Microsoft 365/)).toBeInTheDocument();
    expect(screen.getByTestId("email-connection-disconnect-confirm")).toBeInTheDocument();
  });

  it("confirming disconnect calls POST /api/v1/ms-oauth/disconnect and switches to disconnected state", async () => {
    // Arrange
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@contoso.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T10:00:00Z",
    });
    const user = userEvent.setup();
    render(<EmailConnectionCard />);
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnect")).toBeInTheDocument();
    });

    // Act — otwórz dialog + potwierdź
    await user.click(screen.getByTestId("email-connection-disconnect"));
    await user.click(screen.getByTestId("email-connection-disconnect-confirm"));

    // Assert — API call + przełączenie stanu
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/v1/ms-oauth/disconnect", {});
    });
    expect(toastSuccess).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnected")).toBeInTheDocument();
    });
  });

  it("shows error toast when disconnect API fails", async () => {
    // Arrange
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@contoso.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T10:00:00Z",
    });
    mockApiPost.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    render(<EmailConnectionCard />);
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnect")).toBeInTheDocument();
    });

    // Act
    await user.click(screen.getByTestId("email-connection-disconnect"));
    await user.click(screen.getByTestId("email-connection-disconnect-confirm"));

    // Assert
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    // Pozostaje connected (nie zmieniamy stanu przy błędzie)
    expect(screen.queryByTestId("email-connection-connected")).toBeInTheDocument();
  });

  it("clicking 'Anuluj' in dialog closes it without calling API", async () => {
    // Arrange
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@contoso.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T10:00:00Z",
    });
    const user = userEvent.setup();
    render(<EmailConnectionCard />);
    await waitFor(() => {
      expect(screen.getByTestId("email-connection-disconnect")).toBeInTheDocument();
    });

    // Act — otwórz dialog + anuluj
    await user.click(screen.getByTestId("email-connection-disconnect"));
    const cancelBtn = screen.getByText("Anuluj");
    await user.click(cancelBtn);

    // Assert — API NIE wywołane
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

describe("EmailConnectionCard — query params from OAuth callback", () => {
  it("shows success toast when ?ms_connected=1 is in URL", async () => {
    // Arrange
    setSearchParam("?ms_connected=1");

    // Act
    render(<EmailConnectionCard />);

    // Assert
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/Pomyślnie połączono/i)
      );
    });
    // URL został wyczyszczony (history.replaceState)
    expect(window.location.search).toBe("");
  });

  it("shows error toast when ?ms_error=access_denied is in URL", async () => {
    // Arrange
    setSearchParam("?ms_error=access_denied");

    // Act
    render(<EmailConnectionCard />);

    // Assert
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/anulowane|odmów|odrzuc/i)
      );
    });
  });

  it("shows generic error toast for unknown error code", async () => {
    // Arrange
    setSearchParam("?ms_error=some_unknown_code");

    // Act
    render(<EmailConnectionCard />);

    // Assert
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("some_unknown_code")
      );
    });
  });
});

// ---------------------------------------------------------------------------
// EmailOpenMode — radio buttons + persystencja w localStorage
// ---------------------------------------------------------------------------

describe("EmailConnectionCard — sposób otwierania draftu (EmailOpenMode)", () => {
  it("renders three radio options (web/desktop/ask)", async () => {
    // Act
    render(<EmailConnectionCard />);

    // Assert — sekcja widoczna od razu (po fetchu, dopóki nie loading)
    await waitFor(() => {
      expect(screen.getByTestId("email-open-mode-section")).toBeInTheDocument();
    });
    expect(screen.getByTestId("email-open-mode-input-web")).toBeInTheDocument();
    expect(screen.getByTestId("email-open-mode-input-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("email-open-mode-input-ask")).toBeInTheDocument();
  });

  it("uses heuristic 'web' for personal MS account when no preference saved", async () => {
    // Arrange — konto osobiste @outlook.com, brak preferencji w localStorage
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@outlook.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T00:00:00Z",
    });

    // Act
    render(<EmailConnectionCard />);

    // Assert — radio "web" jest checked (heurystyka)
    await waitFor(() => {
      const webInput = screen.getByTestId(
        "email-open-mode-input-web",
      ) as HTMLInputElement;
      expect(webInput.checked).toBe(true);
    });
    const desktopInput = screen.getByTestId(
      "email-open-mode-input-desktop",
    ) as HTMLInputElement;
    expect(desktopInput.checked).toBe(false);
    // Komunikat o domyślnym ustawieniu widoczny
    expect(screen.getByTestId("email-open-mode-default-info")).toBeInTheDocument();
  });

  it("uses default 'web' for corporate account when no preference saved", async () => {
    // Arrange — konto firmowe, brak preferencji. Default ZAWSZE "web" (po decyzji UX).
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@odylion.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T00:00:00Z",
    });

    // Act
    render(<EmailConnectionCard />);

    // Assert
    await waitFor(() => {
      const webInput = screen.getByTestId(
        "email-open-mode-input-web",
      ) as HTMLInputElement;
      expect(webInput.checked).toBe(true);
    });
  });

  it("respects stored preference (overrides default)", async () => {
    // Arrange — zapisana preferencja "ask", konto firmowe (default to "web")
    localStorage.setItem("planning:email-open-mode", "ask");
    mockApiGet.mockResolvedValue({
      connected: true,
      msEmail: "user@odylion.com",
      expiresAt: "2027-01-01T00:00:00Z",
      connectedAt: "2026-04-01T00:00:00Z",
    });

    // Act
    render(<EmailConnectionCard />);

    // Assert — ask jest checked, info "Domyślnie ustawiono" NIE pojawia się
    await waitFor(() => {
      const askInput = screen.getByTestId(
        "email-open-mode-input-ask",
      ) as HTMLInputElement;
      expect(askInput.checked).toBe(true);
    });
    expect(
      screen.queryByTestId("email-open-mode-default-info"),
    ).not.toBeInTheDocument();
  });

  it("clicking a radio saves the choice to localStorage", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<EmailConnectionCard />);
    await waitFor(() => {
      expect(screen.getByTestId("email-open-mode-input-desktop")).toBeInTheDocument();
    });

    // Act — klik na "desktop"
    await user.click(screen.getByTestId("email-open-mode-input-desktop"));

    // Assert — localStorage zaktualizowany + radio checked
    expect(localStorage.getItem("planning:email-open-mode")).toBe("desktop");
    const desktopInput = screen.getByTestId(
      "email-open-mode-input-desktop",
    ) as HTMLInputElement;
    expect(desktopInput.checked).toBe(true);
  });

  it("default info disappears after user makes explicit choice", async () => {
    // Arrange — brak preferencji → info widoczne
    const user = userEvent.setup();
    render(<EmailConnectionCard />);
    await waitFor(() => {
      expect(screen.getByTestId("email-open-mode-default-info")).toBeInTheDocument();
    });

    // Act — user klika dowolny radio (świadomy wybór)
    await user.click(screen.getByTestId("email-open-mode-input-ask"));

    // Assert — info znika
    expect(
      screen.queryByTestId("email-open-mode-default-info"),
    ).not.toBeInTheDocument();
  });
});

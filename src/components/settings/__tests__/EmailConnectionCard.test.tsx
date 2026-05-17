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
  it("clicking 'Połącz z Microsoft' redirects to /api/v1/ms-oauth/start", async () => {
    // Arrange — zapisz oryginalny location, podmień href setter
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
          // Delegacja do oryginalnego location żeby search/pathname działały
          return Reflect.get(target, prop);
        },
      }),
    });

    try {
      render(<EmailConnectionCard />);
      await waitFor(() => {
        expect(screen.getByTestId("email-connection-connect")).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByTestId("email-connection-connect"));

      // Assert
      expect(hrefSetter).toHaveBeenCalledWith("/api/v1/ms-oauth/start");
    } finally {
      // Cleanup — przywracamy oryginalny location
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

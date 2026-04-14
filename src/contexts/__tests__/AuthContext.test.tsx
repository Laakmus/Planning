/**
 * Tests for AuthProvider / useAuth (src/contexts/AuthContext.tsx).
 *
 * Strategy:
 * - vi.mock('@supabase/supabase-js') → returns a controlled mock client
 * - vi.stubGlobal('fetch', ...) → controls /api/v1/auth/me responses
 * - Renders <AuthProvider> with a child that uses useAuth()
 *
 * Covers:
 * - login() calls signInWithPassword and fetches user profile on success
 * - login() throws when signInWithPassword returns an error
 * - login() throws when profile fetch fails (returns null)
 * - logout() calls supabase.auth.signOut and clears user state
 * - Initial mount: existing session is restored automatically
 * - Initial mount: no session → isLoading becomes false, user stays null
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../AuthContext";
import type { AuthMeDto } from "@/types";

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js
// ---------------------------------------------------------------------------

const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_PROFILE: AuthMeDto = {
  id: "user-uuid-1",
  email: "jan@example.com",
  fullName: "Jan Kowalski",
  phone: null,
  role: "PLANNER",
  username: "testuser",
  isActive: true,
  locationId: null,
};

function makeSuccessfulLoginMock(token = "mock-access-token") {
  mockSignInWithPassword.mockResolvedValue({
    data: { session: { access_token: token }, user: { id: "user-uuid-1" } },
    error: null,
  });
}

function makeFailedLoginMock(errorMessage = "Invalid login credentials") {
  mockSignInWithPassword.mockResolvedValue({
    data: { session: null, user: null },
    error: { message: errorMessage },
  });
}

function makeProfileFetchMock(profile: AuthMeDto | null, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(profile),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeNoSessionMock() {
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
}

function makeExistingSessionMock(token = "existing-token") {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: token } },
    error: null,
  });
}

// Default: onAuthStateChange returns unsubscribe function, no immediate event
function setupDefaultAuthStateChange() {
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

// ---------------------------------------------------------------------------
// Test component: exposes context values via data-testid
// ---------------------------------------------------------------------------

function TestConsumer({ onLogin }: { onLogin?: (login: (e: string, p: string) => Promise<void>) => void }) {
  const { user, isLoading, login, logout } = useAuth();

  // Pass login fn up to the test
  if (onLogin) {
    onLogin(login);
  }

  return (
    <div>
      <span data-testid="loading">{isLoading ? "loading" : "ready"}</span>
      <span data-testid="user">{user ? user.email : "null"}</span>
      <button
        onClick={async () => {
          await login("jan@example.com", "secret");
        }}
      >
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider supabaseUrl="https://test.supabase.co" supabaseAnonKey="test-anon-key">
      <TestConsumer />
    </AuthProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

// Patch window.location once at module level so assignments don't throw in jsdom.
// jsdom does not support navigation; we just need the property to be settable.
const locationDescriptor = Object.getOwnPropertyDescriptor(window, "location");
if (!locationDescriptor || locationDescriptor.configurable) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "/", origin: "http://localhost:4321" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultAuthStateChange();
  makeNoSessionMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuthProvider — initial mount", () => {
  it("starts with isLoading=true and user=null, then resolves to ready", async () => {
    makeNoSessionMock();
    makeProfileFetchMock(null);

    renderWithProvider();

    // isLoading starts true
    expect(screen.getByTestId("loading").textContent).toBe("loading");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("restores user from existing session on mount", async () => {
    makeExistingSessionMock("existing-token");
    makeProfileFetchMock(MOCK_PROFILE);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("jan@example.com");
    });
  });

  it("leaves user null when session exists but profile fetch fails", async () => {
    makeExistingSessionMock("token");
    makeProfileFetchMock(null, false); // ok: false → profile = null

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});

// TODO (AUTH-MIG Faza C — tester): przepisać testy login() na nowy flow
// (POST /api/v1/auth/login zamiast signInWithPassword + /auth/me).
// Testy wyłączone bo testują stary email-based flow usunięty w Fazie A3.
describe.skip("AuthProvider — login() [DEPRECATED — requires rewrite for username flow]", () => {
  it("calls signInWithPassword with provided credentials", async () => {
    makeSuccessfulLoginMock();
    makeProfileFetchMock(MOCK_PROFILE);

    renderWithProvider();
    await waitFor(() => screen.getByTestId("loading").textContent === "ready");

    await act(async () => {
      await userEvent.click(screen.getByText("Login"));
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "jan@example.com",
      password: "secret",
    });
  });

  it("fetches user profile with the returned token after successful signIn", async () => {
    makeSuccessfulLoginMock("my-jwt");
    const fetchMock = makeProfileFetchMock(MOCK_PROFILE);

    renderWithProvider();
    await waitFor(() => screen.getByTestId("loading").textContent === "ready");

    await act(async () => {
      await userEvent.click(screen.getByText("Login"));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-jwt",
        }),
      }),
    );
  });

  it("sets user state after successful login", async () => {
    makeSuccessfulLoginMock();
    makeProfileFetchMock(MOCK_PROFILE);

    renderWithProvider();
    await waitFor(() => screen.getByTestId("loading").textContent === "ready");

    await act(async () => {
      await userEvent.click(screen.getByText("Login"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("jan@example.com");
    });
  });

  it("throws when signInWithPassword returns an error", async () => {
    makeFailedLoginMock("Invalid login credentials");
    makeProfileFetchMock(null);

    let caughtError: Error | null = null;

    function ErrorCapture() {
      const { login } = useAuth();
      return (
        <button
          onClick={async () => {
            try {
              await login("bad@example.com", "wrong");
            } catch (e) {
              caughtError = e as Error;
            }
          }}
        >
          TryLogin
        </button>
      );
    }

    render(
      <AuthProvider supabaseUrl="https://test.supabase.co" supabaseAnonKey="test-anon-key">
        <ErrorCapture />
      </AuthProvider>,
    );

    await waitFor(() => {}); // let mount settle

    await act(async () => {
      await userEvent.click(screen.getByText("TryLogin"));
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toMatch(/Nieprawidłowy login lub hasło/);
  });

  it("throws when profile fetch returns null (profile not found)", async () => {
    makeSuccessfulLoginMock();
    makeProfileFetchMock(null, false); // ok: false, returns null

    let caughtError: Error | null = null;

    function ErrorCapture() {
      const { login } = useAuth();
      return (
        <button
          onClick={async () => {
            try {
              await login("jan@example.com", "secret");
            } catch (e) {
              caughtError = e as Error;
            }
          }}
        >
          TryLogin
        </button>
      );
    }

    render(
      <AuthProvider supabaseUrl="https://test.supabase.co" supabaseAnonKey="test-anon-key">
        <ErrorCapture />
      </AuthProvider>,
    );

    await waitFor(() => {}); // let mount settle

    await act(async () => {
      await userEvent.click(screen.getByText("TryLogin"));
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toMatch(/profilu użytkownika/);
  });
});

describe("AuthProvider — logout()", () => {
  it("calls supabase.auth.signOut on logout", async () => {
    makeNoSessionMock();
    mockSignOut.mockResolvedValue({});

    renderWithProvider();
    await waitFor(() => screen.getByTestId("loading").textContent === "ready");

    await act(async () => {
      await userEvent.click(screen.getByText("Logout"));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("clears user state after logout", async () => {
    // Start with a logged-in state
    makeExistingSessionMock("existing-token");
    makeProfileFetchMock(MOCK_PROFILE);
    mockSignOut.mockResolvedValue({});

    renderWithProvider();
    await waitFor(() => screen.getByTestId("user").textContent === "jan@example.com");

    await act(async () => {
      await userEvent.click(screen.getByText("Logout"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });
});

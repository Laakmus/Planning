/**
 * Testy dla GET /api/v1/dictionary-sync/jobs/{jobId} — status zadania synchronizacji.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 400 nieprawidłowy UUID jobId
 * - 400 brak jobId (undefined)
 * - 200 sukces (happy path — zwraca stub ze statusem STARTED)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  isValidUUID: vi.fn(),
}));

import { GET } from "../../jobs/[jobId]";
import * as apiHelpers from "@/lib/api-helpers";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-uuid-1",
  email: "test@test.pl",
  fullName: "Test User",
  phone: null,
  role: "PLANNER" as const,
  username: "testuser",
  isActive: true,
  locationId: null,
};

const VALID_JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

type AnyAPIContext = Parameters<typeof GET>[0];

function makeContext(overrides?: {
  params?: Record<string, string | undefined>;
}): AnyAPIContext {
  const jobId = overrides?.params?.jobId ?? VALID_JOB_ID;
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request(
      `http://localhost:4321/api/v1/dictionary-sync/jobs/${jobId}`,
      { method: "GET" }
    ),
    params: { jobId, ...overrides?.params },
    url: new URL(`http://localhost:4321/api/v1/dictionary-sync/jobs/${jobId}`),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as AnyAPIContext["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: "/api/v1/dictionary-sync/jobs/[jobId]",
    originPathname: `/api/v1/dictionary-sync/jobs/${jobId}`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockErrorResponse.mockImplementation(
    (statusCode: number, error: string, message: string, details?: unknown) =>
      new Response(JSON.stringify({ error, message, statusCode, details }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      })
  );
  mockJsonResponse.mockImplementation(
    (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      })
  );

  // Domyślne zachowanie — zalogowany użytkownik z poprawnym UUID
  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockIsValidUUID.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("GET /api/v1/dictionary-sync/jobs/{jobId}", () => {
  it("returns 401 when not authenticated", async () => {
    // Niezalogowany użytkownik
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await GET(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 400 when jobId is not a valid UUID", async () => {
    // Nieprawidłowy format UUID
    mockIsValidUUID.mockReturnValue(false);

    const response = await GET(makeContext({ params: { jobId: "not-a-uuid" } }));

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      "Nieprawidłowy identyfikator zadania (UUID)."
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when jobId is undefined", async () => {
    // Brak parametru jobId
    mockIsValidUUID.mockReturnValue(false);

    const response = await GET(makeContext({ params: { jobId: undefined } }));

    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      "Nieprawidłowy identyfikator zadania (UUID)."
    );
    expect(response.status).toBe(400);
  });

  it("returns 200 with job status on success", async () => {
    // Pomyślne pobranie statusu zadania (stub — zawsze STARTED)
    const response = await GET(makeContext());

    expect(mockJsonResponse).toHaveBeenCalledWith(
      {
        jobId: VALID_JOB_ID,
        status: "STARTED",
        startedAt: expect.any(String),
        completedAt: null,
      },
      200
    );
    expect(response.status).toBe(200);
  });

  it("returns correct jobId in response matching the param", async () => {
    // Sprawdzenie, że jobId w odpowiedzi odpowiada parametrowi z URL
    const customJobId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    mockIsValidUUID.mockReturnValue(true);

    const response = await GET(makeContext({ params: { jobId: customJobId } }));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: customJobId }),
      200
    );
    expect(response.status).toBe(200);
  });
});

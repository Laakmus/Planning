/**
 * Testy dla POST /api/v1/warehouse/report/pdf.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 403 brak locationId
 * - 400 nieprawidłowy body JSON
 * - 400 Zod validation fail
 * - 200 happy path (z locationId w body)
 * - 200 happy path (fallback na authResult.locationId)
 * - 500 błąd serwera
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  requireWriteAccess: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
  COMMON_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  },
}));

vi.mock("@/lib/services/warehouse.service", () => ({
  getWarehouseWeekOrders: vi.fn(),
}));

vi.mock("@/lib/services/pdf/warehouse-pdf-generator.service", () => ({
  generateWarehouseReportPdf: vi.fn(),
}));

vi.mock("@/lib/validators/warehouse-report.validator", () => ({
  warehouseReportPdfSchema: { safeParse: vi.fn() },
  warehouseReportSendEmailSchema: { safeParse: vi.fn() },
}));

import { POST } from "../pdf";
import * as apiHelpers from "@/lib/api-helpers";
import * as warehouseService from "@/lib/services/warehouse.service";
import * as pdfGenerator from "@/lib/services/pdf/warehouse-pdf-generator.service";
import * as warehouseValidator from "@/lib/validators/warehouse-report.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockGetWarehouseWeekOrders = vi.mocked(warehouseService.getWarehouseWeekOrders);
const mockGeneratePdf = vi.mocked(pdfGenerator.generateWarehouseReportPdf);
const mockPdfSchema = vi.mocked(warehouseValidator.warehouseReportPdfSchema);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-uuid-1",
  email: "test@test.pl",
  fullName: "Test User",
  phone: null,
  role: "PLANNER" as const,
  locationId: "loc-uuid-1",
};

const LOCATION_ID = "loc-uuid-1";

type AnyAPIContext = Parameters<typeof POST>[0];

// Pomocnicze mocki Supabase
function createSupabaseMock(locationData: { name: string } | null = { name: "Magazyn Nord" }) {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: locationData, error: null });
  const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  return { from: mockFrom, _mocks: { from: mockFrom, select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle } };
}

function makeContext(bodyText = '{"week":10,"year":2026}', overrides?: {
  supabase?: ReturnType<typeof createSupabaseMock>;
}): AnyAPIContext {
  const supabase = overrides?.supabase ?? createSupabaseMock();
  return {
    locals: { supabase },
    request: new Request("http://localhost:4321/api/v1/warehouse/report/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
    }),
    params: {},
    url: new URL("http://localhost:4321/api/v1/warehouse/report/pdf"),
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
    routePattern: "/api/v1/warehouse/report/pdf",
    originPathname: "/api/v1/warehouse/report/pdf",
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
    (statusCode: number, error: string, message: string) =>
      new Response(JSON.stringify({ error, message, statusCode }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      })
  );

  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockRequireWriteAccess.mockReturnValue(null as never);

  // Domyślnie schemat przechodzi
  mockPdfSchema.safeParse.mockReturnValue({
    success: true,
    data: { week: 10, year: 2026, locationId: LOCATION_ID },
  } as unknown as ReturnType<typeof warehouseValidator.warehouseReportPdfSchema.safeParse>);

  // Domyślne dane z serwisu
  mockGetWarehouseWeekOrders.mockResolvedValue({
    locationName: "Magazyn Nord",
    week: 10,
    year: 2026,
    days: [],
  } as never);

  // Domyślny PDF buffer
  mockGeneratePdf.mockReturnValue(new TextEncoder().encode("fake-pdf-content").buffer as ArrayBuffer);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/warehouse/report/pdf", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireWriteAccess returns error", async () => {
    mockRequireWriteAccess.mockReturnValue(new Response(null, { status: 403 }) as never);

    const response = await POST(makeContext());
    expect(response.status).toBe(403);
  });

  it("returns 400 when body JSON is malformed", async () => {
    const response = await POST(makeContext("{invalid json}"));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 400 when Zod validation fails", async () => {
    mockPdfSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["week"], message: "Required" }],
      },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportPdfSchema.safeParse>);

    const response = await POST(makeContext('{"week":"abc"}'));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 403 when no locationId in body nor in user", async () => {
    // Użytkownik bez locationId + body bez locationId
    mockGetAuth.mockResolvedValue({ ...MOCK_USER, locationId: null });
    mockPdfSchema.safeParse.mockReturnValue({
      success: true,
      data: { week: 10, year: 2026 },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportPdfSchema.safeParse>);

    const response = await POST(makeContext('{"week":10,"year":2026}'));

    expect(mockErrorResponse).toHaveBeenCalledWith(403, "Forbidden", expect.any(String));
    expect(response.status).toBe(403);
  });

  it("returns 200 with PDF blob on success", async () => {
    const response = await POST(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("plan-zaladunkowy-");
    expect(response.headers.get("Content-Disposition")).toContain(".pdf");

    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it("uses authResult.locationId as fallback when body has no locationId", async () => {
    // Body bez locationId, ale user ma locationId
    mockPdfSchema.safeParse.mockReturnValue({
      success: true,
      data: { week: 10, year: 2026 },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportPdfSchema.safeParse>);

    const response = await POST(makeContext('{"week":10,"year":2026}'));

    expect(response.status).toBe(200);
    // Serwis powinien zostać wywołany z locationId z usera
    expect(mockGetWarehouseWeekOrders).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.locationId,
      10,
      2026,
      expect.any(String),
    );
  });

  it("returns 500 on generic server error", async () => {
    mockGetWarehouseWeekOrders.mockRejectedValue(new Error("DB connection failed"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("handles empty body gracefully (uses default empty object)", async () => {
    // Puste body — handler parsuje jako {}
    mockPdfSchema.safeParse.mockReturnValue({
      success: true,
      data: { week: 10, year: 2026, locationId: LOCATION_ID },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportPdfSchema.safeParse>);

    const response = await POST(makeContext(""));
    expect(response.status).toBe(200);
  });
});

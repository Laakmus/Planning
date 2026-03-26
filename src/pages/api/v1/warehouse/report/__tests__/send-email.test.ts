/**
 * Testy dla POST /api/v1/warehouse/report/send-email.
 *
 * Pokrywa:
 * - 401 niezalogowany
 * - 403 READ_ONLY
 * - 403 brak locationId
 * - 400 nieprawidłowy body JSON
 * - 400 Zod validation fail
 * - 422 brak odbiorców
 * - 200 happy path (format eml)
 * - 200 happy path (format pdf-base64)
 * - 500 błąd zapytania odbiorców
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

vi.mock("@/lib/services/eml/eml-builder.service", () => ({
  buildEmlWithPdfAttachment: vi.fn(),
}));

vi.mock("@/lib/validators/warehouse-report.validator", () => ({
  warehouseReportPdfSchema: { safeParse: vi.fn() },
  warehouseReportSendEmailSchema: { safeParse: vi.fn() },
}));

import { POST } from "../send-email";
import * as apiHelpers from "@/lib/api-helpers";
import * as warehouseService from "@/lib/services/warehouse.service";
import * as pdfGenerator from "@/lib/services/pdf/warehouse-pdf-generator.service";
import * as emlBuilder from "@/lib/services/eml/eml-builder.service";
import * as warehouseValidator from "@/lib/validators/warehouse-report.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockGetWarehouseWeekOrders = vi.mocked(warehouseService.getWarehouseWeekOrders);
const mockGeneratePdf = vi.mocked(pdfGenerator.generateWarehouseReportPdf);
const mockBuildEml = vi.mocked(emlBuilder.buildEmlWithPdfAttachment);
const mockSendEmailSchema = vi.mocked(warehouseValidator.warehouseReportSendEmailSchema);

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

const MOCK_RECIPIENTS = [
  { id: "r1", email: "jan@example.com", name: "Jan Kowalski" },
  { id: "r2", email: "anna@example.com", name: "Anna Nowak" },
];

type AnyAPIContext = Parameters<typeof POST>[0];

/**
 * Tworzenie mocka Supabase rozróżniającego tabele.
 * locations -> maybeSingle, warehouse_report_recipients -> tablica
 */
function createSupabaseMock(opts?: {
  locationData?: { name: string } | null;
  recipientsData?: typeof MOCK_RECIPIENTS | null;
  recipientsError?: unknown;
}) {
  const locationData = opts?.locationData ?? { name: "Magazyn Nord" };
  const recipientsData = opts?.recipientsData ?? MOCK_RECIPIENTS;
  const recipientsError = opts?.recipientsError ?? null;

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "locations") {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: locationData, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      return { select: mockSelect };
    }
    if (table === "warehouse_report_recipients") {
      const mockEq = vi.fn().mockResolvedValue({ data: recipientsData, error: recipientsError });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      return { select: mockSelect };
    }
    return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
  });

  return { from: mockFrom };
}

function makeContext(bodyText = '{"week":10,"year":2026}', overrides?: {
  supabase?: ReturnType<typeof createSupabaseMock>;
}): AnyAPIContext {
  const supabase = overrides?.supabase ?? createSupabaseMock();
  return {
    locals: { supabase },
    request: new Request("http://localhost:4321/api/v1/warehouse/report/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
    }),
    params: {},
    url: new URL("http://localhost:4321/api/v1/warehouse/report/send-email"),
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
    routePattern: "/api/v1/warehouse/report/send-email",
    originPathname: "/api/v1/warehouse/report/send-email",
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

  // Domyślnie schemat przechodzi (format eml)
  mockSendEmailSchema.safeParse.mockReturnValue({
    success: true,
    data: { week: 10, year: 2026, locationId: LOCATION_ID, outputFormat: "eml" },
  } as unknown as ReturnType<typeof warehouseValidator.warehouseReportSendEmailSchema.safeParse>);

  // Domyślne dane z serwisu
  mockGetWarehouseWeekOrders.mockResolvedValue({
    locationName: "Magazyn Nord",
    week: 10,
    year: 2026,
    days: [],
  } as never);

  // Domyślny PDF buffer
  mockGeneratePdf.mockReturnValue(new TextEncoder().encode("fake-pdf-content").buffer as ArrayBuffer);

  // Domyślny EML
  mockBuildEml.mockReturnValue("MIME-Version: 1.0\r\nX-Unsent: 1\r\n\r\nmock-eml");
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/warehouse/report/send-email", () => {
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
    mockSendEmailSchema.safeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["week"], message: "Required" }],
      },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportSendEmailSchema.safeParse>);

    const response = await POST(makeContext('{"week":"abc"}'));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("returns 403 when no locationId in body nor in user", async () => {
    mockGetAuth.mockResolvedValue({ ...MOCK_USER, locationId: null });
    mockSendEmailSchema.safeParse.mockReturnValue({
      success: true,
      data: { week: 10, year: 2026, outputFormat: "eml" },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportSendEmailSchema.safeParse>);

    const response = await POST(makeContext('{"week":10,"year":2026}'));

    expect(mockErrorResponse).toHaveBeenCalledWith(403, "Forbidden", expect.any(String));
    expect(response.status).toBe(403);
  });

  it("returns 422 when no recipients configured for location", async () => {
    const supabase = createSupabaseMock({ recipientsData: [] });

    const response = await POST(makeContext('{"week":10,"year":2026}', { supabase }));

    expect(mockErrorResponse).toHaveBeenCalledWith(422, "Unprocessable Entity", expect.any(String));
    expect(response.status).toBe(422);
  });

  it("returns 200 with .eml blob on success (eml format)", async () => {
    const response = await POST(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("message/rfc822");
    expect(response.headers.get("Content-Disposition")).toContain(".eml");
    expect(response.headers.get("Content-Disposition")).toContain("plan-zaladunkowy-");

    const body = await response.text();
    expect(body).toContain("X-Unsent: 1");

    // Sprawdź że buildEml został wywołany
    expect(mockBuildEml).toHaveBeenCalledOnce();
    const callArgs = mockBuildEml.mock.calls[0][0];
    expect(callArgs.pdfFileName).toContain(".pdf");
    expect(callArgs.subject).toContain("Magazyn Nord");
    expect(callArgs.to).toContain("@");
    expect(callArgs.body).toBeTruthy();
  });

  it("returns 200 with JSON on success (pdf-base64 format)", async () => {
    mockSendEmailSchema.safeParse.mockReturnValue({
      success: true,
      data: { week: 10, year: 2026, locationId: LOCATION_ID, outputFormat: "pdf-base64" },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportSendEmailSchema.safeParse>);

    const response = await POST(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const json = await response.json();
    expect(json).toHaveProperty("pdfBase64");
    expect(json).toHaveProperty("pdfFileName");
    expect(json).toHaveProperty("recipients");
    expect(json.recipients).toHaveLength(2);
    expect(json.recipients[0]).toHaveProperty("email");
    expect(json.recipients[0]).toHaveProperty("name");

    // pdfBase64 powinien być prawidłowym base64
    const decoded = Buffer.from(json.pdfBase64, "base64").toString();
    expect(decoded).toBe("fake-pdf-content");
  });

  it("returns 500 when recipients query fails", async () => {
    const supabase = createSupabaseMock({ recipientsError: { message: "DB error" } });

    const response = await POST(makeContext('{"week":10,"year":2026}', { supabase }));

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("returns 500 on generic server error", async () => {
    mockGetWarehouseWeekOrders.mockRejectedValue(new Error("Unexpected error"));

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
    expect(response.status).toBe(500);
  });

  it("handles empty body gracefully", async () => {
    mockSendEmailSchema.safeParse.mockReturnValue({
      success: true,
      data: { week: 10, year: 2026, locationId: LOCATION_ID, outputFormat: "eml" },
    } as unknown as ReturnType<typeof warehouseValidator.warehouseReportSendEmailSchema.safeParse>);

    const response = await POST(makeContext(""));
    expect(response.status).toBe(200);
  });
});

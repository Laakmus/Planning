/**
 * Testy dla POST /api/v1/orders/{orderId}/pdf — generowanie PDF zlecenia.
 *
 * Pokrywa:
 * - 401 brak autoryzacji
 * - 400 nieprawidłowy UUID / brak parametru
 * - 404 zlecenie nie znalezione
 * - 200 sukces (Content-Type, Content-Disposition, body Buffer)
 * - 500 błąd wewnętrzny
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocki modułów
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  errorResponse: vi.fn(),
  isValidUUID: vi.fn(),
  logError: vi.fn(),
  COMMON_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  },
}));

vi.mock("@/lib/services/order.service", () => ({
  getOrderDetail: vi.fn(),
}));

vi.mock("@/lib/services/pdf/pdf-generator.service", () => ({
  generateOrderPdf: vi.fn(),
}));

import { POST } from "../pdf";
import * as apiHelpers from "@/lib/api-helpers";
import * as orderService from "@/lib/services/order.service";
import * as pdfService from "@/lib/services/pdf/pdf-generator.service";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);
const mockLogError = vi.mocked(apiHelpers.logError);
const mockGetOrderDetail = vi.mocked(orderService.getOrderDetail);
const mockGenerateOrderPdf = vi.mocked(pdfService.generateOrderPdf);

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-uuid-1",
  email: "test@test.pl",
  fullName: "Test User",
  phone: null,
  role: "PLANNER" as const,
  locationId: null,
};

const VALID_ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

const MOCK_ORDER_DETAIL = {
  order: {
    id: VALID_ORDER_ID,
    orderNo: "ZT2026/0001",
    createdAt: "2026-01-15T10:30:00Z",
    carrierCompanyId: "carrier-uuid",
    carrierNameSnapshot: "Transport Sp. z o.o.",
    carrierAddressSnapshot: "ul. Testowa 1, 00-001 Warszawa",
    vehicleTypeText: "FIRANKA",
    vehicleCapacityVolumeM3: 90,
    priceAmount: 5000,
    currencyCode: "PLN",
    paymentTermDays: 30,
    paymentMethod: "przelew",
    requiredDocumentsText: "WZ, KPO",
    generalNotes: "Uwagi testowe",
    confidentialityClause: null,
    senderContactName: "Jan Kowalski",
    senderContactEmail: "jan@test.pl",
    senderContactPhone: "123456789",
  },
  stops: [
    { locationId: "loc-1", kind: "LOADING", companyNameSnapshot: "Firma A", addressSnapshot: "Adres A" },
    { locationId: "loc-2", kind: "UNLOADING", companyNameSnapshot: "Firma B", addressSnapshot: "Adres B" },
  ],
  items: [
    { productNameSnapshot: "Produkt A", loadingMethodCode: "PALETA", notes: null },
  ],
};

const MOCK_PDF_BUFFER = new ArrayBuffer(20); // mock PDF content

// Mock supabase z łańcuchem from().select().eq().maybeSingle() i from().select().in()
function makeMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { tax_id: "1234567890" }, error: null }),
  };
  // Dla zapytania locations (in) — zwróć dane krajów
  chain.in.mockResolvedValue({
    data: [
      { id: "loc-1", country: "PL" },
      { id: "loc-2", country: "DE" },
    ],
    error: null,
  });
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

function makeContext(overrides?: { orderId?: string }): Parameters<typeof POST>[0] {
  const orderId = overrides?.orderId ?? VALID_ORDER_ID;
  const mockSupabase = makeMockSupabase();
  return {
    locals: { supabase: mockSupabase },
    request: new Request(`http://localhost:4321/api/v1/orders/${orderId}/pdf`, { method: "POST" }),
    params: { orderId },
    url: new URL(`http://localhost:4321/api/v1/orders/${orderId}/pdf`),
    redirect: vi.fn(),
    rewrite: vi.fn(),
    props: {},
    cookies: {} as Parameters<typeof POST>[0]["cookies"],
    site: new URL("http://localhost:4321"),
    generator: "astro",
    preferredLocale: undefined,
    preferredLocaleList: [],
    currentLocale: undefined,
    getActionResult: vi.fn(),
    callAction: vi.fn(),
    routePattern: "/api/v1/orders/[orderId]/pdf",
    originPathname: `/api/v1/orders/${orderId}/pdf`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as Parameters<typeof POST>[0];
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

  // Domyślne wartości — happy path
  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockIsValidUUID.mockReturnValue(true);
  mockGetOrderDetail.mockResolvedValue(MOCK_ORDER_DETAIL as never);
  mockGenerateOrderPdf.mockReturnValue(MOCK_PDF_BUFFER);
});

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("POST /api/v1/orders/{orderId}/pdf", () => {
  it("zwraca 401 gdy brak autoryzacji", async () => {
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST(makeContext());
    expect(response.status).toBe(401);
    expect(mockGetOrderDetail).not.toHaveBeenCalled();
  });

  it("zwraca 400 gdy orderId nie jest UUID", async () => {
    mockIsValidUUID.mockReturnValue(false);

    const response = await POST(makeContext({ orderId: "not-a-uuid" }));

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
    expect(mockGetOrderDetail).not.toHaveBeenCalled();
  });

  it("zwraca 400 gdy brakuje parametru orderId", async () => {
    mockIsValidUUID.mockReturnValue(false);
    const ctx = makeContext();
    (ctx as unknown as Record<string, unknown>).params = {};

    const response = await POST(ctx);

    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
    expect(response.status).toBe(400);
  });

  it("zwraca 404 gdy zlecenie nie znalezione", async () => {
    mockGetOrderDetail.mockResolvedValue(null as never);

    const response = await POST(makeContext());

    expect(mockErrorResponse).toHaveBeenCalledWith(404, "Not Found", expect.any(String));
    expect(response.status).toBe(404);
  });

  it("zwraca 200 z PDF przy sukcesie", async () => {
    const response = await POST(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");

    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("zlecenie-ZT2026-0001.pdf");

    // Weryfikacja body
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it("sanityzuje orderNo w nazwie pliku (usuwa /)", async () => {
    mockGetOrderDetail.mockResolvedValue({
      ...MOCK_ORDER_DETAIL,
      order: { ...MOCK_ORDER_DETAIL.order, orderNo: 'ZT/2026/001"test' },
    } as never);

    const response = await POST(makeContext());
    const disposition = response.headers.get("Content-Disposition");

    // / i " powinny być zastąpione -
    expect(disposition).not.toContain("/");
    expect(disposition).not.toContain('"ZT');
  });

  it("wywołuje generateOrderPdf z poprawnymi danymi", async () => {
    await POST(makeContext());

    expect(mockGenerateOrderPdf).toHaveBeenCalledOnce();
    const args = mockGenerateOrderPdf.mock.calls[0][0];

    expect(args.order.orderNo).toBe("ZT2026/0001");
    expect(args.order.carrierName).toBe("Transport Sp. z o.o.");
    expect(args.stops).toHaveLength(2);
    expect(args.items).toHaveLength(1);
  });

  it("pobiera NIP firmy transportowej z companies", async () => {
    const ctx = makeContext();
    await POST(ctx);

    // Sprawdź że from("companies") zostało wywołane
    expect(ctx.locals.supabase.from).toHaveBeenCalledWith("companies");
  });

  it("pomija pobieranie NIP gdy brak carrierCompanyId", async () => {
    mockGetOrderDetail.mockResolvedValue({
      ...MOCK_ORDER_DETAIL,
      order: { ...MOCK_ORDER_DETAIL.order, carrierCompanyId: null },
      stops: [],
    } as never);

    const ctx = makeContext();
    await POST(ctx);

    // from("companies") NIE powinno być wywołane
    const fromCalls = (ctx.locals.supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    const companiesCalls = fromCalls.filter((c: string[]) => c[0] === "companies");
    expect(companiesCalls).toHaveLength(0);
  });

  it("zwraca 500 i loguje błąd gdy generateOrderPdf rzuca wyjątek", async () => {
    mockGenerateOrderPdf.mockImplementation(() => {
      throw new Error("PDF generation failed");
    });

    const response = await POST(makeContext());

    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalledWith(
      "[POST /api/v1/orders/{orderId}/pdf]",
      expect.any(Error)
    );
    expect(mockErrorResponse).toHaveBeenCalledWith(500, "Internal Server Error", expect.any(String));
  });

  it("zwraca 500 gdy getOrderDetail rzuca wyjątek", async () => {
    mockGetOrderDetail.mockRejectedValue(new Error("DB connection failed"));

    const response = await POST(makeContext());

    expect(response.status).toBe(500);
    expect(mockLogError).toHaveBeenCalledOnce();
  });
});

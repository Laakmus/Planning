/**
 * Testy dla POST /api/v1/orders/{orderId}/prepare-email-graph.
 *
 * Pokrycie:
 * - 401 brak auth
 * - 403 READ_ONLY (requireWriteAccess)
 * - 400 invalid UUID
 * - 400 niepoprawny body JSON
 * - 412 MS_NOT_CONNECTED (getValidAccessToken rzuca)
 * - 412 MS_REFRESH_FAILED
 * - 404 prepareEmailForOrder zwraca null (brak zlecenia)
 * - 422 missing fields (prepareEmailForOrder zwraca success:false)
 * - 400 NOT_ALLOWED_STATUS
 * - 409 STATUS_CHANGED
 * - 200 happy path → zwraca {draftId, webLink}
 * - 500 błąd ogólny
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-helpers", () => ({
  getAuthenticatedUser: vi.fn(),
  jsonResponse: vi.fn(),
  errorResponse: vi.fn(),
  logError: vi.fn(),
  requireWriteAccess: vi.fn(),
  isValidUUID: vi.fn(),
}));

vi.mock("@/lib/services/ms-graph.service", () => ({
  getValidAccessToken: vi.fn(),
  createDraftEmail: vi.fn(),
}));

vi.mock("@/lib/services/order.service", () => ({
  prepareEmailForOrder: vi.fn(),
}));

vi.mock("@/lib/services/order-detail.service", () => ({
  getOrderDetail: vi.fn(),
}));

vi.mock("@/lib/services/email-content.service", () => ({
  buildOrderEmailContent: vi.fn(),
}));

vi.mock("@/lib/validators/ms-oauth.validator", () => ({
  prepareEmailGraphSchema: {
    safeParse: vi.fn(),
  },
}));

import { POST } from "../prepare-email-graph";
import * as apiHelpers from "@/lib/api-helpers";
import * as msGraph from "@/lib/services/ms-graph.service";
import * as orderService from "@/lib/services/order.service";
import * as orderDetail from "@/lib/services/order-detail.service";
import * as emailContent from "@/lib/services/email-content.service";
import * as validator from "@/lib/validators/ms-oauth.validator";

const mockGetAuth = vi.mocked(apiHelpers.getAuthenticatedUser);
const mockJsonResponse = vi.mocked(apiHelpers.jsonResponse);
const mockErrorResponse = vi.mocked(apiHelpers.errorResponse);
const mockRequireWriteAccess = vi.mocked(apiHelpers.requireWriteAccess);
const mockIsValidUUID = vi.mocked(apiHelpers.isValidUUID);

const mockGetValidAccessToken = vi.mocked(msGraph.getValidAccessToken);
const mockCreateDraftEmail = vi.mocked(msGraph.createDraftEmail);
const mockPrepareEmail = vi.mocked(orderService.prepareEmailForOrder);
const mockGetOrderDetail = vi.mocked(orderDetail.getOrderDetail);
const mockBuildEmailContent = vi.mocked(emailContent.buildOrderEmailContent);
const mockSchema = validator.prepareEmailGraphSchema as unknown as {
  safeParse: ReturnType<typeof vi.fn>;
};

const MOCK_USER = {
  id: "user-uuid-1",
  email: "p@test.pl",
  fullName: "Planner",
  phone: null,
  role: "PLANNER" as const,
  username: "p",
  isActive: true,
  locationId: null,
};

const VALID_ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

type AnyAPIContext = Parameters<typeof POST>[0];

function makeContext(overrides?: {
  params?: Record<string, string>;
  body?: string;
}): AnyAPIContext {
  return {
    locals: { supabase: { from: vi.fn() } },
    request: new Request(
      `http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/prepare-email-graph`,
      {
        method: "POST",
        body: overrides?.body ?? "{}",
        headers: { "Content-Type": "application/json" },
      }
    ),
    params: { orderId: VALID_ORDER_ID, ...overrides?.params },
    url: new URL(
      `http://localhost:4321/api/v1/orders/${VALID_ORDER_ID}/prepare-email-graph`
    ),
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
    routePattern: "/api/v1/orders/[orderId]/prepare-email-graph",
    originPathname: `/api/v1/orders/${VALID_ORDER_ID}/prepare-email-graph`,
    isPrerendered: false,
    clientAddress: "127.0.0.1",
  } as unknown as AnyAPIContext;
}

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

  // Defaults
  mockGetAuth.mockResolvedValue(MOCK_USER);
  mockRequireWriteAccess.mockReturnValue(null as never);
  mockIsValidUUID.mockReturnValue(true);
  mockSchema.safeParse.mockReturnValue({ success: true, data: {} });
  mockGetValidAccessToken.mockResolvedValue("AT_VALID");
  mockPrepareEmail.mockResolvedValue({
    success: true,
    format: "pdf-base64",
    pdfBase64: "QUJD",
    pdfFileName: "zlecenie-ZT/2026/001.pdf",
    orderNo: "ZT/2026/001",
    emailSubject: "subj",
  } as never);
  mockGetOrderDetail.mockResolvedValue({
    order: { orderNo: "ZT/2026/001" },
    stops: [],
  } as never);
  mockBuildEmailContent.mockResolvedValue({
    to: "",
    subject: "subj",
    bodyHtml: "<p>x</p>",
    attachmentBase64: "QUJD",
    attachmentFilename: "zlecenie-ZT-2026-001.pdf",
    orderNo: "ZT/2026/001",
  });
  mockCreateDraftEmail.mockResolvedValue({
    draftId: "DRAFT-123",
    webLink: "https://outlook.office.com/deeplink/compose?ItemID=DRAFT-123",
  });
});

describe("POST /api/v1/orders/{orderId}/prepare-email-graph", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    mockGetAuth.mockResolvedValue(new Response(null, { status: 401 }));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(401);
    expect(mockCreateDraftEmail).not.toHaveBeenCalled();
  });

  it("returns 403 for READ_ONLY", async () => {
    // Arrange
    mockRequireWriteAccess.mockReturnValue(
      new Response(null, { status: 403 }) as never
    );

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(403);
  });

  it("returns 400 when UUID is invalid", async () => {
    // Arrange
    mockIsValidUUID.mockReturnValue(false);

    // Act
    const response = await POST(makeContext({ params: { orderId: "bad-uuid" } }));

    // Assert
    expect(response.status).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(400, "Bad Request", expect.any(String));
  });

  it("returns 400 when body is invalid JSON", async () => {
    // Arrange — body który nie jest JSON ale jest niepusty
    const response = await POST(makeContext({ body: "{not-json" }));

    // Assert
    expect(response.status).toBe(400);
  });

  it("returns 412 MS_NOT_CONNECTED when getValidAccessToken throws MS_NOT_CONNECTED", async () => {
    // Arrange
    mockGetValidAccessToken.mockRejectedValue(new Error("MS_NOT_CONNECTED"));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(412);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      412,
      "Precondition Failed",
      expect.any(String),
      { code: "MS_NOT_CONNECTED" }
    );
    // Status zlecenia NIE zmieniony
    expect(mockPrepareEmail).not.toHaveBeenCalled();
  });

  it("returns 412 when getValidAccessToken throws MS_REFRESH_FAILED", async () => {
    // Arrange
    mockGetValidAccessToken.mockRejectedValue(new Error("MS_REFRESH_FAILED"));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(412);
  });

  it("returns 404 when prepareEmailForOrder returns null (order not found)", async () => {
    // Arrange
    mockPrepareEmail.mockResolvedValue(null as never);

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(404);
  });

  it("returns 422 with missing fields when prepareEmailForOrder fails validation", async () => {
    // Arrange
    mockPrepareEmail.mockResolvedValue({
      success: false,
      validationErrors: ["carrierName", "rate"],
    } as never);

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(422);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      422,
      "Unprocessable Entity",
      expect.any(String),
      { missing: ["carrierName", "rate"] }
    );
  });

  it("returns 400 NOT_ALLOWED_STATUS when prepareEmailForOrder throws this error", async () => {
    // Arrange
    mockPrepareEmail.mockRejectedValue(new Error("NOT_ALLOWED_STATUS"));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      400,
      "Bad Request",
      expect.any(String)
    );
  });

  it("returns 409 STATUS_CHANGED when prepareEmailForOrder throws this error", async () => {
    // Arrange
    mockPrepareEmail.mockRejectedValue(new Error("STATUS_CHANGED"));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(409);
  });

  it("returns 200 with {draftId, webLink} on happy path", async () => {
    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(200);
    expect(mockJsonResponse).toHaveBeenCalledWith(
      {
        draftId: "DRAFT-123",
        webLink: "https://outlook.office.com/deeplink/compose?ItemID=DRAFT-123",
      },
      200
    );

    // Sekwencja wywołań
    expect(mockGetValidAccessToken).toHaveBeenCalledWith(expect.anything(), MOCK_USER.id);
    expect(mockPrepareEmail).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      VALID_ORDER_ID,
      { outputFormat: "pdf-base64" }
    );
    expect(mockCreateDraftEmail).toHaveBeenCalledOnce();
    const draftParams = mockCreateDraftEmail.mock.calls[0][1];
    expect(draftParams.subject).toBe("subj");
    expect(draftParams.attachmentBase64).toBe("QUJD");
  });

  it("returns 500 when createDraftEmail throws generic error", async () => {
    // Arrange
    mockCreateDraftEmail.mockRejectedValue(new Error("Graph 500"));

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(500);
  });

  it("returns 500 when prepareEmailForOrder format is unexpected", async () => {
    // Arrange
    mockPrepareEmail.mockResolvedValue({
      success: true,
      format: "eml", // niepoprawny format dla tego endpointu
    } as never);

    // Act
    const response = await POST(makeContext());

    // Assert
    expect(response.status).toBe(500);
  });
});

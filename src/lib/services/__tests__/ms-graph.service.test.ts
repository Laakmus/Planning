/**
 * Testy dla ms-graph.service.ts — Microsoft Graph OAuth + Mail Draft.
 *
 * Pokrycie:
 * - buildAuthorizationUrl → poprawne query params (client_id, scope, state, code_challenge, S256)
 * - exchangeCodeForTokens → POST /token z grant_type=authorization_code + code_verifier
 * - refreshAccessToken → POST /token z grant_type=refresh_token
 * - getMsUser → GET graph.microsoft.com/v1.0/me z Authorization Bearer
 * - saveTokens → RPC encrypt_ms_token x2 + upsert do ms_oauth_tokens
 * - getTokenRecord → SELECT + RPC decrypt_ms_token x2 (null gdy brak rekordu)
 * - getValidAccessToken — happy path (token nadal valid), refresh path, brak rekordu, refresh failed
 * - createDraftEmail — happy path (201 + 201), failure attachment → delete draft
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock api-helpers.logError (silent w testach)
// ---------------------------------------------------------------------------

vi.mock("../../api-helpers", () => ({
  logError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock env variables (musi być przed importem service)
// ---------------------------------------------------------------------------

vi.stubEnv("MS_CLIENT_ID", "test-client-id");
vi.stubEnv("MS_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("MS_TENANT_ID", "test-tenant");
vi.stubEnv("APP_ENCRYPTION_KEY", "test-encryption-key-32-chars-long");
vi.stubEnv("PUBLIC_BASE_URL", "http://localhost:4321");

import {
  buildAuthorizationUrl,
  createDraftEmail,
  exchangeCodeForTokens,
  getMsUser,
  getRedirectUri,
  getTokenRecord,
  getValidAccessToken,
  refreshAccessToken,
  saveTokens,
} from "../ms-graph.service";
import type {
  MsGraphMeResponse,
  MsTokenResponse,
} from "../../../types";

// ---------------------------------------------------------------------------
// Helpers — mock supabase
// ---------------------------------------------------------------------------

/**
 * Buduje mock Supabase z RPC + from() chainem.
 * RPC encrypt/decrypt zwraca przekazaną wartość pod kluczem `data`.
 */
function buildSupabaseMock(options?: {
  rpcEncrypt?: { data: unknown; error: unknown };
  rpcDecrypt?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
  upsertResult?: { error: unknown };
  deleteResult?: { error: unknown };
}) {
  const rpc = vi.fn().mockImplementation(async (fnName: string) => {
    if (fnName === "encrypt_ms_token") {
      return options?.rpcEncrypt ?? { data: "0xENCRYPTED", error: null };
    }
    if (fnName === "decrypt_ms_token") {
      return options?.rpcDecrypt ?? { data: "DECRYPTED", error: null };
    }
    return { data: null, error: null };
  });

  const maybeSingle = vi
    .fn()
    .mockResolvedValue(options?.selectResult ?? { data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue(options?.upsertResult ?? { error: null });
  const eqDelete = vi.fn().mockResolvedValue(options?.deleteResult ?? { error: null });
  const deleteOp = vi.fn().mockReturnValue({ eq: eqDelete });
  const from = vi.fn().mockReturnValue({
    select,
    upsert,
    delete: deleteOp,
  });

  return {
    supabase: { rpc, from } as unknown as Parameters<typeof saveTokens>[0],
    rpc,
    from,
    select,
    eq,
    maybeSingle,
    upsert,
    deleteOp,
    eqDelete,
  };
}

/** Helper budujący mock Response. */
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const VALID_TOKEN_RESPONSE: MsTokenResponse = {
  access_token: "AT_RAW",
  refresh_token: "RT_RAW",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "Mail.ReadWrite Mail.Send offline_access User.Read",
};

const VALID_ME_RESPONSE: MsGraphMeResponse = {
  id: "ms-guid-1",
  mail: "user@contoso.com",
  userPrincipalName: "user@contoso.com",
  displayName: "Test User",
};

// ---------------------------------------------------------------------------
// Globalny fetch — resetowany przed każdym testem
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// buildAuthorizationUrl
// ---------------------------------------------------------------------------

describe("buildAuthorizationUrl", () => {
  it("builds URL with correct query params and tenant", () => {
    // Arrange
    const state = "state-abc";
    const codeChallenge = "challenge-xyz";

    // Act
    const url = buildAuthorizationUrl(state, codeChallenge, "user-1");

    // Assert
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://login.microsoftonline.com");
    expect(parsed.pathname).toBe("/test-tenant/oauth2/v2.0/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:4321/api/v1/ms-oauth/callback"
    );
    expect(parsed.searchParams.get("scope")).toBe(
      "Mail.ReadWrite Mail.Send offline_access User.Read"
    );
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("code_challenge")).toBe(codeChallenge);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("response_mode")).toBe("query");
    expect(parsed.searchParams.get("prompt")).toBe("select_account");
  });
});

// ---------------------------------------------------------------------------
// getRedirectUri
// ---------------------------------------------------------------------------

describe("getRedirectUri", () => {
  it("returns base URL + /api/v1/ms-oauth/callback", () => {
    expect(getRedirectUri()).toBe("http://localhost:4321/api/v1/ms-oauth/callback");
  });
});

// ---------------------------------------------------------------------------
// exchangeCodeForTokens
// ---------------------------------------------------------------------------

describe("exchangeCodeForTokens", () => {
  it("POSTs to /token with grant_type=authorization_code + code_verifier", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(200, VALID_TOKEN_RESPONSE));

    // Act
    const result = await exchangeCodeForTokens("the-code", "the-verifier");

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    // Body — sprawdzamy że zawiera kluczowe parametry
    const bodyStr = (init as RequestInit).body as string;
    const params = new URLSearchParams(bodyStr);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("the-code");
    expect(params.get("code_verifier")).toBe("the-verifier");
    expect(params.get("client_id")).toBe("test-client-id");
    expect(params.get("client_secret")).toBe("test-client-secret");
    expect(params.get("redirect_uri")).toBe(
      "http://localhost:4321/api/v1/ms-oauth/callback"
    );

    expect(result).toEqual(VALID_TOKEN_RESPONSE);
  });

  it("throws when Microsoft returns 400", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(400, { error: "invalid_grant" })
    );

    // Act + Assert
    await expect(exchangeCodeForTokens("bad-code", "verifier")).rejects.toThrow(
      /Microsoft token endpoint/
    );
  });

  it("throws when response misses access_token", async () => {
    // Arrange — niepełna odpowiedź (brak access_token)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(200, { refresh_token: "x", expires_in: 3600 })
    );

    // Act + Assert
    await expect(exchangeCodeForTokens("code", "verifier")).rejects.toThrow(
      /niekompletny/
    );
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe("refreshAccessToken", () => {
  it("POSTs to /token with grant_type=refresh_token", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(200, VALID_TOKEN_RESPONSE));

    // Act
    const result = await refreshAccessToken("the-refresh-token");

    // Assert
    const [, init] = fetchSpy.mock.calls[0];
    const bodyStr = (init as RequestInit).body as string;
    const params = new URLSearchParams(bodyStr);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("the-refresh-token");
    expect(params.get("client_id")).toBe("test-client-id");

    expect(result).toEqual(VALID_TOKEN_RESPONSE);
  });

  it("throws when refresh fails (Microsoft 400)", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(400, { error: "invalid_grant" })
    );

    // Act + Assert
    await expect(refreshAccessToken("bad-rt")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getMsUser
// ---------------------------------------------------------------------------

describe("getMsUser", () => {
  it("GETs https://graph.microsoft.com/v1.0/me with Authorization Bearer", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(200, VALID_ME_RESPONSE));

    // Act
    const result = await getMsUser("AT_TOKEN");

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer AT_TOKEN");

    expect(result).toEqual(VALID_ME_RESPONSE);
  });

  it("throws when Graph returns 401", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(401, { error: "InvalidAuthenticationToken" })
    );

    // Act + Assert
    await expect(getMsUser("expired")).rejects.toThrow(/Microsoft Graph \/me/);
  });
});

// ---------------------------------------------------------------------------
// saveTokens
// ---------------------------------------------------------------------------

describe("saveTokens", () => {
  it("calls RPC encrypt_ms_token twice (access + refresh) and upserts row", async () => {
    // Arrange
    const { supabase, rpc, from, upsert } = buildSupabaseMock();

    // Act
    await saveTokens(supabase, "user-uuid-1", VALID_TOKEN_RESPONSE, VALID_ME_RESPONSE);

    // Assert — RPC dla każdego tokenu
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "encrypt_ms_token", {
      p_plain: "AT_RAW",
      p_key: "test-encryption-key-32-chars-long",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "encrypt_ms_token", {
      p_plain: "RT_RAW",
      p_key: "test-encryption-key-32-chars-long",
    });

    // Assert — upsert do ms_oauth_tokens
    expect(from).toHaveBeenCalledWith("ms_oauth_tokens");
    expect(upsert).toHaveBeenCalledOnce();
    const upsertPayload = upsert.mock.calls[0][0];
    expect(upsertPayload.user_id).toBe("user-uuid-1");
    expect(upsertPayload.access_token_encrypted).toBe("0xENCRYPTED");
    expect(upsertPayload.refresh_token_encrypted).toBe("0xENCRYPTED");
    expect(upsertPayload.ms_user_id).toBe("ms-guid-1");
    expect(upsertPayload.ms_email).toBe("user@contoso.com");
    expect(typeof upsertPayload.expires_at).toBe("string");

    const upsertOpts = upsert.mock.calls[0][1];
    expect(upsertOpts?.onConflict).toBe("user_id");
  });

  it("falls back to userPrincipalName when mail is null", async () => {
    // Arrange
    const { supabase, upsert } = buildSupabaseMock();
    const msUser: MsGraphMeResponse = {
      ...VALID_ME_RESPONSE,
      mail: null,
      userPrincipalName: "fallback@contoso.onmicrosoft.com",
    };

    // Act
    await saveTokens(supabase, "user-uuid-1", VALID_TOKEN_RESPONSE, msUser);

    // Assert
    const payload = upsert.mock.calls[0][0];
    expect(payload.ms_email).toBe("fallback@contoso.onmicrosoft.com");
  });

  it("throws when upsert returns error", async () => {
    // Arrange
    const { supabase } = buildSupabaseMock({
      upsertResult: { error: { message: "DB error" } },
    });

    // Act + Assert
    await expect(
      saveTokens(supabase, "user-uuid-1", VALID_TOKEN_RESPONSE, VALID_ME_RESPONSE)
    ).rejects.toThrow(/zapisu/);
  });

  it("throws when encrypt RPC fails", async () => {
    // Arrange
    const { supabase } = buildSupabaseMock({
      rpcEncrypt: { data: null, error: { message: "RPC failed" } },
    });

    // Act + Assert
    await expect(
      saveTokens(supabase, "user-uuid-1", VALID_TOKEN_RESPONSE, VALID_ME_RESPONSE)
    ).rejects.toThrow(/szyfrowania/);
  });
});

// ---------------------------------------------------------------------------
// getTokenRecord
// ---------------------------------------------------------------------------

describe("getTokenRecord", () => {
  it("returns null when no row in DB", async () => {
    // Arrange
    const { supabase } = buildSupabaseMock({
      selectResult: { data: null, error: null },
    });

    // Act
    const result = await getTokenRecord(supabase, "user-1");

    // Assert
    expect(result).toBeNull();
  });

  it("returns decrypted record when row exists", async () => {
    // Arrange
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    const dbRow = {
      user_id: "user-1",
      access_token_encrypted: "0xACCESS_ENC",
      refresh_token_encrypted: "0xREFRESH_ENC",
      expires_at: futureDate,
      scope: "Mail.Send offline_access",
      ms_user_id: "ms-1",
      ms_email: "user@contoso.com",
      created_at: new Date().toISOString(),
    };
    const { supabase, rpc } = buildSupabaseMock({
      selectResult: { data: dbRow, error: null },
      rpcDecrypt: { data: "DECRYPTED_VALUE", error: null },
    });

    // Act
    const result = await getTokenRecord(supabase, "user-1");

    // Assert
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    expect(result?.accessToken).toBe("DECRYPTED_VALUE");
    expect(result?.refreshToken).toBe("DECRYPTED_VALUE");
    expect(result?.msUserId).toBe("ms-1");
    expect(result?.msEmail).toBe("user@contoso.com");
    expect(result?.expiresAt).toBeInstanceOf(Date);

    // RPC decrypt wywołane 2× (access + refresh)
    const decryptCalls = rpc.mock.calls.filter((c) => c[0] === "decrypt_ms_token");
    expect(decryptCalls).toHaveLength(2);
  });

  it("throws when select returns error", async () => {
    // Arrange
    const { supabase } = buildSupabaseMock({
      selectResult: { data: null, error: { message: "RLS denied" } },
    });

    // Act + Assert
    await expect(getTokenRecord(supabase, "user-1")).rejects.toThrow(/odczytu/);
  });
});

// ---------------------------------------------------------------------------
// getValidAccessToken
// ---------------------------------------------------------------------------

describe("getValidAccessToken", () => {
  it("throws 'MS_NOT_CONNECTED' when no record exists", async () => {
    // Arrange
    const { supabase } = buildSupabaseMock({
      selectResult: { data: null, error: null },
    });

    // Act + Assert
    await expect(getValidAccessToken(supabase, "user-1")).rejects.toThrow(
      "MS_NOT_CONNECTED"
    );
  });

  it("returns current access_token when token is still valid (>60s left)", async () => {
    // Arrange — token wygasa za 1 godzinę
    const farFuture = new Date(Date.now() + 3600 * 1000).toISOString();
    const dbRow = {
      user_id: "user-1",
      access_token_encrypted: "0xENC",
      refresh_token_encrypted: "0xENC",
      expires_at: farFuture,
      scope: "x",
      ms_user_id: "ms-1",
      ms_email: "u@c.com",
      created_at: new Date().toISOString(),
    };
    const { supabase, rpc } = buildSupabaseMock({
      selectResult: { data: dbRow, error: null },
      rpcDecrypt: { data: "VALID_AT", error: null },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Act
    const token = await getValidAccessToken(supabase, "user-1");

    // Assert — nie było refreshu
    expect(token).toBe("VALID_AT");
    expect(fetchSpy).not.toHaveBeenCalled();
    // Tylko decrypt RPC (2x), brak encrypt
    const encryptCalls = rpc.mock.calls.filter((c) => c[0] === "encrypt_ms_token");
    expect(encryptCalls).toHaveLength(0);
  });

  it("refreshes and saves new tokens when access_token expires within buffer", async () => {
    // Arrange — token wygasa za 10 sekund (< 60s buffer)
    const nearFuture = new Date(Date.now() + 10 * 1000).toISOString();
    const dbRow = {
      user_id: "user-1",
      access_token_encrypted: "0xENC_OLD",
      refresh_token_encrypted: "0xENC_RT",
      expires_at: nearFuture,
      scope: "x",
      ms_user_id: "ms-1",
      ms_email: "u@c.com",
      created_at: new Date().toISOString(),
    };
    const newTokens: MsTokenResponse = {
      access_token: "AT_NEW",
      refresh_token: "RT_NEW",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "x",
    };
    const { supabase, rpc, upsert } = buildSupabaseMock({
      selectResult: { data: dbRow, error: null },
      rpcDecrypt: { data: "DECRYPTED_RT", error: null },
    });

    // Mock fetch dla refresh
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse(200, newTokens));

    // Act
    const token = await getValidAccessToken(supabase, "user-1");

    // Assert — zwrócony nowy access_token + zapis do DB
    expect(token).toBe("AT_NEW");
    expect(upsert).toHaveBeenCalledOnce();
    // Encrypt RPC wykonany (saveTokens), decrypt RPC wykonany (getTokenRecord)
    const encryptCalls = rpc.mock.calls.filter((c) => c[0] === "encrypt_ms_token");
    expect(encryptCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("throws 'MS_REFRESH_FAILED' when refresh fails", async () => {
    // Arrange — token wygasa, ale Microsoft odrzuci refresh
    const expired = new Date(Date.now() - 1000).toISOString();
    const dbRow = {
      user_id: "user-1",
      access_token_encrypted: "0xENC",
      refresh_token_encrypted: "0xENC",
      expires_at: expired,
      scope: "x",
      ms_user_id: "ms-1",
      ms_email: "u@c.com",
      created_at: new Date().toISOString(),
    };
    const { supabase } = buildSupabaseMock({
      selectResult: { data: dbRow, error: null },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(400, { error: "invalid_grant" })
    );

    // Act + Assert
    await expect(getValidAccessToken(supabase, "user-1")).rejects.toThrow(
      "MS_REFRESH_FAILED"
    );
  });
});

// ---------------------------------------------------------------------------
// createDraftEmail
// ---------------------------------------------------------------------------

describe("createDraftEmail", () => {
  const happyParams = {
    to: "recipient@contoso.com",
    subject: "Test subject",
    bodyHtml: "<p>Test body</p>",
    attachmentBase64: "QUJD", // "ABC"
    attachmentFilename: "test.pdf",
  };

  it("creates draft + attaches PDF (happy path)", async () => {
    // Arrange — pierwsza odpowiedź = create draft (201), druga = attachment (201)
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockResponse(201, {
          id: "DRAFT-123",
          webLink: "https://outlook.office.com/deeplink/compose?ItemID=DRAFT-123",
        })
      )
      .mockResolvedValueOnce(mockResponse(201, { id: "ATTACHMENT-1" }));

    // Act
    const result = await createDraftEmail("AT_TOKEN", happyParams);

    // Assert
    expect(result.draftId).toBe("DRAFT-123");
    expect(result.webLink).toBe(
      "https://outlook.office.com/deeplink/compose?ItemID=DRAFT-123"
    );

    // Pierwszy call → POST /me/messages
    const [createUrl, createInit] = fetchSpy.mock.calls[0];
    expect(createUrl).toBe("https://graph.microsoft.com/v1.0/me/messages");
    expect((createInit as RequestInit).method).toBe("POST");
    const createHeaders = (createInit as RequestInit).headers as Record<string, string>;
    expect(createHeaders["Authorization"]).toBe("Bearer AT_TOKEN");
    const createBody = JSON.parse((createInit as RequestInit).body as string);
    expect(createBody.subject).toBe("Test subject");
    expect(createBody.body.contentType).toBe("HTML");
    expect(createBody.body.content).toBe("<p>Test body</p>");
    expect(createBody.toRecipients).toEqual([
      { emailAddress: { address: "recipient@contoso.com" } },
    ]);

    // Drugi call → POST /me/messages/{id}/attachments
    const [attachUrl, attachInit] = fetchSpy.mock.calls[1];
    expect(attachUrl).toBe(
      "https://graph.microsoft.com/v1.0/me/messages/DRAFT-123/attachments"
    );
    const attachBody = JSON.parse((attachInit as RequestInit).body as string);
    expect(attachBody["@odata.type"]).toBe("#microsoft.graph.fileAttachment");
    expect(attachBody.name).toBe("test.pdf");
    expect(attachBody.contentType).toBe("application/pdf");
    expect(attachBody.contentBytes).toBe("QUJD");
  });

  it("omits toRecipients when 'to' is empty", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(201, { id: "DRAFT", webLink: "x" }))
      .mockResolvedValueOnce(mockResponse(201, { id: "ATT" }));

    // Act
    await createDraftEmail("AT", { ...happyParams, to: "" });

    // Assert
    const createBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(createBody.toRecipients).toBeUndefined();
  });

  it("omits toRecipients when 'to' is not a valid email", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(201, { id: "DRAFT", webLink: "x" }))
      .mockResolvedValueOnce(mockResponse(201, { id: "ATT" }));

    // Act
    await createDraftEmail("AT", { ...happyParams, to: "not-email" });

    // Assert
    const createBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(createBody.toRecipients).toBeUndefined();
  });

  it("throws when create draft fails (Graph 401)", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse(401, { error: "InvalidAuth" })
    );

    // Act + Assert
    await expect(createDraftEmail("AT", happyParams)).rejects.toThrow(
      /odmówił utworzenia draftu/
    );
  });

  it("deletes orphan draft and throws when attachment fails", async () => {
    // Arrange — create OK, attachment fail (400)
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockResponse(201, { id: "DRAFT-X", webLink: "x" })
      )
      .mockResolvedValueOnce(
        mockResponse(400, { error: "InvalidAttachment" })
      )
      .mockResolvedValueOnce(mockResponse(204, "")); // delete orphan

    // Act + Assert
    await expect(createDraftEmail("AT", happyParams)).rejects.toThrow(
      /odmówił dodania załącznika/
    );

    // Powinniśmy mieć 3 fetch wywołania: create, attach (fail), delete
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const [deleteUrl, deleteInit] = fetchSpy.mock.calls[2];
    expect(deleteUrl).toBe("https://graph.microsoft.com/v1.0/me/messages/DRAFT-X");
    expect((deleteInit as RequestInit).method).toBe("DELETE");
  });

  it("uses fallback compose deeplink when webLink missing in response", async () => {
    // Arrange — create draft bez webLink
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(201, { id: "DRAFT-NOLINK" }))
      .mockResolvedValueOnce(mockResponse(201, { id: "ATT" }));

    // Act
    const result = await createDraftEmail("AT", happyParams);

    // Assert
    expect(result.webLink).toContain("outlook.office.com/mail/deeplink/compose");
    expect(result.webLink).toContain("DRAFT-NOLINK");
  });
});

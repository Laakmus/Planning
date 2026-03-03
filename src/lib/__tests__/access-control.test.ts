/**
 * Testy kontroli dostępu: requireWriteAccess i requireAdmin.
 *
 * Weryfikuje zachowanie guardów dla ról: ADMIN, PLANNER, READ_ONLY.
 * Sprawdza kody statusu i treść odpowiedzi 403.
 */

import { describe, it, expect } from "vitest";
import { requireWriteAccess, requireAdmin } from "../api-helpers";
import type { AuthMeDto } from "../../types";

// ---------------------------------------------------------------------------
// Helpers — fabryka użytkowników testowych
// ---------------------------------------------------------------------------

function makeUser(role: AuthMeDto["role"]): AuthMeDto {
  return {
    id: "c94a20d0-0000-0000-0000-000000000001",
    email: `${role.toLowerCase()}@test.pl`,
    fullName: `Test ${role}`,
    phone: null,
    role,
  };
}

// ---------------------------------------------------------------------------
// requireWriteAccess — ADMIN i PLANNER mają dostęp, READ_ONLY nie
// ---------------------------------------------------------------------------

describe("requireWriteAccess", () => {
  it("zwraca null dla roli ADMIN (dozwolone)", () => {
    // Arrange
    const admin = makeUser("ADMIN");

    // Act
    const result = requireWriteAccess(admin);

    // Assert
    expect(result).toBeNull();
  });

  it("zwraca null dla roli PLANNER (dozwolone)", () => {
    // Arrange
    const planner = makeUser("PLANNER");

    // Act
    const result = requireWriteAccess(planner);

    // Assert
    expect(result).toBeNull();
  });

  it("zwraca Response 403 dla roli READ_ONLY", async () => {
    // Arrange
    const readOnly = makeUser("READ_ONLY");

    // Act
    const result = requireWriteAccess(readOnly);

    // Assert — sprawdź że to Response
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(403);

    // Assert — sprawdź body odpowiedzi
    const body = await result!.json();
    expect(body.error).toBe("Forbidden");
    expect(body.statusCode).toBe(403);
    expect(body.message).toContain("ADMIN lub PLANNER");
  });
});

// ---------------------------------------------------------------------------
// requireAdmin — tylko ADMIN ma dostęp
// ---------------------------------------------------------------------------

describe("requireAdmin", () => {
  it("zwraca null dla roli ADMIN (dozwolone)", () => {
    // Arrange
    const admin = makeUser("ADMIN");

    // Act
    const result = requireAdmin(admin);

    // Assert
    expect(result).toBeNull();
  });

  it("zwraca Response 403 dla roli PLANNER", async () => {
    // Arrange
    const planner = makeUser("PLANNER");

    // Act
    const result = requireAdmin(planner);

    // Assert
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(403);

    const body = await result!.json();
    expect(body.error).toBe("Forbidden");
    expect(body.statusCode).toBe(403);
    expect(body.message).toContain("ADMIN");
  });

  it("zwraca Response 403 dla roli READ_ONLY", async () => {
    // Arrange
    const readOnly = makeUser("READ_ONLY");

    // Act
    const result = requireAdmin(readOnly);

    // Assert
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(403);

    const body = await result!.json();
    expect(body.error).toBe("Forbidden");
    expect(body.statusCode).toBe(403);
    expect(body.message).toContain("ADMIN");
  });

  it("odpowiedź 403 zawiera poprawne nagłówki Content-Type", async () => {
    // Arrange
    const readOnly = makeUser("READ_ONLY");

    // Act
    const result = requireAdmin(readOnly);

    // Assert — nagłówek Content-Type powinien być application/json
    expect(result).toBeInstanceOf(Response);
    expect(result!.headers.get("Content-Type")).toBe("application/json");
  });

  it("odpowiedź 403 nie zawiera pola details (brak szczegółów walidacji)", async () => {
    // Arrange
    const planner = makeUser("PLANNER");

    // Act
    const result = requireAdmin(planner);

    // Assert
    const body = await result!.json();
    expect(body.details).toBeUndefined();
  });
});

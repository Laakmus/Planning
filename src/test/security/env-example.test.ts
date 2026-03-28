/**
 * Testy bezpieczeństwa: .env.example nie zawiera prawdziwych kluczy/tokenów.
 *
 * Weryfikuje, że plik .env.example:
 * 1. Nie zawiera prawdziwych kluczy Supabase (sb_publishable_, sb_secret_, eyJ...)
 * 2. Wartości KEY/SECRET to placeholdery (your-*-here lub <your-*>)
 * 3. Nie zawiera JWT tokenów (eyJ...)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// ścieżka do .env.example w rootcie projektu
const ENV_EXAMPLE_PATH = join(__dirname, "..", "..", "..", ".env.example");

describe(".env.example — bezpieczeństwo kluczy", () => {
  // Arrange — wczytaj plik raz dla wszystkich testów
  const content = readFileSync(ENV_EXAMPLE_PATH, "utf-8");
  const lines = content.split("\n");

  it("plik .env.example istnieje i nie jest pusty", () => {
    // Assert
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("nie zawiera prawdziwych kluczy Supabase (sb_publishable_, sb_secret_)", () => {
    // Act — szukaj wzorców prawdziwych kluczy Supabase
    const hasPublishableKey = /sb_publishable_[A-Za-z0-9]{20,}/.test(content);
    const hasSecretKey = /sb_secret_[A-Za-z0-9]{20,}/.test(content);

    // Assert
    expect(hasPublishableKey).toBe(false);
    expect(hasSecretKey).toBe(false);
  });

  it("nie zawiera tokenów JWT (eyJ...)", () => {
    // Act — JWT tokeny zaczynają się od eyJ (base64 nagłówka JSON)
    const hasJwtToken = /eyJ[A-Za-z0-9_-]{20,}/.test(content);

    // Assert
    expect(hasJwtToken).toBe(false);
  });

  it("wartości ANON_KEY i SERVICE_ROLE_KEY to placeholdery", () => {
    // Arrange — wyciągnij linie z kluczami
    const keyLines = lines.filter(
      (line) =>
        line.includes("ANON_KEY=") || line.includes("SERVICE_ROLE_KEY=")
    );

    // Act & Assert — każda linia z kluczem powinna zawierać placeholder
    expect(keyLines.length).toBeGreaterThanOrEqual(2);

    for (const line of keyLines) {
      // Pomiń komentarze
      if (line.trimStart().startsWith("#")) continue;

      const value = line.split("=").slice(1).join("=").trim();

      // Wartość powinna być placeholderem: <your-...-here> lub your-...-here
      const isPlaceholder =
        value.startsWith("<your-") || value.startsWith("your-");

      expect(
        isPlaceholder,
        `Wartość klucza "${line.split("=")[0]}" powinna być placeholderem, otrzymano: "${value}"`
      ).toBe(true);
    }
  });

  it("nie zawiera długich ciągów base64 (potencjalne tokeny/klucze)", () => {
    // Act — szukaj długich ciągów base64 (>40 znaków) po znaku '='
    for (const line of lines) {
      // Pomiń komentarze i puste linie
      if (line.trimStart().startsWith("#") || !line.includes("=")) continue;

      const value = line.split("=").slice(1).join("=").trim();

      // Pomiń URL-e (http://...) i placeholdery (<your-...>)
      if (value.startsWith("http") || value.startsWith("<")) continue;

      // Sprawdź czy wartość nie wygląda jak prawdziwy klucz (>40 znaków alfanumerycznych)
      const looksLikeRealKey = /^[A-Za-z0-9+/=_-]{40,}$/.test(value);

      // Assert
      expect(
        looksLikeRealKey,
        `Linia "${line.split("=")[0]}" wygląda na prawdziwy klucz/token: "${value.substring(0, 20)}..."`
      ).toBe(false);
    }
  });

  it("CORS_ORIGIN nie jest ustawiony na wildcard '*'", () => {
    // Arrange — znajdź linię CORS_ORIGIN
    const corsLine = lines.find(
      (line) => !line.trimStart().startsWith("#") && line.includes("CORS_ORIGIN=")
    );

    // Act
    const corsValue = corsLine?.split("=").slice(1).join("=").trim();

    // Assert — nie powinien być wildcard
    expect(corsValue).not.toBe("*");
  });
});

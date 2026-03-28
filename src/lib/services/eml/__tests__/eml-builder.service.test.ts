/**
 * Testy eml-builder.service.ts — budowanie pliku .eml z załącznikiem PDF.
 */

import { describe, it, expect } from "vitest";

import { buildEmlWithPdfAttachment, encodeRfc2231 } from "../eml-builder.service";

// ---------------------------------------------------------------------------
// Helper — minimalny PDF buffer do testów
// ---------------------------------------------------------------------------

function makePdfBuffer(size = 128): ArrayBuffer {
  const arr = new Uint8Array(size);
  for (let i = 0; i < size; i++) arr[i] = i % 256;
  return arr.buffer;
}

describe("encodeRfc2231", () => {
  it("should encode ASCII filename correctly", () => {
    const result = encodeRfc2231("test.pdf");
    expect(result).toBe("UTF-8''test.pdf");
  });

  it("should encode spaces as %20", () => {
    const result = encodeRfc2231("my file.pdf");
    expect(result).toBe("UTF-8''my%20file.pdf");
  });

  it("should encode Polish characters", () => {
    const result = encodeRfc2231("zlecenie-ążśźęćńół.pdf");
    expect(result).toContain("UTF-8''");
    // Polskie znaki powinny być zakodowane jako %XX sekwencje
    expect(result).not.toMatch(/[ążśźęćńół]/);
  });

  it("should encode slash character", () => {
    const result = encodeRfc2231("zlecenie-ZT2026/0001.pdf");
    expect(result).toContain("%2F");
  });
});

describe("buildEmlWithPdfAttachment", () => {
  const defaultOptions = {
    pdfBuffer: makePdfBuffer(),
    pdfFileName: "Zlecenie_ZT2026_0001.pdf",
  };

  it("should contain X-Unsent: 1 header", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    expect(eml).toContain("X-Unsent: 1");
  });

  it("should contain MIME-Version: 1.0 header", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    expect(eml).toContain("MIME-Version: 1.0");
  });

  it("should contain Content-Type: multipart/mixed with boundary", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    expect(eml).toMatch(/Content-Type: multipart\/mixed; boundary="/);
  });

  it("should contain Content-Type: application/pdf in attachment section", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    expect(eml).toContain("Content-Type: application/pdf");
  });

  it("should contain Content-Disposition with both filename and filename* (RFC 2231)", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    // Powinien zawierać surową nazwę pliku w filename=""
    expect(eml).toContain(`filename="${defaultOptions.pdfFileName}"`);
    // Powinien zawierać RFC 2231 encoded filename*
    expect(eml).toContain("filename*=UTF-8''Zlecenie_ZT2026_0001.pdf");
  });

  it("should encode Polish characters in filename* with RFC 2231", () => {
    const polishFileName = "Zlecenie_ążśźęćńół.pdf";
    const eml = buildEmlWithPdfAttachment({
      pdfBuffer: makePdfBuffer(),
      pdfFileName: polishFileName,
    });

    // filename= zachowuje oryginał (kompatybilność wsteczna)
    expect(eml).toContain(`filename="${polishFileName}"`);
    // filename* koduje polskie znaki
    expect(eml).toMatch(/filename\*=UTF-8''/);
    // Polskie znaki nie powinny występować w filename* (zakodowane jako %XX)
    const filenameStarMatch = eml.match(/filename\*=([^\r\n]+)/);
    expect(filenameStarMatch).not.toBeNull();
    expect(filenameStarMatch![1]).not.toMatch(/[ążśźęćńół]/);
  });

  it("should wrap base64 lines at 76 characters max", () => {
    // Używamy większego buffera żeby wygenerować więcej niż jedną linię base64
    const largePdf = makePdfBuffer(1024);
    const eml = buildEmlWithPdfAttachment({
      pdfBuffer: largePdf,
      pdfFileName: "test.pdf",
    });

    // Wyciągamy sekcję base64 — jest między "Content-Disposition: attachment..."
    // a zamykającym "--boundary--"
    const lines = eml.split("\r\n");
    const base64Start = lines.findIndex((l) =>
      l.startsWith("Content-Disposition: attachment")
    );
    // Po Content-Disposition jest pusta linia, potem base64
    const base64Lines = [];
    for (let i = base64Start + 2; i < lines.length; i++) {
      if (lines[i].startsWith("--")) break; // koniec na granicy MIME
      if (lines[i].length > 0) base64Lines.push(lines[i]);
    }

    // Każda linia base64 nie powinna przekraczać 76 znaków
    expect(base64Lines.length).toBeGreaterThan(1);
    for (const line of base64Lines) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });

  it("should have empty Subject when no subject provided", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    // "Subject: " z niczym po dwukropku i spacji (następna linia to inny nagłówek)
    expect(eml).toMatch(/Subject: \r\n/);
  });

  it("should include Subject header with provided text", () => {
    const eml = buildEmlWithPdfAttachment({
      ...defaultOptions,
      subject: "Test Order Subject",
    });
    // ASCII temat — bez kodowania RFC 2047
    expect(eml).toContain("Subject: Test Order Subject");
  });

  it("should encode Subject with Polish characters using RFC 2047", () => {
    const eml = buildEmlWithPdfAttachment({
      ...defaultOptions,
      subject: "Zlecenie transportowe — zlecenie-ZT2026-0001",
    });
    // Temat z em-dash (—) wymaga kodowania RFC 2047
    expect(eml).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });

  it("should produce decodable RFC 2047 subject", () => {
    const originalSubject = "Zlecenie transportowe — zlecenie-ZT2026-0001";
    const eml = buildEmlWithPdfAttachment({
      ...defaultOptions,
      subject: originalSubject,
    });

    // Wyciągnij zakodowany temat
    const subjectMatch = eml.match(/Subject: =\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/);
    expect(subjectMatch).not.toBeNull();

    // Dekoduj base64 i sprawdź czy oryginał się zgadza
    const decoded = Buffer.from(subjectMatch![1], "base64").toString("utf-8");
    expect(decoded).toBe(originalSubject);
  });

  it("should have proper opening and closing boundary markers", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);

    // Wyciągamy boundary z Content-Type
    const boundaryMatch = eml.match(/boundary="([^"]+)"/);
    expect(boundaryMatch).not.toBeNull();
    const boundary = boundaryMatch![1];

    // Otwierające --boundary (dwa wystąpienia: text/plain + attachment)
    const openMarker = `--${boundary}`;
    const closeMarker = `--${boundary}--`;

    expect(eml).toContain(openMarker);
    expect(eml).toContain(closeMarker);

    // Powinny być dokładnie 2 otwierające markery i 1 zamykający
    const openCount = eml.split(openMarker).length - 1;
    // openCount liczy zarówno "--boundary" jak i "--boundary--", więc odejmujemy zamykający
    const closeCount = eml.split(closeMarker).length - 1;
    expect(closeCount).toBe(1);
    // 2 otwierające + 1 zamykający (który też zawiera "--boundary") = 3 wystąpienia "--boundary"
    expect(openCount).toBe(3);
  });

  it("should have empty text/plain body section", () => {
    const eml = buildEmlWithPdfAttachment(defaultOptions);
    // Sekcja text/plain zawiera pustą treść — Content-Type + encoding + pusta linia
    expect(eml).toContain("Content-Type: text/plain; charset=utf-8");
    expect(eml).toContain("Content-Transfer-Encoding: 7bit");

    // Po "7bit\r\n" powinna być pusta linia (body), a potem boundary
    const idx7bit = eml.indexOf("Content-Transfer-Encoding: 7bit");
    const afterTransfer = eml.slice(idx7bit);
    // Format: "7bit\r\n\r\n\r\n--boundary"
    expect(afterTransfer).toMatch(/7bit\r\n\r\n\r\n--/);
  });
});

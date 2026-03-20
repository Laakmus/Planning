/**
 * Builder pliku .eml (RFC 822) z PDF jako MIME attachment.
 * Format multipart/mixed z nagłówkiem X-Unsent: 1 (Outlook otwiera jako draft).
 * Zero zewnętrznych zależności — korzysta wyłącznie z Node.js Buffer.
 */

/**
 * Koduje string UTF-8 zgodnie z RFC 2231 (percent-encoding).
 * Używane do nazw plików z polskimi znakami w Content-Disposition.
 *
 * @param value — string do zakodowania
 * @returns zakodowany string z prefiksem charset (np. "UTF-8''Zlecenie%20transportowe.pdf")
 */
export function encodeRfc2231(value: string): string {
  // encodeURIComponent koduje wszystko oprócz A-Z a-z 0-9 - _ . ! ~ * ' ( )
  // RFC 2231 wymaga kodowania większości znaków specjalnych — encodeURIComponent jest wystarczający
  const encoded = encodeURIComponent(value);
  return `UTF-8''${encoded}`;
}

/**
 * Koduje temat wiadomości email zgodnie z RFC 2047 (encoded-word, charset UTF-8, encoding B = base64).
 * Pozwala na polskie znaki diakrytyczne w nagłówku Subject.
 *
 * @param subject — temat wiadomości (plain text)
 * @returns zakodowany nagłówek lub pusty string gdy brak tematu
 */
function encodeSubjectRfc2047(subject: string): string {
  if (!subject) return "";
  // Sprawdź czy temat zawiera wyłącznie znaki ASCII — wtedy kodowanie zbędne
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  // Kodowanie Base64 (RFC 2047 "B" encoding)
  const base64 = Buffer.from(subject, "utf-8").toString("base64");
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * Buduje treść pliku .eml z załączonym PDF.
 *
 * @param options.pdfBuffer — zawartość PDF jako ArrayBuffer
 * @param options.pdfFileName — nazwa pliku PDF w załączniku
 * @param options.subject — temat wiadomości email (opcjonalny, domyślnie pusty)
 * @returns treść pliku .eml (string)
 */
export function buildEmlWithPdfAttachment(options: {
  pdfBuffer: ArrayBuffer;
  pdfFileName: string;
  subject?: string;
  to?: string;
  body?: string;
}): string {
  const { pdfBuffer, pdfFileName, subject, to, body } = options;

  // Unikalna granica MIME (timestamp + losowa wartość)
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Kodowanie PDF do base64 z łamaniem co 76 znaków (RFC 2045)
  const base64Full = Buffer.from(pdfBuffer).toString("base64");
  const base64Lines: string[] = [];
  for (let i = 0; i < base64Full.length; i += 76) {
    base64Lines.push(base64Full.slice(i, i + 76));
  }
  const base64Content = base64Lines.join("\r\n");

  // Kodowanie tematu (RFC 2047 dla polskich znaków)
  const encodedSubject = encodeSubjectRfc2047(subject || "");

  // RFC 2231 encoding nazwy pliku (polskie znaki, spacje, slash itp.)
  const rfc2231Filename = encodeRfc2231(pdfFileName);

  // Budowanie pliku .eml
  const parts: string[] = [
    // Nagłówki główne
    "MIME-Version: 1.0",
    "X-Unsent: 1",
    `Subject: ${encodedSubject}`,
    `To: ${to ?? ""}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    // Preambuła (ignorowana przez klienty MIME)
    `--${boundary}`,
    // Część tekstowa
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body ?? "",
    // Załącznik PDF
    `--${boundary}`,
    "Content-Type: application/pdf",
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${pdfFileName}"; filename*=${rfc2231Filename}`,
    "",
    base64Content,
    // Zamknięcie multipart
    `--${boundary}--`,
    "",
  ];

  return parts.join("\r\n");
}

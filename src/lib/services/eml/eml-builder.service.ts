/**
 * Builder pliku .eml (RFC 822) z PDF jako MIME attachment.
 * Format multipart/mixed z nagłówkiem X-Unsent: 1 (Outlook otwiera jako draft).
 * Zero zewnętrznych zależności — korzysta wyłącznie z Node.js Buffer.
 */

/**
 * Buduje treść pliku .eml z załączonym PDF.
 *
 * @param options.pdfBuffer — zawartość PDF jako ArrayBuffer
 * @param options.pdfFileName — nazwa pliku PDF w załączniku
 * @returns treść pliku .eml (string)
 */
export function buildEmlWithPdfAttachment(options: {
  pdfBuffer: ArrayBuffer;
  pdfFileName: string;
}): string {
  const { pdfBuffer, pdfFileName } = options;

  // Unikalna granica MIME (timestamp + losowa wartość)
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Kodowanie PDF do base64 z łamaniem co 76 znaków (RFC 2045)
  const base64Full = Buffer.from(pdfBuffer).toString("base64");
  const base64Lines: string[] = [];
  for (let i = 0; i < base64Full.length; i += 76) {
    base64Lines.push(base64Full.slice(i, i + 76));
  }
  const base64Content = base64Lines.join("\r\n");

  // Budowanie pliku .eml
  const parts: string[] = [
    // Nagłówki główne
    "MIME-Version: 1.0",
    "X-Unsent: 1",
    "Subject: ",
    "To: ",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    // Preambuła (ignorowana przez klienty MIME)
    `--${boundary}`,
    // Część tekstowa (pusty body)
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    "",
    // Załącznik PDF
    `--${boundary}`,
    "Content-Type: application/pdf",
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${pdfFileName}"`,
    "",
    base64Content,
    // Zamknięcie multipart
    `--${boundary}--`,
    "",
  ];

  return parts.join("\r\n");
}

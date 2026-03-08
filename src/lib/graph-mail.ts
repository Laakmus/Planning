/**
 * Moduł do tworzenia draftów email z PDF-em w załączniku via Microsoft Graph API.
 *
 * Używa POST /me/messages (tworzy draft w skrzynce Outlook) z fileAttachment.
 * Zwraca webLink do otworzenia draftu w Outlook Web App.
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface GraphDraftResult {
  /** URL do otwarcia draftu w Outlook Web (compose mode) */
  webLink: string;
  /** ID wiadomości w Graph API */
  messageId: string;
}

/**
 * Tworzy draft email w Outlooku użytkownika z PDF-em zlecenia w załączniku.
 *
 * @param token — Bearer token z MSAL (scope: Mail.ReadWrite)
 * @param pdfBase64 — zawartość PDF zakodowana w base64
 * @param pdfFileName — nazwa pliku PDF (np. "zlecenie-PL-2026-001.pdf")
 */
export async function createGraphDraft(
  token: string,
  pdfBase64: string,
  pdfFileName: string
): Promise<GraphDraftResult> {
  // Krok 1: Utwórz draft wiadomości
  const createResponse = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: `Zlecenie transportowe — ${pdfFileName.replace(".pdf", "")}`,
      body: {
        contentType: "Text",
        content: "W załączniku zlecenie transportowe w formacie PDF.",
      },
      // isDraft = true jest domyślne dla POST /me/messages
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Graph API — błąd tworzenia draftu: ${createResponse.status} ${errorText}`);
  }

  const message = await createResponse.json();
  const messageId: string = message.id;

  // Krok 2: Dodaj PDF jako załącznik
  const attachResponse = await fetch(
    `${GRAPH_BASE}/me/messages/${messageId}/attachments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: pdfFileName,
        contentType: "application/pdf",
        contentBytes: pdfBase64,
      }),
    }
  );

  if (!attachResponse.ok) {
    const errorText = await attachResponse.text();
    throw new Error(`Graph API — błąd dodawania załącznika: ${attachResponse.status} ${errorText}`);
  }

  // webLink do otwarcia draftu w Outlook Web
  const webLink: string =
    message.webLink || `https://outlook.office365.com/mail/drafts/${messageId}`;

  return { webLink, messageId };
}

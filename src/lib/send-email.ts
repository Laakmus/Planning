/**
 * Wspólna logika wysyłki email (Graph API draft lub .eml fallback).
 *
 * Używana przez useOrderActions (lista) i useOrderDrawer (drawer).
 * Wyekstrahowana, aby wyeliminować duplikację kodu (~60 linii).
 */

import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";
import type { ApiClient } from "@/lib/api-client";
import { createGraphDraft } from "@/lib/graph-mail";

interface MicrosoftAuth {
  isConfigured: boolean;
  getToken: () => Promise<string>;
}

interface SendEmailOptions {
  orderId: string;
  api: ApiClient;
  microsoft?: MicrosoftAuth;
  /** Nazwa pliku .eml (domyślnie: zlecenie-{orderId}.eml) */
  emlFileName?: string;
  /** Callback po sukcesie (np. refetch listy lub onOrderUpdated) */
  onSuccess: () => void;
  /** Callback przy 422 — brakujące pola walidacji */
  onValidationError: (missingFields: string[]) => void;
}

/**
 * Wysyła email z PDF: Graph API draft (Outlook) lub fallback .eml.
 * Otwiera pustą kartę PRZED async call aby uniknąć popup blocker.
 */
export async function sendEmailForOrder({
  orderId,
  api,
  microsoft,
  emlFileName,
  onSuccess,
  onValidationError,
}: SendEmailOptions): Promise<void> {
  const useGraphApi = microsoft?.isConfigured ?? false;
  const outlookTab = useGraphApi ? window.open("about:blank", "_blank") : null;

  try {
    if (useGraphApi) {
      // Flow Graph API: pobierz PDF base64, utwórz draft w Outlook
      const response = await api.postRaw(`/api/v1/orders/${orderId}/prepare-email`, {
        outputFormat: "pdf-base64",
      });
      const data = await response.json();
      const { pdfBase64, pdfFileName } = data as {
        pdfBase64: string;
        pdfFileName: string;
      };

      const token = await microsoft!.getToken();
      const { webLink } = await createGraphDraft(token, pdfBase64, pdfFileName);

      if (outlookTab) {
        outlookTab.location.href = webLink;
      } else {
        window.open(webLink, "_blank");
      }

      toast.success("Draft email utworzony w Outlook — otwarto w nowej karcie.");
      onSuccess();
    } else {
      // Fallback .eml
      const response = await api.postRaw(`/api/v1/orders/${orderId}/prepare-email`, {});
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = emlFileName ?? `zlecenie-${orderId}.eml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Plik .eml pobrany — otwórz go w programie pocztowym.");
      onSuccess();
    }
  } catch (err) {
    // Zamknij pustą kartę przy błędzie
    if (outlookTab && !outlookTab.closed) {
      outlookTab.close();
    }
    // 422 z listą brakujących pól → dialog walidacji
    if (
      err instanceof ApiError &&
      err.statusCode === 422 &&
      Array.isArray(err.details?.missing)
    ) {
      onValidationError(err.details.missing as string[]);
      return;
    }
    toast.error(err instanceof Error ? err.message : "Błąd wysyłki maila.");
  }
}

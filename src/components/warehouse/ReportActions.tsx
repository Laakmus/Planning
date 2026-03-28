/**
 * Przyciski "Podgląd PDF" i "Wyślij plan" w widoku magazynowym.
 * Umiejscowienie: header WarehouseApp, po prawej stronie.
 */

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReportActionsProps {
  week: number;
  year: number;
  locationId: string;
  disabled?: boolean;
}

interface Recipient {
  id: string;
  email: string;
  name: string | null;
}

export function ReportActions({ week, year, locationId, disabled }: ReportActionsProps) {
  const { api } = useAuth();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);

  // Pobierz odbiorców przy zmianie lokalizacji
  useEffect(() => {
    if (!locationId) return;

    let cancelled = false;

    async function fetchRecipients() {
      try {
        const result = await api.get<{ recipients: Recipient[] }>(
          "/api/v1/warehouse/report/recipients",
          { locationId },
        );
        if (!cancelled) {
          setRecipients(result.recipients);
          setRecipientsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setRecipients([]);
          setRecipientsLoaded(true);
        }
      }
    }

    fetchRecipients();
    return () => { cancelled = true; };
  }, [api, locationId]);

  // Podgląd PDF — generuj i otwórz w nowej karcie
  const handlePreviewPdf = useCallback(async () => {
    setIsGeneratingPdf(true);
    try {
      const response = await api.postRaw("/api/v1/warehouse/report/pdf", {
        week,
        year,
        locationId,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Zwolnij URL po krótkim opóźnieniu (przeglądarka potrzebuje chwili)
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd generowania PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [api, week, year, locationId]);

  // Wyślij plan — .eml download
  const handleSendEmail = useCallback(async () => {
    setIsSendingEmail(true);
    try {
      const response = await api.postRaw("/api/v1/warehouse/report/send-email", {
        week,
        year,
        locationId,
        outputFormat: "eml",
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plan-zaladunkowy-W${week}.eml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Plik .eml pobrany — otwórz go w programie pocztowym.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd wysyłki raportu.");
    } finally {
      setIsSendingEmail(false);
    }
  }, [api, week, year, locationId]);

  const hasRecipients = recipients.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Podgląd PDF */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreviewPdf}
        disabled={disabled || isGeneratingPdf}
      >
        {isGeneratingPdf ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-1.5 h-4 w-4" />
        )}
        Podgląd PDF
      </Button>

      {/* Wyślij plan — z dialogiem potwierdzenia */}
      {recipientsLoaded && !hasRecipients ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="default" size="sm" disabled>
                <Mail className="mr-1.5 h-4 w-4" />
                Wyślij plan
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Brak skonfigurowanych odbiorców dla tego oddziału</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={disabled || isSendingEmail || !recipientsLoaded}
            >
              {isSendingEmail ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1.5 h-4 w-4" />
              )}
              Wyślij plan
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Wyślij plan załadunkowy</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p className="mb-2">
                    Plan załadunkowy za tydzień {week}/{year} zostanie wysłany do:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {recipients.map((r) => (
                      <li key={r.id} className="text-sm">
                        {r.name ? `${r.name} (${r.email})` : r.email}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleSendEmail} disabled={isSendingEmail}>
                {isSendingEmail && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Wyślij
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

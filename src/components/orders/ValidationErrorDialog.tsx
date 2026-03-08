/**
 * Dialog informujący o brakujących polach przy próbie wysłania emaila (422).
 * Wyświetla listę pól wymaganych do wysyłki, przetłumaczonych na polski.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Mapa kluczy walidacji z backendu → etykiety po polsku */
const FIELD_LABELS: Record<string, string> = {
  transport_type_code: "Rodzaj transportu",
  carrier_company_id: "Firma transportowa",
  shipper_location_id: "Lokalizacja nadawcy",
  receiver_location_id: "Lokalizacja odbiorcy",
  price_amount: "Stawka",
};

/** Tłumaczy klucz walidacji na czytelną etykietę po polsku. */
function translateField(field: string): string {
  // Pola zaczynające się od "items" lub "stops" są już po polsku z backendu
  if (field.startsWith("items") || field.startsWith("stops")) {
    return field;
  }
  return FIELD_LABELS[field] ?? field;
}

interface ValidationErrorDialogProps {
  open: boolean;
  onClose: () => void;
  missingFields: string[];
}

export function ValidationErrorDialog({
  open,
  onClose,
  missingFields,
}: ValidationErrorDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nie można wysłać e-maila</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-2">
                Zlecenie nie spełnia wymagań do wysyłki. Uzupełnij brakujące dane:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {missingFields.map((field) => (
                  <li key={field} className="text-sm">
                    {translateField(field)}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Rozumiem</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

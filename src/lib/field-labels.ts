/**
 * Mapa polskich nazw pól — czytelne etykiety dla panelu historii zmian.
 * Używana w TimelineEntry do wyświetlania polskich nazw zamiast technicznych nazw kolumn DB.
 */

/** Stałe nazwy pól → polskie etykiety */
const FIELD_LABELS: Record<string, string> = {
  // Pola biznesowe zlecenia
  transport_type_code: "Rodzaj transportu",
  carrier_company_id: "Firma transportowa",
  vehicle_type_text: "Typ pojazdu",
  vehicle_variant_code: "Wariant pojazdu (historyczny)",
  price_amount: "Stawka",
  currency_code: "Waluta",
  payment_term_days: "Termin płatności (dni)",
  payment_method: "Forma płatności",
  general_notes: "Uwagi",
  complaint_reason: "Powód reklamacji",
  required_documents_text: "Dokumenty",
  shipper_location_id: "Nadawca",
  receiver_location_id: "Odbiorca",
  sender_contact_name: "Kontakt nadawcy — imię",
  sender_contact_phone: "Kontakt nadawcy — telefon",
  sender_contact_email: "Kontakt nadawcy — email",
  total_load_tons: "Masa ładunku (t)",
  total_load_volume_m3: "Objętość ładunku (m³)",
  special_requirements: "Wymagania specjalne",
  status_code: "Status",
  is_entry_fixed: "Pozycja oznaczona (Fix)",
  vehicle_capacity_volume_m3: "Pojemność pojazdu (m³)",

  // Pola stopów
  "stop.date_local": "Przystanek — data",
  "stop.time_local": "Przystanek — godzina",
  "stop.location_id": "Przystanek — lokalizacja",
  "stop.notes": "Przystanek — uwagi",

  // Specjalne typy wpisów
  order_created: "Zlecenie utworzone",
  stop_added: "Dodano przystanek",
  stop_removed: "Usunięto przystanek",
  item_added: "Dodano pozycję towarową",
  item_removed: "Usunięto pozycję towarową",
};

/** Wzorce regex dla dynamicznych nazw pól (item[N].xxx) */
const FIELD_PATTERNS: Array<{ pattern: RegExp; label: (match: RegExpMatchArray) => string }> = [
  { pattern: /^item\[(\d+)\]\.product_name$/, label: (m) => `Towar #${m[1]} — nazwa` },
  { pattern: /^item\[(\d+)\]\.loading_method_code$/, label: (m) => `Towar #${m[1]} — sposób załadunku` },
  { pattern: /^item\[(\d+)\]\.quantity_tons$/, label: (m) => `Towar #${m[1]} — ilość (t)` },
  { pattern: /^item\[(\d+)\]\.notes$/, label: (m) => `Towar #${m[1]} — uwagi` },
];

/**
 * Zwraca czytelną polską etykietę dla nazwy pola z order_change_log.
 * Fallback: zwraca oryginalną nazwę pola (wsteczna kompatybilność).
 */
export function getFieldLabel(fieldName: string): string {
  // 1. Dokładne dopasowanie
  if (FIELD_LABELS[fieldName]) return FIELD_LABELS[fieldName];

  // 2. Wzorce regex
  for (const { pattern, label } of FIELD_PATTERNS) {
    const match = fieldName.match(pattern);
    if (match) return label(match);
  }

  // 3. Fallback — oryginalna nazwa
  return fieldName;
}
